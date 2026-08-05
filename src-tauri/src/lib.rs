use keyring::Entry;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, Sender};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

mod db;

#[derive(Default)]
struct StreamCancellation {
    cancelled: std::sync::Mutex<HashSet<String>>,
}

impl StreamCancellation {
    fn mark(&self, run_id: &str) {
        if let Ok(mut set) = self.cancelled.lock() {
            set.insert(run_id.to_string());
        }
    }

    fn is_cancelled(&self, run_id: &str) -> bool {
        self.cancelled
            .lock()
            .map(|set| set.contains(run_id))
            .unwrap_or(false)
    }

    fn clear(&self, run_id: &str) {
        if let Ok(mut set) = self.cancelled.lock() {
            set.remove(run_id);
        }
    }
}

#[derive(Default)]
struct ProviderHeartbeat {
    results: std::sync::Mutex<HashMap<String, ProviderHealth>>,
    failures: std::sync::Mutex<HashMap<String, u32>>,
}

impl ProviderHeartbeat {
    fn record(&self, provider_id: &str, health: ProviderHealth) {
        if let (Ok(mut results), Ok(mut failures)) = (self.results.lock(), self.failures.lock()) {
            let streak = if health.ok {
                0
            } else {
                failures
                    .get(provider_id)
                    .copied()
                    .unwrap_or(0)
                    .saturating_add(1)
            };
            results.insert(provider_id.to_string(), health);
            failures.insert(provider_id.to_string(), streak);
        }
    }

    fn entries(&self, providers: &[db::Provider]) -> Vec<ProviderHeartbeatEntry> {
        let results = self
            .results
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default();
        let failures = self
            .failures
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default();
        providers
            .iter()
            .map(|provider| {
                let health = results.get(&provider.id);
                let streak = failures.get(&provider.id).copied().unwrap_or(0);
                ProviderHeartbeatEntry {
                    id: provider.id.clone(),
                    name: provider.name.clone(),
                    ok: health.map(|h| h.ok).unwrap_or(false),
                    latency_ms: health.map(|h| h.latency_ms).unwrap_or(0),
                    message: health
                        .map(|h| h.message.clone())
                        .unwrap_or_else(|| "pending".to_string()),
                    checked: health.is_some(),
                    consecutive_failures: streak,
                    alert: health.map(|h| !h.ok).unwrap_or(false) && streak >= 2,
                }
            })
            .collect()
    }

    fn snapshot(&self, providers: &[db::Provider]) -> ProviderHeartbeatSnapshot {
        let checked_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let entries = self.entries(providers);
        let alerts = entries
            .iter()
            .filter(|entry| entry.alert)
            .cloned()
            .collect();
        ProviderHeartbeatSnapshot {
            providers: entries,
            alerts,
            checked_at,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderHeartbeatEntry {
    id: String,
    name: String,
    ok: bool,
    latency_ms: u128,
    message: String,
    checked: bool,
    consecutive_failures: u32,
    alert: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderHeartbeatSnapshot {
    providers: Vec<ProviderHeartbeatEntry>,
    alerts: Vec<ProviderHeartbeatEntry>,
    checked_at: u128,
}

#[derive(Default)]
struct VaultWatchState {
    active: std::sync::Mutex<Option<ActiveVaultWatch>>,
}

struct ActiveVaultWatch {
    path: String,
    stop: Sender<()>,
    join: Option<thread::JoinHandle<()>>,
}

impl ActiveVaultWatch {
    fn stop(self) {
        let _ = self.stop.send(());
        if let Some(join) = self.join {
            let _ = join.join();
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultWatchStatus {
    watching: bool,
    path: Option<String>,
    files: i64,
    updated_at: i64,
}

fn is_stream_cancelled(app: &tauri::AppHandle, run_id: &str) -> bool {
    app.try_state::<StreamCancellation>()
        .map(|state| state.is_cancelled(run_id))
        .unwrap_or(false)
}

fn clear_stream_cancel(app: &tauri::AppHandle, run_id: &str) {
    if let Some(state) = app.try_state::<StreamCancellation>() {
        state.clear(run_id);
    }
}

const STREAM_CONNECT_TIMEOUT_SECS: u64 = 8;
const STREAM_TOTAL_TIMEOUT_SECS: u64 = 30;

fn stream_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(STREAM_CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(STREAM_TOTAL_TIMEOUT_SECS))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

fn summarize_status(status: reqwest::StatusCode) -> String {
    let code = status.as_u16();
    let hint = match code {
        401 => "unauthorized",
        403 => "forbidden",
        404 => "not found",
        429 => "rate limited",
        500..=599 => "server error",
        _ => "request rejected",
    };
    format!("Provider returned {} ({})", code, hint)
}

fn sanitize_stream_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "Request timeout: provider did not respond in time".to_string()
    } else if error.is_connect() {
        "Connection failed: provider unreachable".to_string()
    } else if error.is_body() || error.is_decode() {
        "Response read failed".to_string()
    } else {
        truncate_error(&error.to_string())
    }
}

fn truncate_error(message: &str) -> String {
    let trimmed = message.trim();
    if trimmed.len() <= 160 {
        return trimmed.to_string();
    }
    let mut end = 160;
    while !trimmed.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}...", &trimmed[..end])
}

fn get_api_key(name: &str) -> Result<String, String> {
    let entry = Entry::new("ai-workbench", name).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

fn chat_openai(messages_json: &str) -> Result<String, String> {
    let api_key = get_api_key("OPENAI_API_KEY")?;
    chat_openai_compatible("https://api.openai.com/v1", &api_key, messages_json)
}

fn stream_openai_compatible_with(
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<(), String> {
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = stream_client();
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": body,
            "stream": true
        }))
        .send()
        .map_err(|e| sanitize_stream_error(&e))?;

    if !resp.status().is_success() {
        return Err(summarize_status(resp.status()));
    }

    let mut reader = BufReader::new(resp);
    let mut finished = false;
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .map_err(|e| format!("Response read failed: {}", truncate_error(&e.to_string())))?;
        if read == 0 {
            break;
        }
        if is_cancelled() {
            return Ok(());
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(data) = line.strip_prefix("data:") {
            let data = data.trim();
            if data == "[DONE]" {
                finished = true;
                break;
            }
            if let Ok(json) = serde_json::from_str::<Value>(data) {
                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                    emit(&StreamChunk {
                        id: run_id.to_string(),
                        delta: delta.to_string(),
                        done: false,
                        error: None,
                        cancelled: false,
                    });
                }
            }
        }
    }
    if is_cancelled() {
        return Ok(());
    }
    if !finished {
        return Err("AI stream ended without [DONE]".into());
    }
    Ok(())
}

fn stream_openai_compatible(
    app: &tauri::AppHandle,
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
) -> Result<(), String> {
    let app = app.clone();
    let run_id_owned = run_id.to_string();
    let app_for_cancel = app.clone();
    let is_cancelled = move || is_stream_cancelled(&app_for_cancel, &run_id_owned);
    let mut emit = |chunk: &StreamChunk| {
        let _ = app.emit("stream-chunk", chunk.clone());
    };
    stream_openai_compatible_with(
        run_id,
        base_url,
        api_key,
        messages_json,
        &is_cancelled,
        &mut emit,
    )
}

fn stream_ollama_with(
    run_id: &str,
    messages_json: &str,
    model_name: &str,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<(), String> {
    let messages: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let client = stream_client();
    let resp = client
        .post("http://localhost:11434/api/chat")
        .json(&serde_json::json!({
            "model": model_name,
            "messages": messages,
            "stream": true
        }))
        .send()
        .map_err(|e| sanitize_stream_error(&e))?;

    if !resp.status().is_success() {
        return Err(summarize_status(resp.status()));
    }

    let mut reader = BufReader::new(resp);
    let mut finished = false;
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .map_err(|e| format!("Response read failed: {}", truncate_error(&e.to_string())))?;
        if read == 0 {
            break;
        }
        if is_cancelled() {
            return Ok(());
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<Value>(line) {
            if let Some(delta) = json["message"]["content"].as_str() {
                emit(&StreamChunk {
                    id: run_id.to_string(),
                    delta: delta.to_string(),
                    done: false,
                    error: None,
                    cancelled: false,
                });
            }
            if json["done"].as_bool() == Some(true) {
                finished = true;
                break;
            }
        }
    }
    if is_cancelled() {
        return Ok(());
    }
    if !finished {
        return Err("Ollama stream ended without done: true".into());
    }
    Ok(())
}

fn stream_ollama(
    app: &tauri::AppHandle,
    run_id: &str,
    messages_json: &str,
    model_name: &str,
) -> Result<(), String> {
    let app = app.clone();
    let run_id_owned = run_id.to_string();
    let app_for_cancel = app.clone();
    let is_cancelled = move || is_stream_cancelled(&app_for_cancel, &run_id_owned);
    let mut emit = |chunk: &StreamChunk| {
        let _ = app.emit("stream-chunk", chunk.clone());
    };
    stream_ollama_with(run_id, messages_json, model_name, &is_cancelled, &mut emit)
}

fn chat_openai_compatible(
    base_url: &str,
    api_key: &str,
    messages_json: &str,
) -> Result<String, String> {
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": body
        }))
        .send()
        .map_err(|e| format!("AI request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().unwrap_or_default();
        return Err(format!("AI {} : {}", status, err_body));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "AI returned empty content".into())
}

fn chat_ollama(messages_json: &str, model_name: &str) -> Result<String, String> {
    let messages: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post("http://localhost:11434/api/chat")
        .json(&serde_json::json!({
            "model": model_name,
            "messages": messages,
            "stream": false
        }))
        .send()
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Ollama {} : {}",
            resp.status(),
            resp.text().unwrap_or_default()
        ));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Ollama returned empty content".into())
}

fn chat_codex(prompt: &str) -> Result<String, String> {
    let output = Command::new("codex")
        .arg(prompt)
        .output()
        .map_err(|e| format!("Failed to spawn codex: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn is_ollama_provider(name: &str, url: &str) -> bool {
    let name = name.to_lowercase();
    let url = url.to_lowercase();
    name.contains("ollama") || url.contains("11434")
}

fn call_provider(provider: &db::Provider, messages_json: &str) -> Result<String, String> {
    if is_ollama_provider(&provider.name, &provider.base_url) {
        chat_ollama(messages_json, "qwen2.5:3b")
    } else {
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        let api_key = get_api_key(key_ref)?;
        chat_openai_compatible(&provider.base_url, &api_key, messages_json)
    }
}

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .get(&url)
        .send()
        .map_err(|e| format!("Fetch failed: {}", e))?;
    resp.text().map_err(|e| format!("Read failed: {}", e))
}

#[tauri::command]
fn fetch_rss(url: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let body = client
        .get(&url)
        .send()
        .map_err(|e| format!("Fetch failed: {}", e))?
        .text()
        .map_err(|e| format!("Read failed: {}", e))?;
    let mut items = Vec::new();
    let mut rest = body.as_str();
    while let Some(start) = rest.find("<item") {
        rest = &rest[start..];
        let Some(end) = rest.find("</item>") else {
            break;
        };
        let item = &rest[..end + 7];
        let title = extract_tag(item, "title");
        let link = extract_tag(item, "link");
        if !title.is_empty() {
            items.push(format!("- {} | {}", title, link));
        }
        rest = &rest[end + 7..];
    }
    Ok(if items.is_empty() {
        body.chars().take(500).collect()
    } else {
        items.join("\n")
    })
}

fn extract_tag(xml: &str, tag: &str) -> String {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    if let Some(s) = xml.find(&open) {
        let after = &xml[s + open.len()..];
        if let Some(e) = after.find('>') {
            let content = &after[e + 1..];
            if let Some(ce) = content.find(&close) {
                return content[..ce].trim().to_string();
            }
        }
    }
    String::new()
}

#[tauri::command]
fn write_note(vault_path: String, file_name: String, content: String) -> Result<String, String> {
    let vault = Path::new(&vault_path);
    let vault_canon =
        fs::canonicalize(vault).map_err(|e| format!("Vault path not accessible: {}", e))?;
    let name = Path::new(&file_name);
    if name
        .components()
        .any(|c| c == std::path::Component::ParentDir || c == std::path::Component::RootDir)
    {
        return Err("Invalid file name: path traversal not allowed".into());
    }
    let full = vault.join(name);
    let full_canon = fs::canonicalize(&full).unwrap_or_else(|_| full.clone());
    if !full_canon.starts_with(&vault_canon) {
        return Err("Path escapes vault directory".into());
    }
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dirs: {}", e))?;
    }
    fs::write(&full, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(format!("Saved to {}", full.display()))
}

#[tauri::command]
fn read_vault_notes(vault_path: String) -> Result<String, String> {
    let dir = Path::new(&vault_path);
    if !dir.is_dir() {
        return Ok("[]".into());
    }
    let mut notes: Vec<Value> = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Read dir failed: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let p = entry.path();
        if p.extension().is_some_and(|e| e == "md") {
            let content = fs::read_to_string(&p).unwrap_or_default();
            let (frontmatter, body) = parse_frontmatter(&content);
            notes.push(serde_json::json!({
                "fileName": p.file_name().unwrap_or_default().to_string_lossy(),
                "title": frontmatter.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled"),
                "project": frontmatter.get("project").and_then(|v| v.as_str()).unwrap_or("General"),
                "tags": frontmatter.get("tags").and_then(|v| v.as_str()).unwrap_or("").split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect::<Vec<_>>(),
                "content": body,
            }));
        }
    }
    serde_json::to_string(&notes).map_err(|e| e.to_string())
}

fn parse_frontmatter(content: &str) -> (serde_json::Map<String, Value>, String) {
    let mut map = serde_json::Map::new();
    if !content.starts_with("---") {
        return (map, content.to_string());
    }
    if let Some(rest) = content.strip_prefix("---") {
        if let Some(end) = rest.find("---") {
            let fm = &rest[..end];
            for line in fm.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    map.insert(k.trim().to_string(), Value::String(v.trim().to_string()));
                }
            }
            let body = rest[end + 3..].trim_start().to_string();
            return (map, body);
        }
    }
    (map, content.to_string())
}

fn collect_markdown_files(
    dir: &Path,
    out: &mut Vec<(String, String, String, String)>,
    depth: usize,
) -> Result<(), String> {
    if depth > 10 {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|e| format!("Read dir failed: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            collect_markdown_files(&path, out, depth + 1)?;
        } else if path.extension().is_some_and(|e| e == "md") {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let (frontmatter, body) = parse_frontmatter(&content);
            let path_str = path.to_string_lossy().to_string();
            let title = frontmatter
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .to_string();
            let tags = frontmatter
                .get("tags")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            out.push((path_str, title, tags, body));
        }
    }
    Ok(())
}

fn index_vault_files(
    conn: &rusqlite::Connection,
    vault_path: &str,
) -> Result<db::IndexResult, String> {
    let dir = Path::new(vault_path);
    if !dir.is_dir() {
        return Err("Vault path not a directory".into());
    }
    let mut files = Vec::new();
    collect_markdown_files(dir, &mut files, 0)?;
    let mut indexed = 0i64;
    for (path, title, tags, content) in files {
        db::upsert_knowledge_file(conn, &path, &title, &tags, &content)
            .map_err(|e| e.to_string())?;
        indexed += 1;
    }
    Ok(db::IndexResult { files: indexed })
}

fn upsert_markdown_path(conn: &rusqlite::Connection, path: &Path) -> Result<(), String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Read {} failed: {}", path.display(), e))?;
    let (frontmatter, body) = parse_frontmatter(&content);
    let title = frontmatter
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();
    let tags = frontmatter
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    db::upsert_knowledge_file(conn, &path.to_string_lossy(), &title, &tags, &body)
        .map_err(|e| e.to_string())
}

fn sync_vault_path(conn: &rusqlite::Connection, path: &Path) -> Result<bool, String> {
    if path.extension().is_none_or(|ext| ext != "md") {
        return Ok(false);
    }
    if path.exists() {
        upsert_markdown_path(conn, path)?;
        Ok(true)
    } else {
        db::delete_knowledge_file(conn, &path.to_string_lossy()).map_err(|e| e.to_string())?;
        Ok(true)
    }
}

fn start_vault_watcher(
    vault_path: String,
    mut on_event: impl FnMut(&Event) + Send + 'static,
) -> Result<ActiveVaultWatch, String> {
    let (stop_tx, stop_rx) = mpsc::channel();
    let (event_tx, event_rx) = mpsc::channel();
    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(event_tx).map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    let join = thread::Builder::new()
        .name("vault-watcher".to_string())
        .spawn(move || {
            let _keepalive = watcher;
            loop {
                if stop_rx.recv_timeout(Duration::from_millis(200)).is_ok() {
                    break;
                }
                while let Ok(event) = event_rx.try_recv() {
                    if let Ok(event) = event {
                        on_event(&event);
                    }
                }
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(ActiveVaultWatch {
        path: vault_path,
        stop: stop_tx,
        join: Some(join),
    })
}

fn vault_watch_status(
    app: &tauri::AppHandle,
    conn: &rusqlite::Connection,
) -> Result<VaultWatchStatus, String> {
    let (watching, path) = match app.try_state::<VaultWatchState>() {
        Some(state) => match state.active.lock() {
            Ok(active) => active
                .as_ref()
                .map(|handle| (true, Some(handle.path.clone())))
                .unwrap_or((false, None)),
            Err(_) => (false, None),
        },
        None => (false, None),
    };
    let status = db::knowledge_index_status(conn).map_err(|e| e.to_string())?;
    Ok(VaultWatchStatus {
        watching,
        path,
        files: status.files,
        updated_at: status.indexed_at,
    })
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_secret(key: String, value: String) -> Result<String, String> {
    let entry = Entry::new("ai-workbench", &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;
    Ok(format!("Secret '{}' stored", key))
}

#[tauri::command]
fn get_secret(key: String) -> Result<String, String> {
    let entry = Entry::new("ai-workbench", &key).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_secret(key: String) -> Result<String, String> {
    let entry = Entry::new("ai-workbench", &key).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(format!("Secret '{}' deleted", key))
}

#[tauri::command]
fn send_chat_message(
    model: String,
    messages_json: String,
    ollama_model: String,
) -> Result<String, String> {
    let model = model.to_lowercase();
    match model.as_str() {
        "cloud" => chat_openai(&messages_json),
        "ollama" => chat_ollama(&messages_json, &ollama_model),
        "codex" => {
            let msgs: Value = serde_json::from_str(&messages_json).map_err(|e| e.to_string())?;
            let last = msgs
                .as_array()
                .and_then(|a| a.last())
                .and_then(|m| m["content"].as_str())
                .unwrap_or("");
            chat_codex(last)
        }
        "auto" => {
            chat_openai(&messages_json).or_else(|_| chat_ollama(&messages_json, &ollama_model))
        }
        _ => Err(format!("Unknown model: {}", model)),
    }
}

#[tauri::command]
fn run_codex(idea: String, clarifications_json: String) -> Result<String, String> {
    let clarifications: Value =
        serde_json::from_str(&clarifications_json).map_err(|e| e.to_string())?;
    let mut prompt = format!("**Task:** {}\n\n", idea);
    if let Some(arr) = clarifications.as_array() {
        for c in arr {
            if let (Some(q), Some(a)) = (c["question"].as_str(), c["selected"].as_str()) {
                prompt.push_str(&format!("- {} : {}\n", q, a));
            }
        }
    }
    prompt.push_str("\nGenerate complete, runnable code. Output code only, no explanations.");
    chat_codex(&prompt)
}

#[tauri::command]
fn init_db(state: State<'_, db::Db>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch(db::SCHEMA).map_err(|e| e.to_string())?;
    Ok("ok".to_string())
}

#[tauri::command]
fn list_tasks(state: State<'_, db::Db>) -> Result<Vec<db::Task>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_task(
    state: State<'_, db::Db>,
    title: String,
    is_today: bool,
) -> Result<db::Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_task(&conn, &title, is_today).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task_status(state: State<'_, db::Db>, id: String, status: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_task_status(&conn, &id, &status).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_task_today(state: State<'_, db::Db>, id: String, is_today: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_task_today(&conn, &id, is_today).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_projects(state: State<'_, db::Db>) -> Result<Vec<db::Project>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_projects(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(
    state: State<'_, db::Db>,
    name: String,
    path: String,
) -> Result<db::Project, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_project(&conn, &name, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_thoughts(state: State<'_, db::Db>) -> Result<Vec<db::Thought>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_thoughts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_thought(
    state: State<'_, db::Db>,
    content: String,
    tags: String,
    kind: String,
) -> Result<db::Thought, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_thought(&conn, &content, &tags, &kind).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_providers(state: State<'_, db::Db>) -> Result<Vec<db::Provider>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_providers(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_provider(
    state: State<'_, db::Db>,
    name: String,
    base_url: String,
    api_key: String,
) -> Result<db::Provider, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_provider(&conn, &name, &base_url, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_provider_active(
    state: State<'_, db::Db>,
    id: String,
    is_active: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_provider_active(&conn, &id, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_departments(state: State<'_, db::Db>) -> Result<Vec<db::Department>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_departments(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_agents(state: State<'_, db::Db>) -> Result<Vec<db::Agent>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_agents(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_department(
    state: State<'_, db::Db>,
    name: String,
    description: String,
    color: String,
) -> Result<db::Department, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_department(&conn, &name, &description, &color).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_agent(
    state: State<'_, db::Db>,
    department_id: String,
    name: String,
    role: String,
    model: String,
    provider_id: Option<String>,
    system_prompt: String,
) -> Result<db::Agent, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_agent(
        &conn,
        &department_id,
        &name,
        &role,
        &model,
        provider_id,
        &system_prompt,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_agent_system_prompt(
    state: State<'_, db::Db>,
    id: String,
    system_prompt: String,
) -> Result<db::Agent, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_agent_system_prompt(&conn, &id, &system_prompt).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_agent_prompt_versions(
    state: State<'_, db::Db>,
    agent_id: String,
) -> Result<Vec<db::AgentPromptVersion>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_agent_prompt_versions(&conn, &agent_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_agent_prompt(
    state: State<'_, db::Db>,
    agent_id: String,
    version_id: String,
) -> Result<db::Agent, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::restore_agent_prompt(&conn, &agent_id, &version_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_habits(state: State<'_, db::Db>) -> Result<Vec<db::Habit>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_habits(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_habit(
    state: State<'_, db::Db>,
    name: String,
    week_goal: i64,
    color: String,
) -> Result<db::Habit, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_habit(&conn, &name, week_goal, &color).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_habit(state: State<'_, db::Db>, id: String) -> Result<db::Habit, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::toggle_habit(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_schedule_events(state: State<'_, db::Db>) -> Result<Vec<db::ScheduleEvent>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_schedule_events(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_schedule_event(
    state: State<'_, db::Db>,
    title: String,
    start_time: String,
    tag: String,
) -> Result<db::ScheduleEvent, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_schedule_event(&conn, &title, &start_time, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_event_done(state: State<'_, db::Db>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::toggle_event_done(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sessions(state: State<'_, db::Db>) -> Result<Vec<db::Session>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_session(
    state: State<'_, db::Db>,
    title: String,
    model: String,
) -> Result<db::Session, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_session(&conn, &title, &model).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_session(state: State<'_, db::Db>, id: String, title: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::rename_session(&conn, &id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_session(state: State<'_, db::Db>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_chat_message(
    state: State<'_, db::Db>,
    session_id: String,
    role: String,
    content: String,
    id: Option<String>,
) -> Result<db::ChatMessage, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::save_chat_message(&conn, &session_id, &role, &content, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_chat_messages(
    state: State<'_, db::Db>,
    session_id: String,
) -> Result<Vec<db::ChatMessage>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_chat_messages(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_chat_message(
    state: State<'_, db::Db>,
    id: String,
    content: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_chat_message(&conn, &id, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn truncate_chat_messages(
    state: State<'_, db::Db>,
    session_id: String,
    keep_message_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::truncate_chat_messages(&conn, &session_id, &keep_message_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_message_version(
    state: State<'_, db::Db>,
    message_id: String,
    content: String,
) -> Result<db::MessageVersion, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::save_message_version(&conn, &message_id, &content, None).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_message_versions(
    state: State<'_, db::Db>,
    message_id: String,
) -> Result<Vec<db::MessageVersion>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_message_versions(&conn, &message_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_message_version(
    state: State<'_, db::Db>,
    message_id: String,
    version_id: String,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::restore_message_version(&conn, &message_id, &version_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn diff_message_version_with_current(
    state: State<'_, db::Db>,
    message_id: String,
    version_id: String,
) -> Result<db::MessageDiff, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::diff_message_version_with_current(&conn, &message_id, &version_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_clipboard(state: State<'_, db::Db>) -> Result<Vec<db::ClipboardItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_clipboard(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_error_logs(state: State<'_, db::Db>) -> Result<Vec<db::ErrorLog>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_error_logs(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_sync_snapshot(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
) -> Result<db::SyncSnapshot, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("sync-snapshot.json");
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::export_sync_snapshot(&conn, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_sync_snapshot(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
) -> Result<db::SyncResult, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("sync-snapshot.json");
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::import_sync_snapshot(&conn, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn report_frontend_error(
    state: State<'_, db::Db>,
    source: String,
    message: String,
    stack: Option<String>,
    severity: String,
) -> Result<db::ErrorLog, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::report_frontend_error(&conn, &source, &message, stack.as_deref(), &severity)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn capture_clipboard(
    state: State<'_, db::Db>,
    content: String,
) -> Result<db::ClipboardItem, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::capture_clipboard(&conn, &content, "system").map_err(|e| e.to_string())
}

#[tauri::command]
fn search_thoughts(
    state: State<'_, db::Db>,
    query: String,
    limit: i64,
) -> Result<Vec<db::RagSearchResult>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::search_thoughts(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_rag_index_status(state: State<'_, db::Db>) -> Result<db::RagIndexStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::rag_index_status(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn index_vault(state: State<'_, db::Db>, vault_path: String) -> Result<db::IndexResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    index_vault_files(&conn, &vault_path)
}

#[tauri::command]
fn get_knowledge_index_status(
    state: State<'_, db::Db>,
) -> Result<db::KnowledgeIndexStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::knowledge_index_status(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_vault_watch(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: String,
) -> Result<VaultWatchStatus, String> {
    let dir = Path::new(&vault_path);
    if !dir.is_dir() {
        return Err("Vault path not a directory".into());
    }
    let canonical =
        fs::canonicalize(dir).map_err(|e| format!("Vault path not accessible: {}", e))?;
    let canonical_str = canonical.to_string_lossy().to_string();
    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = active.take() {
            handle.stop();
        }
    }
    {
        let conn = db_state.0.lock().map_err(|e| e.to_string())?;
        index_vault_files(&conn, &canonical_str)?;
    }
    let app_clone = app.clone();
    let on_event = move |event: &Event| {
        if !matches!(
            event.kind,
            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
        ) {
            return;
        }
        let Some(db_state) = app_clone.try_state::<db::Db>() else {
            return;
        };
        let Ok(conn) = db_state.0.lock() else {
            return;
        };
        let mut changed = false;
        for path in &event.paths {
            if let Ok(synced) = sync_vault_path(&conn, path) {
                changed |= synced;
            }
        }
        if changed {
            if let Ok(status) = vault_watch_status(&app_clone, &conn) {
                let _ = app_clone.emit("vault-watch-update", status);
            }
        }
    };
    let handle = start_vault_watcher(canonical_str.clone(), on_event)?;
    *state.active.lock().map_err(|e| e.to_string())? = Some(handle);
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    let status = vault_watch_status(&app, &conn)?;
    let _ = app.emit("vault-watch-update", status.clone());
    Ok(status)
}

#[tauri::command]
fn stop_vault_watch(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
) -> Result<VaultWatchStatus, String> {
    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = active.take() {
            handle.stop();
        }
    }
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    let status = vault_watch_status(&app, &conn)?;
    let _ = app.emit("vault-watch-update", status.clone());
    Ok(status)
}

#[tauri::command]
fn get_vault_watch_status(
    app: tauri::AppHandle,
    _state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
) -> Result<VaultWatchStatus, String> {
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    vault_watch_status(&app, &conn)
}

fn spawn_clipboard_monitor(app: tauri::AppHandle) {
    thread::spawn(move || {
        let mut clipboard = match arboard::Clipboard::new() {
            Ok(c) => c,
            Err(_) => return,
        };
        loop {
            thread::sleep(Duration::from_millis(1500));
            let Ok(text) = clipboard.get_text() else {
                continue;
            };
            if text.trim().is_empty() {
                continue;
            }
            let Some(state) = app.try_state::<db::Db>() else {
                continue;
            };
            let Ok(conn) = state.0.lock() else {
                continue;
            };
            let Ok(item) = db::capture_clipboard(&conn, &text, "system") else {
                continue;
            };
            drop(conn);
            let _ = app.emit("clipboard-updated", item);
        }
    });
}

fn spawn_provider_heartbeat_monitor(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(10));
        let Some(conn_state) = app.try_state::<db::Db>() else {
            continue;
        };
        let Ok(conn) = conn_state.0.lock() else {
            continue;
        };
        let Ok(all) = db::list_providers(&conn) else {
            continue;
        };
        drop(conn);
        let Some(heartbeat_state) = app.try_state::<ProviderHeartbeat>() else {
            continue;
        };
        let active: Vec<db::Provider> = all.into_iter().filter(|p| p.is_active).collect();
        if active.is_empty() {
            continue;
        }
        for provider in &active {
            let health = check_provider_health_state(provider);
            heartbeat_state.record(&provider.id, health);
        }
        let snapshot = heartbeat_state.snapshot(&active);
        let _ = app.emit("provider-heartbeat", snapshot);
    });
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamChunk {
    id: String,
    delta: String,
    done: bool,
    error: Option<String>,
    cancelled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamSmokeResult {
    ok: bool,
    chunks: usize,
    message: String,
}

#[tauri::command]
fn cancel_ai_stream(state: State<'_, StreamCancellation>, run_id: String) -> Result<(), String> {
    state.mark(&run_id);
    Ok(())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderHealth {
    ok: bool,
    latency_ms: u128,
    message: String,
}

fn check_provider_health_state(provider: &db::Provider) -> ProviderHealth {
    let started = std::time::Instant::now();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());
    let endpoint = if is_ollama_provider(&provider.name, &provider.base_url) {
        format!("{}/api/tags", provider.base_url.trim_end_matches('/'))
    } else {
        format!("{}/models", provider.base_url.trim_end_matches('/'))
    };
    let result = if is_ollama_provider(&provider.name, &provider.base_url) {
        client.get(&endpoint).send()
    } else {
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        match get_api_key(key_ref) {
            Ok(key) => client
                .get(&endpoint)
                .header("Authorization", format!("Bearer {}", key))
                .send(),
            Err(err) => {
                return ProviderHealth {
                    ok: false,
                    latency_ms: started.elapsed().as_millis(),
                    message: err,
                };
            }
        }
    };
    match result {
        Ok(resp) if resp.status().is_success() => ProviderHealth {
            ok: true,
            latency_ms: started.elapsed().as_millis(),
            message: "ok".to_string(),
        },
        Ok(resp) => ProviderHealth {
            ok: false,
            latency_ms: started.elapsed().as_millis(),
            message: format!("HTTP {}", resp.status()),
        },
        Err(err) => ProviderHealth {
            ok: false,
            latency_ms: started.elapsed().as_millis(),
            message: err.to_string(),
        },
    }
}

#[tauri::command]
fn check_provider_health(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<ProviderHealth, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let provider = db::get_provider(&conn, &provider_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;
    Ok(check_provider_health_state(&provider))
}

#[tauri::command]
fn run_provider_heartbeat(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    heartbeat: State<'_, ProviderHeartbeat>,
    provider_ids: Option<Vec<String>>,
) -> Result<ProviderHeartbeatSnapshot, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let all = db::list_providers(&conn).map_err(|e| e.to_string())?;
    drop(conn);
    let targets: Vec<db::Provider> = match provider_ids {
        Some(ids) => all
            .iter()
            .filter(|p| ids.contains(&p.id))
            .cloned()
            .collect(),
        None => all.clone(),
    };
    for provider in &targets {
        let health = check_provider_health_state(provider);
        heartbeat.record(&provider.id, health);
    }
    let snapshot = heartbeat.snapshot(&all);
    let _ = app.emit("provider-heartbeat", snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
fn run_provider_stream_smoke_test(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<StreamSmokeResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let provider = db::get_provider(&conn, &provider_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;
    drop(conn);
    let messages_json = serde_json::json!([{ "role": "user", "content": "ping" }]).to_string();
    let mut chunks = 0usize;
    let is_cancelled = || false;
    let result = if is_ollama_provider(&provider.name, &provider.base_url) {
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
            }
        };
        stream_ollama_with(
            "smoke",
            &messages_json,
            "qwen2.5:3b",
            &is_cancelled,
            &mut emit,
        )
    } else {
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        let api_key = get_api_key(key_ref)?;
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
            }
        };
        stream_openai_compatible_with(
            "smoke",
            &provider.base_url,
            &api_key,
            &messages_json,
            &is_cancelled,
            &mut emit,
        )
    };
    match result {
        Ok(()) => Ok(StreamSmokeResult {
            ok: true,
            chunks,
            message: format!("Streamed {chunks} chunk(s)"),
        }),
        Err(err) => Ok(StreamSmokeResult {
            ok: false,
            chunks,
            message: err,
        }),
    }
}

#[tauri::command]
async fn stream_ai_message(
    app: tauri::AppHandle,
    provider_ids: Vec<String>,
    messages: Vec<Value>,
    moa: bool,
    run_id: String,
) -> Result<(), String> {
    let messages_json = serde_json::to_string(&messages).map_err(|e| e.to_string())?;
    let run_id_clone = run_id.clone();
    let app_clone = app.clone();

    let done = tauri::async_runtime::spawn_blocking(move || {
        if moa {
            for provider_id in &provider_ids {
                if is_stream_cancelled(&app_clone, &run_id_clone) {
                    return Ok(());
                }
                let entry =
                    keyring::Entry::new("ai-workbench", &format!("aiwb-stream-{}", provider_id))
                        .map_err(|e| e.to_string())?;
                let key = entry
                    .get_password()
                    .unwrap_or_else(|_| "OPENAI_API_KEY".to_string());
                let api_key = get_api_key(&key)?;
                stream_openai_compatible(
                    &app_clone,
                    &run_id_clone,
                    "https://api.openai.com/v1",
                    &api_key,
                    &messages_json,
                )?;
            }
            Ok::<(), String>(())
        } else {
            let state = app_clone.state::<db::Db>();
            let conn = state.0.lock().map_err(|e| e.to_string())?;
            let mut selected = Vec::new();
            for id in provider_ids {
                if let Some(p) = db::get_provider(&conn, &id).map_err(|e| e.to_string())? {
                    selected.push(p);
                }
            }
            drop(conn);
            if selected.is_empty() {
                return Err("No providers configured".to_string());
            }
            let provider = selected[0].clone();
            if is_ollama_provider(&provider.name, &provider.base_url) {
                stream_ollama(&app_clone, &run_id_clone, &messages_json, "qwen2.5:3b")
            } else {
                let key_ref = if provider.api_key.is_empty() {
                    "OPENAI_API_KEY"
                } else {
                    &provider.api_key
                };
                let api_key = get_api_key(key_ref)?;
                stream_openai_compatible(
                    &app_clone,
                    &run_id_clone,
                    &provider.base_url,
                    &api_key,
                    &messages_json,
                )
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    let error = done.err().map(|e| e.to_string());
    let cancelled = is_stream_cancelled(&app, &run_id);
    clear_stream_cancel(&app, &run_id);
    let done_chunk = StreamChunk {
        id: run_id,
        delta: String::new(),
        done: true,
        error,
        cancelled,
    };
    let _ = app.emit("stream-chunk", done_chunk);
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitContext {
    head: String,
    branch: String,
    commit_count: usize,
    latest_commit: String,
    changes: Vec<String>,
}

#[tauri::command]
fn get_project_git_context(path: String) -> Result<GitContext, String> {
    let mut head = String::from("unknown");
    let mut branch = String::from("unknown");
    let mut commit_count = 0usize;
    let mut latest_commit = String::from("no commits");
    let head_path = Path::new(&path).join(".git").join("HEAD");
    if let Ok(content) = fs::read_to_string(&head_path) {
        let trimmed = content.trim();
        head = trimmed.to_string();
        if let Some(ref_name) = trimmed.strip_prefix("ref: refs/heads/") {
            branch = ref_name.to_string();
        } else if !trimmed.is_empty() {
            branch = format!("detached {}", &trimmed[..trimmed.len().min(8)]);
        }
    }
    let reflog_path = Path::new(&path).join(".git").join("logs").join("HEAD");
    if let Ok(content) = fs::read_to_string(&reflog_path) {
        let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
        commit_count = lines.len();
        if let Some(last) = lines.last() {
            let hash: String = last.split_whitespace().take(1).collect();
            latest_commit = format!(
                "{} {}",
                if hash.len() >= 8 { &hash[..8] } else { &hash },
                last.split(": ").nth(1).unwrap_or("")
            );
        }
    }
    let mut changes = Vec::new();
    if let Ok(output) = Command::new("git")
        .args(["status", "--short", "--untracked-files=normal"])
        .current_dir(&path)
        .output()
    {
        if output.status.success() {
            changes = String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .take(8)
                .collect();
        }
    }
    if changes.is_empty() {
        if let Ok(entries) = fs::read_dir(&path) {
            let mut files: Vec<(std::time::SystemTime, String)> = entries
                .flatten()
                .filter_map(|entry| {
                    let meta = entry.metadata().ok()?;
                    if !meta.is_file() {
                        return None;
                    }
                    Some((
                        meta.modified().ok()?,
                        entry.file_name().to_string_lossy().to_string(),
                    ))
                })
                .collect();
            files.sort_by_key(|b| std::cmp::Reverse(b.0));
            changes = files.into_iter().take(5).map(|(_, name)| name).collect();
        }
    }
    Ok(GitContext {
        head,
        branch,
        commit_count,
        latest_commit,
        changes,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CommitPrDraft {
    branch: String,
    commit_message: String,
    pr_title: String,
    pr_body: String,
    changes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitResult {
    committed: bool,
    hash: String,
    branch: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemotePrResult {
    created: bool,
    url: Option<String>,
    title: String,
    branch: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitRebaseResult {
    rebased: bool,
    conflict: bool,
    files: Vec<String>,
    base: String,
    branch: String,
    head: String,
}

fn commit_type_for(changes: &[String], branch: &str) -> &'static str {
    let has_docs = changes
        .iter()
        .any(|c| c.to_lowercase().contains("docs/") || c.to_lowercase().ends_with(".md"));
    let has_test = changes.iter().any(|c| {
        let lower = c.to_lowercase();
        lower.contains("test") || lower.contains("verify") || lower.contains("spec")
    });
    if has_docs {
        return "docs";
    }
    if has_test {
        return "test";
    }
    if branch.starts_with("fix/") || changes.iter().any(|c| c.to_lowercase().contains("fix")) {
        return "fix";
    }
    if branch.starts_with("feature/") || branch.starts_with("feat/") {
        return "feat";
    }
    "chore"
}

fn scope_for(branch: &str) -> String {
    let lower = branch.to_lowercase();
    for prefix in ["feature/", "feat/", "fix/"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            return rest.replace(['/', '_'], "-");
        }
    }
    branch.replace(['/', '_'], "-")
}

fn summary_for(changes: &[String]) -> String {
    let first = changes.first().map(|s| s.as_str()).unwrap_or("changes");
    let stem = Path::new(first)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| first.to_string());
    let tokens: Vec<String> = stem
        .split(|c: char| c == '-' || c == '_' || c == '.' || c.is_whitespace())
        .filter(|t| {
            let lower = t.to_lowercase();
            !lower.is_empty()
                && !matches!(
                    lower.as_str(),
                    "sprint" | "and" | "with" | "for" | "the" | "a" | "an"
                )
                && !t.chars().all(|c| c.is_ascii_digit())
        })
        .map(|t| t.to_string())
        .collect();
    let joined = if tokens.is_empty() {
        "workbench changes".to_string()
    } else {
        tokens[..tokens.len().min(4)].join(" ")
    };
    let mut chars = joined.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => "Workbench changes".to_string(),
    }
}

fn build_pr_body(project_name: &str, branch: &str, changes: &[String]) -> String {
    let mut body = String::from("## Summary\n\n");
    body.push_str(&format!("{project_name}\n\n"));
    body.push_str(&format!("Branch: `{branch}`\n\n"));
    body.push_str("## Changes\n\n");
    if changes.is_empty() {
        body.push_str("- No changed files detected.\n");
    } else {
        for change in changes.iter().take(12) {
            body.push_str(&format!("- {change}\n"));
        }
    }
    body.push_str(
        "\n## DoD\n\n\
         - [ ] Code compiles and tests pass.\n\
         - [ ] UI follows design tokens and stays stable.\n\
         - [ ] Database changes include migrations if needed.\n\
         - [ ] PR description matches the actual diff.\n",
    );
    body
}

#[tauri::command]
fn generate_commit_pr_draft(path: String, project_name: String) -> Result<CommitPrDraft, String> {
    let ctx = get_project_git_context(path)?;
    let commit_type = commit_type_for(&ctx.changes, &ctx.branch);
    let scope = scope_for(&ctx.branch);
    let summary = summary_for(&ctx.changes);
    let commit_message = format!("{commit_type}({scope}): {}", summary.to_lowercase());
    let pr_title = format!("{commit_type}({scope}): {summary}");
    let pr_body = build_pr_body(&project_name, &ctx.branch, &ctx.changes);
    Ok(CommitPrDraft {
        branch: ctx.branch,
        commit_message,
        pr_title,
        pr_body,
        changes: ctx.changes,
    })
}

fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("git command failed: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("git {} failed", args.first().copied().unwrap_or("command"))
        } else {
            stderr
        })
    }
}

fn git_branch(path: &str) -> String {
    run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|branch| !branch.is_empty() && branch != "HEAD")
        .unwrap_or_else(|| "unknown".to_string())
}

#[tauri::command]
fn apply_commit(path: String, message: String) -> Result<GitCommitResult, String> {
    if message.trim().is_empty() {
        return Err("Commit message is empty".into());
    }
    run_git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    run_git(&path, &["add", "-A"])?;
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;
    let head = run_git(&path, &["rev-parse", "HEAD"])?;
    let hash = head.chars().take(8).collect();
    let branch = git_branch(&path);
    if output.status.success() {
        return Ok(GitCommitResult {
            committed: true,
            hash,
            branch,
            message,
        });
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stderr.contains("nothing to commit")
        || stdout.contains("nothing to commit")
        || stderr.contains("no changes added")
        || stdout.contains("no changes added")
    {
        Ok(GitCommitResult {
            committed: false,
            hash,
            branch,
            message,
        })
    } else {
        let detail = stderr.trim();
        Err(if detail.is_empty() {
            stdout.trim().to_string()
        } else {
            detail.to_string()
        })
    }
}

fn pr_create_args(title: &str, body: &str, branch: &str) -> Vec<String> {
    vec![
        "pr".to_string(),
        "create".to_string(),
        "--title".to_string(),
        title.to_string(),
        "--body".to_string(),
        body.to_string(),
        "--head".to_string(),
        branch.to_string(),
    ]
}

fn has_gh_cli() -> bool {
    Command::new("gh")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[tauri::command]
fn create_remote_pr(path: String, title: String, body: String) -> Result<RemotePrResult, String> {
    let branch = git_branch(&path);
    if branch == "unknown" {
        return Err("Not a git repository".into());
    }
    if run_git(&path, &["remote", "get-url", "origin"]).is_err() {
        return Err("No git remote configured".into());
    }
    if !has_gh_cli() {
        return Err("gh CLI not available".into());
    }
    let args = pr_create_args(&title, &body, &branch);
    let output = Command::new("gh")
        .args(&args)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("gh command failed: {}", e))?;
    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(RemotePrResult {
            created: true,
            url: if url.is_empty() { None } else { Some(url) },
            title,
            branch,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "gh pr create failed".to_string()
        } else {
            stderr
        })
    }
}

fn short_head(path: &str) -> String {
    run_git(path, &["rev-parse", "HEAD"])
        .ok()
        .map(|head| head.chars().take(8).collect())
        .unwrap_or_else(|| "unknown".to_string())
}

fn git_conflict_files(path: &str) -> Vec<String> {
    run_git(path, &["diff", "--name-only", "--diff-filter=U"])
        .unwrap_or_default()
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .take(12)
        .collect()
}

#[tauri::command]
fn rebase_branch(path: String, base_branch: String) -> Result<GitRebaseResult, String> {
    let branch = git_branch(&path);
    if branch == "unknown" {
        return Err("Not a git repository".into());
    }
    if branch == base_branch {
        return Err("Already on base branch".into());
    }
    run_git(&path, &["rev-parse", "--verify", &base_branch])?;
    let output = Command::new("git")
        .args(["rebase", &base_branch])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git rebase failed: {}", e))?;
    let head = short_head(&path);
    if output.status.success() {
        return Ok(GitRebaseResult {
            rebased: true,
            conflict: false,
            files: Vec::new(),
            base: base_branch,
            branch,
            head,
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let detail = format!("{}{}", stdout, stderr);
    if detail.contains("CONFLICT") || detail.contains("conflict") {
        return Ok(GitRebaseResult {
            rebased: false,
            conflict: true,
            files: git_conflict_files(&path),
            base: base_branch,
            branch,
            head,
        });
    }
    Err(truncate_error(detail.trim()))
}

#[tauri::command]
fn abort_rebase(path: String) -> Result<String, String> {
    run_git(&path, &["rebase", "--abort"])?;
    Ok(format!("Rebase aborted on {}", git_branch(&path)))
}

fn build_team_summary_text(contents: Vec<String>) -> String {
    let mut lines = Vec::new();
    for content in contents {
        let line = content
            .lines()
            .map(str::trim)
            .find(|l| {
                !l.is_empty() && !l.starts_with("**") && !l.starts_with('-') && !l.starts_with('[')
            })
            .unwrap_or("No output");
        let truncated: String = line.chars().take(120).collect();
        lines.push(truncated);
    }
    if lines.is_empty() {
        "No agent output collected.".to_string()
    } else {
        lines.join("\n")
    }
}

#[tauri::command]
fn build_team_summary(contents: Vec<String>) -> Result<String, String> {
    Ok(build_team_summary_text(contents))
}

#[tauri::command]
async fn send_ai_message(
    state: State<'_, db::Db>,
    provider_ids: Vec<String>,
    messages: Vec<Value>,
    moa: bool,
) -> Result<String, String> {
    let mut selected = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut selected = Vec::new();
        for id in provider_ids {
            if let Some(p) = db::get_provider(&conn, &id).map_err(|e| e.to_string())? {
                selected.push(p);
            }
        }
        selected
    };

    if selected.is_empty() {
        return Err("No providers configured".to_string());
    }

    let messages_json = serde_json::to_string(&messages).map_err(|e| e.to_string())?;
    if moa && selected.len() >= 3 {
        let p0 = selected[0].clone();
        let p1 = selected[1].clone();
        let p2 = selected[2].clone();
        let m0 = messages_json.clone();
        let m1 = messages_json.clone();
        let m2 = messages_json;
        let a = tauri::async_runtime::spawn_blocking(move || call_provider(&p0, &m0));
        let b = tauri::async_runtime::spawn_blocking(move || call_provider(&p1, &m1));
        let c = tauri::async_runtime::spawn_blocking(move || call_provider(&p2, &m2));
        let (r1, r2, r3) = tokio::join!(a, b, c);
        let parts = [r1, r2, r3].map(|r| match r {
            Ok(Ok(text)) => text,
            Ok(Err(err)) => err,
            Err(err) => err.to_string(),
        });
        Ok(format!("MOA consensus\n\n{}", parts.join("\n\n---\n\n")))
    } else {
        let provider = selected.remove(0);
        let result =
            tauri::async_runtime::spawn_blocking(move || call_provider(&provider, &messages_json))
                .await
                .map_err(|e| e.to_string())??;
        Ok(result)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&dir).expect("create app data dir");
            let conn = db::init_connection(&dir.join("workbench.db")).expect("init db");
            app.manage(db::Db(std::sync::Mutex::new(conn)));
            app.manage(StreamCancellation::default());
            app.manage(ProviderHeartbeat::default());
            app.manage(VaultWatchState::default());
            spawn_clipboard_monitor(app.handle().clone());
            spawn_provider_heartbeat_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_secret,
            get_secret,
            delete_secret,
            send_chat_message,
            run_codex,
            fetch_url,
            fetch_rss,
            write_note,
            read_vault_notes,
            init_db,
            list_tasks,
            create_task,
            update_task_status,
            set_task_today,
            list_projects,
            create_project,
            list_thoughts,
            create_thought,
            list_providers,
            create_provider,
            set_provider_active,
            list_departments,
            list_agents,
            create_department,
            create_agent,
            update_agent_system_prompt,
            list_agent_prompt_versions,
            restore_agent_prompt,
            list_habits,
            create_habit,
            toggle_habit,
            list_schedule_events,
            create_schedule_event,
            toggle_event_done,
            list_sessions,
            create_session,
            rename_session,
            delete_session,
            save_chat_message,
            list_chat_messages,
            update_chat_message,
            truncate_chat_messages,
            save_message_version,
            list_message_versions,
            restore_message_version,
            diff_message_version_with_current,
            list_clipboard,
            list_error_logs,
            export_sync_snapshot,
            import_sync_snapshot,
            report_frontend_error,
            capture_clipboard,
            search_thoughts,
            get_rag_index_status,
            index_vault,
            get_knowledge_index_status,
            start_vault_watch,
            stop_vault_watch,
            get_vault_watch_status,
            get_project_git_context,
            generate_commit_pr_draft,
            apply_commit,
            create_remote_pr,
            rebase_branch,
            abort_rebase,
            build_team_summary,
            send_ai_message,
            stream_ai_message,
            cancel_ai_stream,
            check_provider_health,
            run_provider_heartbeat,
            run_provider_stream_smoke_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_cancellation_flags_follow_lifecycle() {
        let state = StreamCancellation::default();
        assert!(!state.is_cancelled("run-1"));
        state.mark("run-1");
        assert!(state.is_cancelled("run-1"));
        assert!(!state.is_cancelled("run-2"));
        state.clear("run-1");
        assert!(!state.is_cancelled("run-1"));
    }

    #[test]
    fn stream_error_messages_are_concise_and_safe() {
        assert_eq!(
            summarize_status(reqwest::StatusCode::UNAUTHORIZED),
            "Provider returned 401 (unauthorized)"
        );
        assert_eq!(
            summarize_status(reqwest::StatusCode::TOO_MANY_REQUESTS),
            "Provider returned 429 (rate limited)"
        );
        assert!(
            summarize_status(reqwest::StatusCode::INTERNAL_SERVER_ERROR).contains("server error")
        );
        let long = "x".repeat(300);
        let short = truncate_error(&long);
        assert!(short.ends_with("..."));
        assert!(short.len() <= 164);
        assert_eq!(truncate_error("ok"), "ok");
    }

    #[test]
    fn git_context_parses_branch_and_reflog() {
        let dir = std::env::temp_dir().join(format!("aiwb-git-ctx-test-{}", uuid::Uuid::new_v4()));
        let git_dir = dir.join(".git");
        std::fs::create_dir_all(git_dir.join("logs")).unwrap();
        std::fs::write(git_dir.join("HEAD"), "ref: refs/heads/feature/sprint-21\n").unwrap();
        std::fs::write(
            git_dir.join("logs").join("HEAD"),
            "aaaa0001 0000000000000000000000000000000000000000 Alice <a@x> 1720000000 +0800\tcommit: first\n\
             bbbb0002 aaaa00010000000000000000000000000000000000 Bob <b@x> 1720000100 +0800\tcommit: second\n",
        )
        .unwrap();

        let ctx = get_project_git_context(dir.to_string_lossy().to_string()).unwrap();
        assert_eq!(ctx.branch, "feature/sprint-21");
        assert_eq!(ctx.commit_count, 2);
        assert!(ctx.latest_commit.starts_with("bbbb0002"));
        assert!(ctx.latest_commit.contains("second"));
        assert!(ctx.changes.is_empty());

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn commit_pr_draft_follows_conventional_format() {
        let dir = std::env::temp_dir().join(format!("aiwb-pr-draft-test-{}", uuid::Uuid::new_v4()));
        let git_dir = dir.join(".git");
        std::fs::create_dir_all(git_dir.join("logs")).unwrap();
        std::fs::write(git_dir.join("HEAD"), "ref: refs/heads/feature/sprint-25\n").unwrap();
        std::fs::write(
            git_dir.join("logs").join("HEAD"),
            "aaaa0001 0000000000000000000000000000000000000000 Alice <a@x> 1720000000 +0800\tcommit: first\n",
        )
        .unwrap();
        std::fs::write(dir.join("notes.md"), "draft notes").unwrap();

        let draft = generate_commit_pr_draft(
            dir.to_string_lossy().to_string(),
            "AI Workbench".to_string(),
        )
        .unwrap();
        assert_eq!(draft.commit_message, "docs(sprint-25): notes");
        assert_eq!(draft.pr_title, "docs(sprint-25): Notes");
        assert!(draft.pr_body.contains("AI Workbench"));
        assert!(draft.pr_body.contains("DoD"));
        assert!(draft.pr_body.contains("- notes.md"));
        assert_eq!(draft.branch, "feature/sprint-25");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn team_summary_extracts_agent_output_lines() {
        let summary = build_team_summary_text(vec![
            "**UI Designer**\n\nStreaming fallback: first agent output.\n- bullet".to_string(),
            "**Frontend Developer**\n\nStreaming fallback: second agent output.".to_string(),
        ]);
        assert_eq!(
            summary,
            "Streaming fallback: first agent output.\nStreaming fallback: second agent output."
        );
        assert!(build_team_summary_text(Vec::new()).contains("No agent output"));
    }

    #[test]
    fn provider_heartbeat_tracks_consecutive_failures_and_alerts() {
        let heartbeat = ProviderHeartbeat::default();
        let provider = |id: &str, name: &str| db::Provider {
            id: id.to_string(),
            name: name.to_string(),
            base_url: "http://localhost:11434".to_string(),
            api_key: String::new(),
            is_active: true,
        };
        heartbeat.record(
            "p1",
            ProviderHealth {
                ok: false,
                latency_ms: 1,
                message: "down".to_string(),
            },
        );
        heartbeat.record(
            "p1",
            ProviderHealth {
                ok: false,
                latency_ms: 1,
                message: "down".to_string(),
            },
        );
        heartbeat.record(
            "p2",
            ProviderHealth {
                ok: true,
                latency_ms: 12,
                message: "ok".to_string(),
            },
        );

        let entries = heartbeat.entries(&[provider("p1", "Local"), provider("p2", "Cloud")]);
        let p1 = entries.iter().find(|entry| entry.id == "p1").unwrap();
        let p2 = entries.iter().find(|entry| entry.id == "p2").unwrap();
        assert_eq!(p1.consecutive_failures, 2);
        assert!(p1.alert);
        assert!(p1.checked);
        assert_eq!(p2.consecutive_failures, 0);
        assert!(!p2.alert);

        heartbeat.record(
            "p1",
            ProviderHealth {
                ok: true,
                latency_ms: 5,
                message: "ok".to_string(),
            },
        );
        let entries = heartbeat.entries(&[provider("p1", "Local"), provider("p3", "Pending")]);
        let p1 = entries.iter().find(|entry| entry.id == "p1").unwrap();
        let p3 = entries.iter().find(|entry| entry.id == "p3").unwrap();
        assert!(!p1.alert);
        assert_eq!(p1.consecutive_failures, 0);
        assert!(!p3.checked);
        assert!(!p3.alert);
    }

    #[test]
    fn provider_health_kind_detects_ollama() {
        assert!(is_ollama_provider("Ollama", "http://localhost:11434"));
        assert!(is_ollama_provider("My Local", "http://127.0.0.1:11434"));
        assert!(!is_ollama_provider("OpenAI", "https://api.openai.com/v1"));
    }

    #[test]
    fn vault_index_scans_and_searches_markdown() {
        let temp = std::env::temp_dir().join(format!("aiwb-vault-test-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(vault.join("notes")).unwrap();
        std::fs::write(
            vault.join("notes").join("obsidian.md"),
            "---\ntitle: Obsidian Notes\ntags: #work,#vault\n---\n# Obsidian Notes\n\nVault sync roadmap for local RAG",
        )
        .unwrap();
        std::fs::write(
            vault.join("README.md"),
            "# Project Notes\n\nLocal knowledge indexing",
        )
        .unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let result = index_vault_files(&conn, vault.to_str().unwrap()).unwrap();
        assert_eq!(result.files, 2);
        let status = db::knowledge_index_status(&conn).unwrap();
        assert_eq!(status.files, 2);
        let results = db::search_thoughts(&conn, "obsidian vault", 5).unwrap();
        assert!(results.iter().any(|r| r.content.contains("Obsidian")));
        assert!(results.iter().any(|r| r.kind == "doc"));
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    fn wait_until(mut check: impl FnMut() -> bool, timeout: Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        while std::time::Instant::now() < deadline {
            if check() {
                return true;
            }
            thread::sleep(Duration::from_millis(60));
        }
        check()
    }

    #[test]
    fn vault_watch_incrementally_syncs_files() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-vault-watch-test-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(&vault).unwrap();
        std::fs::write(vault.join("seed.md"), "# Seed\n\ninitial note").unwrap();
        let conn = std::sync::Arc::new(std::sync::Mutex::new(
            db::init_connection(&temp.join("workbench.db")).unwrap(),
        ));
        index_vault_files(&conn.lock().unwrap(), vault.to_str().unwrap()).unwrap();
        let db_for_event = conn.clone();
        let on_event = move |event: &Event| {
            for path in &event.paths {
                let _ = sync_vault_path(&db_for_event.lock().unwrap(), path);
            }
        };
        let handle = start_vault_watcher(vault.to_string_lossy().to_string(), on_event).unwrap();
        std::fs::write(vault.join("new.md"), "# New\n\nfresh note").unwrap();
        let added = wait_until(
            || {
                db::knowledge_index_status(&conn.lock().unwrap())
                    .map(|status| status.files)
                    .unwrap_or(0)
                    == 2
            },
            Duration::from_secs(8),
        );
        assert!(added, "watcher did not index new markdown file");
        std::fs::remove_file(vault.join("seed.md")).unwrap();
        let removed = wait_until(
            || {
                db::knowledge_index_status(&conn.lock().unwrap())
                    .map(|status| status.files)
                    .unwrap_or(0)
                    == 1
            },
            Duration::from_secs(8),
        );
        assert!(removed, "watcher did not remove deleted markdown file");
        handle.stop();
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    fn init_test_git_repo(dir: &Path) -> String {
        let path = dir.to_string_lossy().to_string();
        assert!(run_git(&path, &["init", "-b", "main"]).is_ok());
        assert!(run_git(&path, &["config", "user.email", "aiwb@test.local"]).is_ok());
        assert!(run_git(&path, &["config", "user.name", "AI Workbench Test"]).is_ok());
        path
    }

    #[test]
    fn apply_commit_commits_changes_in_real_repo() {
        let temp = std::env::temp_dir().join(format!("aiwb-commit-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "# Test\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        std::fs::write(temp.join("feature.md"), "# Feature\n").unwrap();

        let result = apply_commit(path.clone(), "feat(test): apply commit".to_string()).unwrap();
        assert!(result.committed);
        assert_eq!(result.hash.len(), 8);
        assert_eq!(
            run_git(&path, &["log", "-1", "--format=%s"]).unwrap(),
            "feat(test): apply commit"
        );
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn apply_commit_reports_nothing_to_commit() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-commit-empty-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "# Test\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();

        let result = apply_commit(path.clone(), "chore(test): nothing".to_string()).unwrap();
        assert!(!result.committed);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn create_remote_pr_rejects_missing_remote() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-pr-remote-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "# Test\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();

        let err =
            create_remote_pr(path, "feat(test): pr".to_string(), "body".to_string()).unwrap_err();
        assert!(err.contains("No git remote"), "unexpected error: {}", err);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn pr_create_args_include_title_body_and_head() {
        let args = pr_create_args("feat(test): pr", "body text", "feature/sprint-29");
        assert_eq!(args[0], "pr");
        assert!(args.contains(&"feat(test): pr".to_string()));
        assert!(args.contains(&"body text".to_string()));
        assert!(args.contains(&"feature/sprint-29".to_string()));
    }

    #[test]
    fn rebase_branch_cleanly_rebases_feature_onto_main() {
        let temp = std::env::temp_dir().join(format!("aiwb-rebase-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("main.txt"), "main\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        run_git(&path, &["checkout", "-b", "feature"]).unwrap();
        std::fs::write(temp.join("feature.txt"), "feature\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "feature work"]).unwrap();
        run_git(&path, &["checkout", "main"]).unwrap();
        std::fs::write(temp.join("base.txt"), "base\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "base work"]).unwrap();
        run_git(&path, &["checkout", "feature"]).unwrap();

        let result = rebase_branch(path.clone(), "main".to_string()).unwrap();
        assert!(result.rebased);
        assert!(!result.conflict);
        assert_eq!(result.base, "main");
        assert_eq!(result.branch, "feature");
        let log = run_git(&path, &["log", "--oneline"]).unwrap();
        assert!(log.contains("base work"));
        assert!(log.contains("feature work"));
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn rebase_branch_reports_conflicts_and_aborts() {
        let temp = std::env::temp_dir().join(format!(
            "aiwb-rebase-conflict-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("shared.txt"), "main\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        run_git(&path, &["checkout", "-b", "feature"]).unwrap();
        std::fs::write(temp.join("shared.txt"), "feature\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "feature edit"]).unwrap();
        run_git(&path, &["checkout", "main"]).unwrap();
        std::fs::write(temp.join("shared.txt"), "main changed\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "main edit"]).unwrap();
        run_git(&path, &["checkout", "feature"]).unwrap();

        let result = rebase_branch(path.clone(), "main".to_string()).unwrap();
        assert!(!result.rebased);
        assert!(result.conflict);
        assert!(
            result.files.iter().any(|file| file.ends_with("shared.txt")),
            "conflict files: {:?}",
            result.files
        );
        let aborted = abort_rebase(path.clone()).unwrap();
        assert!(aborted.contains("Rebase aborted"));
        assert_eq!(git_branch(&path), "feature");
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn openai_compatible_stream_parses_sse_end_to_end() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let body = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello \"}}]}\n\n\
                    data: {\"choices\":[{\"delta\":{\"content\":\"world\"}}]}\n\n\
                    data: [DONE]\n\n";
        let body_owned = body.to_string();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 4096];
            let _ = stream.read(&mut buf);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body_owned.len(),
                body_owned
            );
            let _ = stream.write_all(response.as_bytes());
        });
        let deltas = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
        let deltas_for_emit = deltas.clone();
        let mut emit = move |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                deltas_for_emit.lock().unwrap().push(chunk.delta.clone());
            }
        };
        let is_cancelled = || false;
        let messages = serde_json::json!([{ "role": "user", "content": "ping" }]).to_string();
        let result = stream_openai_compatible_with(
            "test-run",
            &format!("http://{}", addr),
            "dummy-key",
            &messages,
            &is_cancelled,
            &mut emit,
        );
        server.join().unwrap();
        assert!(result.is_ok(), "stream failed: {:?}", result);
        assert_eq!(
            *deltas.lock().unwrap(),
            vec!["Hello ".to_string(), "world".to_string()]
        );
    }

    #[test]
    fn openai_compatible_stream_requires_done_marker() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let body = "data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n";
        let body_owned = body.to_string();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 4096];
            let _ = stream.read(&mut buf);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body_owned.len(),
                body_owned
            );
            let _ = stream.write_all(response.as_bytes());
        });
        let is_cancelled = || false;
        let mut emit = |_chunk: &StreamChunk| {};
        let messages = serde_json::json!([{ "role": "user", "content": "ping" }]).to_string();
        let result = stream_openai_compatible_with(
            "test-run",
            &format!("http://{}", addr),
            "dummy-key",
            &messages,
            &is_cancelled,
            &mut emit,
        );
        server.join().unwrap();
        let err = result.unwrap_err();
        assert!(
            err.contains("ended without [DONE]"),
            "unexpected error: {}",
            err
        );
    }
}
