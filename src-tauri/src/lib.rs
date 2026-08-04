use keyring::Entry;
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
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

fn stream_openai_compatible(
    app: &tauri::AppHandle,
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
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
        if is_stream_cancelled(app, run_id) {
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
                    let _ = app.emit(
                        "stream-chunk",
                        StreamChunk {
                            id: run_id.to_string(),
                            delta: delta.to_string(),
                            done: false,
                            error: None,
                            cancelled: false,
                        },
                    );
                }
            }
        }
    }
    if is_stream_cancelled(app, run_id) {
        return Ok(());
    }
    if !finished {
        return Err("AI stream ended without [DONE]".into());
    }
    Ok(())
}

fn stream_ollama(
    app: &tauri::AppHandle,
    run_id: &str,
    messages_json: &str,
    model_name: &str,
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
        if is_stream_cancelled(app, run_id) {
            return Ok(());
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<Value>(line) {
            if let Some(delta) = json["message"]["content"].as_str() {
                let _ = app.emit(
                    "stream-chunk",
                    StreamChunk {
                        id: run_id.to_string(),
                        delta: delta.to_string(),
                        done: false,
                        error: None,
                        cancelled: false,
                    },
                );
            }
            if json["done"].as_bool() == Some(true) {
                finished = true;
                break;
            }
        }
    }
    if is_stream_cancelled(app, run_id) {
        return Ok(());
    }
    if !finished {
        return Err("Ollama stream ended without done: true".into());
    }
    Ok(())
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
    Ok(GitContext {
        head,
        branch,
        commit_count,
        latest_commit,
        changes,
    })
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
            get_project_git_context,
            send_ai_message,
            stream_ai_message,
            cancel_ai_stream,
            check_provider_health,
            run_provider_heartbeat
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
}
