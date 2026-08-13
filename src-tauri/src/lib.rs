use base64::engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::pbkdf2;
use ring::rand::{SecureRandom, SystemRandom};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

mod cli_spawn;
mod db;
mod file_ops;
mod journey;
mod prism_agents;
mod verify_matrix;

const CONFIRM_PREFIX: &str = "__requires_confirmation__:";

fn confirmation_error(action: &str, object: &str) -> String {
    format!("{CONFIRM_PREFIX}{action}:{object}")
}

fn requires_confirmation(action: &str, object: &str, confirmed: bool) -> Result<(), String> {
    if confirmed {
        Ok(())
    } else {
        Err(confirmation_error(action, object))
    }
}

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

fn stream_client(timeout_secs: u64) -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(STREAM_CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(timeout_secs.clamp(1, 300)))
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
    chat_openai_compatible(
        "https://api.openai.com/v1",
        &api_key,
        messages_json,
        "gpt-4o-mini",
    )
}

#[allow(clippy::too_many_arguments)]
fn stream_openai_compatible_with(
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
    model: &str,
    timeout_secs: u64,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<String, String> {
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = stream_client(timeout_secs);
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model,
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
    let mut collected = String::new();
    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .map_err(|e| format!("Response read failed: {}", truncate_error(&e.to_string())))?;
        if read == 0 {
            break;
        }
        if is_cancelled() {
            return Ok(collected);
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
                    collected.push_str(delta);
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
        return Ok(collected);
    }
    if !finished {
        return Err("AI stream ended without [DONE]".into());
    }
    Ok(collected)
}

fn stream_ollama_with(
    run_id: &str,
    base_url: &str,
    messages_json: &str,
    model_name: &str,
    timeout_secs: u64,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<String, String> {
    let messages: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let client = stream_client(timeout_secs);
    let endpoint = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let resp = client
        .post(&endpoint)
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
    let mut collected = String::new();
    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .map_err(|e| format!("Response read failed: {}", truncate_error(&e.to_string())))?;
        if read == 0 {
            break;
        }
        if is_cancelled() {
            return Ok(collected);
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<Value>(line) {
            if let Some(delta) = json["message"]["content"].as_str() {
                collected.push_str(delta);
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
        return Ok(collected);
    }
    if !finished {
        return Err("Ollama stream ended without done: true".into());
    }
    Ok(collected)
}

fn chat_openai_compatible(
    base_url: &str,
    api_key: &str,
    messages_json: &str,
    model: &str,
) -> Result<String, String> {
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model,
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

fn chat_ollama(base_url: &str, messages_json: &str, model_name: &str) -> Result<String, String> {
    let messages: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let client = reqwest::blocking::Client::new();
    let endpoint = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let resp = client
        .post(&endpoint)
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
        let model = if provider.model.is_empty() {
            "qwen2.5:3b"
        } else {
            &provider.model
        };
        chat_ollama(&provider.base_url, messages_json, model)
    } else {
        let api_key = resolve_provider_api_key(provider)?;
        let model = if provider.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &provider.model
        };
        chat_openai_compatible(&provider.base_url, &api_key, messages_json, model)
    }
}

fn stream_provider(
    app: &tauri::AppHandle,
    run_id: &str,
    provider: &db::Provider,
    messages_json: &str,
) -> Result<String, String> {
    let is_ollama = is_ollama_provider(&provider.name, &provider.base_url);
    let model = if is_ollama {
        if provider.model.is_empty() {
            "qwen2.5:3b"
        } else {
            &provider.model
        }
    } else {
        if provider.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &provider.model
        }
    };
    let api_key = if is_ollama {
        String::new()
    } else {
        resolve_provider_api_key(provider)?
    };
    let timeout_secs = provider.timeout_secs.clamp(1, 300) as u64;
    let retries = provider.retry_count.clamp(0, 5) as usize;
    let delay_secs = provider.retry_delay_secs.clamp(0, 30) as u64;
    let mut last_error = "Provider stream failed".to_string();
    for attempt in 0..=retries {
        let emitted_any = std::sync::Arc::new(AtomicBool::new(false));
        let emitted_flag = emitted_any.clone();
        let app_for_cancel = app.clone();
        let run_id_owned = run_id.to_string();
        let is_cancelled = move || is_stream_cancelled(&app_for_cancel, &run_id_owned);
        let app_emit = app.clone();
        let mut emit = move |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                emitted_flag.store(true, Ordering::Relaxed);
            }
            let _ = app_emit.emit("stream-chunk", chunk.clone());
        };
        let result = if is_ollama {
            stream_ollama_with(
                run_id,
                &provider.base_url,
                messages_json,
                model,
                timeout_secs,
                &is_cancelled,
                &mut emit,
            )
        } else {
            stream_openai_compatible_with(
                run_id,
                &provider.base_url,
                &api_key,
                messages_json,
                model,
                timeout_secs,
                &is_cancelled,
                &mut emit,
            )
        };
        match result {
            Ok(text) => return Ok(text),
            Err(err) => {
                if emitted_any.load(Ordering::Relaxed) || attempt == retries {
                    return Err(err);
                }
                last_error = err;
                thread::sleep(Duration::from_secs(delay_secs));
            }
        }
    }
    Err(last_error)
}

fn append_moa_chain_context(
    base_messages_json: &str,
    previous_name: &str,
    previous_output: &str,
) -> Result<String, String> {
    let mut messages: Vec<Value> =
        serde_json::from_str(base_messages_json).map_err(|e| e.to_string())?;
    messages.push(serde_json::json!({
        "role": "user",
        "content": format!("[Previous agent output from {}]\n{}", previous_name, previous_output)
    }));
    serde_json::to_string(&messages).map_err(|e| e.to_string())
}

fn moa_lane_run_id(run_id: &str, kind: &str, index: usize) -> String {
    format!("{}-{}{}", run_id, kind, index)
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
        "ollama" => chat_ollama("http://localhost:11434", &messages_json, &ollama_model),
        "codex" => {
            let msgs: Value = serde_json::from_str(&messages_json).map_err(|e| e.to_string())?;
            let last = msgs
                .as_array()
                .and_then(|a| a.last())
                .and_then(|m| m["content"].as_str())
                .unwrap_or("");
            chat_codex(last)
        }
        "auto" => chat_openai(&messages_json)
            .or_else(|_| chat_ollama("http://localhost:11434", &messages_json, &ollama_model)),
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
    project_id: Option<String>,
    is_dod: bool,
) -> Result<db::Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_task(&conn, &title, is_today, project_id.as_deref(), is_dod)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task_status(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    id: String,
    status: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_task_status(&conn, &id, &status).map_err(|e| e.to_string())?;
    if let Ok(Some(project_id)) = db::get_task_project(&conn, &id) {
        if let Ok(remaining) = db::count_project_dod(&conn, &project_id) {
            let _ = app.emit(
                "DOD_STATUS_CHANGED",
                serde_json::json!({ "projectId": project_id, "remainingDodCount": remaining }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
fn set_task_today(state: State<'_, db::Db>, id: String, is_today: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_task_today(&conn, &id, is_today).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_task_due_date(
    state: State<'_, db::Db>,
    id: String,
    due_date: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_task_due_date(&conn, &id, due_date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task_title(state: State<'_, db::Db>, id: String, title: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_task_title(&conn, &id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_task(state: State<'_, db::Db>, id: String, confirmed: bool) -> Result<(), String> {
    requires_confirmation("delete_task", &id, confirmed)?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_fsm_run(state: State<'_, db::Db>) -> Result<db::FsmRunCreated, String> {
    let run_id = db::uid();
    let trace_id = db::generate_trace_id();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_fsm_run(&conn, &run_id, &trace_id).map_err(|e| e.to_string())?;
    Ok(db::FsmRunCreated { run_id, trace_id })
}

#[tauri::command]
fn create_fsm_node(
    state: State<'_, db::Db>,
    run_id: String,
    node_key: String,
    agent: Option<String>,
    status: String,
    context_json: String,
) -> Result<db::FsmNode, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_fsm_node(
        &conn,
        &run_id,
        &node_key,
        agent.as_deref(),
        &status,
        &context_json,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_fsm_node_status(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    id: String,
    status: String,
) -> Result<db::FsmNode, String> {
    let node = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::update_fsm_node_status(&conn, &id, &status).map_err(|e| e.to_string())?
    };
    let _ = app.emit("fsm://node/updated", node.clone());
    Ok(node)
}

#[tauri::command]
fn update_fsm_node_context(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    id: String,
    context_json: String,
) -> Result<db::FsmNode, String> {
    let node = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::update_fsm_node_context(&conn, &id, &context_json).map_err(|e| e.to_string())?
    };
    let _ = app.emit("fsm://node/updated", node.clone());
    Ok(node)
}

#[tauri::command]
fn list_fsm_nodes(state: State<'_, db::Db>, run_id: String) -> Result<Vec<db::FsmNode>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_fsm_nodes(&conn, &run_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_active_fsm_runs(state: State<'_, db::Db>) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_active_fsm_runs(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_fsm_run(state: State<'_, db::Db>, run_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_fsm_run(&conn, &run_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_run_metric(
    state: State<'_, db::Db>,
    run_id: String,
) -> Result<Option<db::RunMetric>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_run_metric(&conn, &run_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_run_metrics(state: State<'_, db::Db>, limit: i64) -> Result<Vec<db::RunMetric>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_run_metrics(&conn, limit).map_err(|e| e.to_string())
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
fn update_project(
    state: State<'_, db::Db>,
    id: String,
    status: String,
    revenue: f64,
) -> Result<db::Project, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_project(&conn, &id, &status, revenue).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project_material(
    state: State<'_, db::Db>,
    id: String,
    material: String,
) -> Result<db::Project, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_project_material(&conn, &id, &material).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project_journey(
    state: State<'_, db::Db>,
    id: String,
    stage: String,
    journey_doc_path: Option<String>,
) -> Result<db::Project, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_project_journey(&conn, &id, &stage, journey_doc_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_journey_doc(
    state: State<'_, db::Db>,
    vault_path: String,
    file_name: String,
    content: String,
    project_id: String,
    stage: String,
    mode: String,
) -> Result<db::Project, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let current = db::get_project(&conn, &project_id).map_err(|e| e.to_string())?;
    if !journey::stage_valid(&stage) {
        return Err(format!("invalid journey stage: {stage}"));
    }
    if !journey::transition_allowed(&current.journey_stage, &stage) {
        return Err(format!(
            "journey transition not allowed: {} -> {stage}",
            current.journey_stage
        ));
    }
    if mode != "replace" && mode != "append" {
        return Err(format!("invalid journey doc mode: {mode}"));
    }

    let vault = Path::new(&vault_path);
    let vault_canon =
        fs::canonicalize(vault).map_err(|e| format!("Vault path not accessible: {e}"))?;
    let name = Path::new(&file_name);
    if name.components().any(|component| {
        component == std::path::Component::ParentDir || component == std::path::Component::RootDir
    }) {
        return Err("Invalid file name: path traversal not allowed".into());
    }
    let full = vault.join(name);
    let full_canon = fs::canonicalize(&full).unwrap_or_else(|_| full.clone());
    if !full_canon.starts_with(&vault_canon) {
        return Err("Path escapes vault directory".into());
    }
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dirs: {e}"))?;
    }
    let existing = fs::read_to_string(&full).ok();
    let final_content = if mode == "append" {
        let updated_at = chrono::Utc::now().to_rfc3339();
        journey::append_record(
            existing.as_deref().unwrap_or(""),
            &content,
            &stage,
            &updated_at,
            &project_id,
        )
    } else {
        content
    };
    fs::write(&full, final_content).map_err(|e| format!("Failed to write journey doc: {e}"))?;
    let update = db::update_project_journey(&conn, &project_id, &stage, Some(file_name));
    if let Err(error) = update {
        let _ = match existing {
            Some(previous) => fs::write(&full, previous),
            None => fs::remove_file(&full),
        };
        return Err(error.to_string());
    }
    update.map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_project(state: State<'_, db::Db>, id: String, confirmed: bool) -> Result<(), String> {
    requires_confirmation("delete_project", &id, confirmed)?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_project(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn reorder_projects(state: State<'_, db::Db>, ids: Vec<String>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::reorder_projects(&conn, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_project_revenue_history(
    state: State<'_, db::Db>,
    project_id: String,
    limit: i64,
) -> Result<Vec<db::ProjectRevenuePoint>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_project_revenue_history(&conn, &project_id, limit).map_err(|e| e.to_string())
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
fn update_thought_tags(
    state: State<'_, db::Db>,
    id: String,
    tags: String,
) -> Result<db::Thought, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_thought_tags(&conn, &id, &tags).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_thought_content(
    state: State<'_, db::Db>,
    id: String,
    content: String,
) -> Result<db::Thought, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_thought_content(&conn, &id, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_thought_reference(state: State<'_, db::Db>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::record_thought_reference(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_obsidian(project_path: String, file: String) -> Result<String, String> {
    let note = file.trim().trim_start_matches('/').trim_start_matches('\\');
    let vault = Path::new(&project_path)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| project_path.clone());
    let full = format!("{}/{}", vault.trim_end_matches('/'), note);
    let encoded = encode_uri_component(&full);
    let uri = format!("obsidian://open?path={}", encoded);
    let _ = Command::new("cmd").args(["/C", "start", "", &uri]).spawn();
    Ok(uri)
}

fn encode_uri_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}

#[tauri::command]
fn update_thought_type(
    state: State<'_, db::Db>,
    id: String,
    kind: String,
) -> Result<db::Thought, String> {
    if !matches!(kind.as_str(), "inbox" | "note" | "doc") {
        return Err("invalid thought type".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_thought_type(&conn, &id, &kind).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_thought(state: State<'_, db::Db>, id: String, confirmed: bool) -> Result<(), String> {
    requires_confirmation("delete_thought", &id, confirmed)?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_thought(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_providers(state: State<'_, db::Db>) -> Result<Vec<db::Provider>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    decrypt_providers(db::list_providers(&conn).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn create_provider(
    state: State<'_, db::Db>,
    name: String,
    base_url: String,
    api_key: String,
    model: Option<String>,
) -> Result<db::Provider, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let secret = provider_secret()?;
    let (stored_key, encrypted) = if api_key.trim().is_empty() {
        (String::new(), false)
    } else {
        (encrypt_provider_api_key(&api_key, secret)?, true)
    };
    let provider = db::create_provider_with_options(
        &conn,
        &name,
        &base_url,
        &stored_key,
        &model.unwrap_or_default(),
        encrypted,
        30,
        1,
        1,
    )
    .map_err(|e| e.to_string())?;
    decrypt_provider(provider)
}

#[tauri::command]
fn update_provider_stream_config(
    state: State<'_, db::Db>,
    id: String,
    timeout_secs: i64,
    retry_count: i64,
    retry_delay_secs: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_provider_stream_config(
        &conn,
        &id,
        timeout_secs.clamp(1, 300),
        retry_count.clamp(0, 5),
        retry_delay_secs.clamp(0, 30),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn export_providers(state: State<'_, db::Db>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let providers = decrypt_providers(db::list_providers(&conn).map_err(|e| e.to_string())?)?;
    let payload = serde_json::json!({
        "version": 1,
        "exportedAt": now_millis(),
        "providers": providers,
    });
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_providers(state: State<'_, db::Db>, payload: String) -> Result<usize, String> {
    let value: Value =
        serde_json::from_str(&payload).map_err(|e| format!("Invalid provider JSON: {}", e))?;
    let items = match value.as_array() {
        Some(items) => items.clone(),
        None => value
            .get("providers")
            .and_then(|v| v.as_array())
            .cloned()
            .ok_or_else(|| "Provider JSON must be an array or {providers: [...]}".to_string())?,
    };
    let secret = provider_secret()?;
    let mut providers = Vec::with_capacity(items.len());
    for item in items {
        let api_key = item
            .get("apiKey")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let (stored_key, encrypted) = if api_key.trim().is_empty() {
            (String::new(), false)
        } else {
            (encrypt_provider_api_key(&api_key, secret)?, true)
        };
        providers.push(db::Provider {
            id: String::new(),
            name: item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            base_url: item
                .get("baseUrl")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            api_key: stored_key,
            model: item
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            priority: item
                .get("priority")
                .and_then(|v| v.as_i64())
                .unwrap_or(0)
                .max(0),
            is_active: item
                .get("isActive")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            api_key_encrypted: encrypted,
            timeout_secs: item
                .get("timeoutSecs")
                .and_then(|v| v.as_i64())
                .unwrap_or(30)
                .clamp(1, 300),
            retry_count: item
                .get("retryCount")
                .and_then(|v| v.as_i64())
                .unwrap_or(1)
                .clamp(0, 5),
            retry_delay_secs: item
                .get("retryDelaySecs")
                .and_then(|v| v.as_i64())
                .unwrap_or(1)
                .clamp(0, 30),
        });
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::replace_providers(&conn, &providers).map_err(|e| e.to_string())
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
fn set_provider_priority(
    state: State<'_, db::Db>,
    id: String,
    priority: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_provider_priority(&conn, &id, priority).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_provider_model(
    state: State<'_, db::Db>,
    id: String,
    model: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_provider_model(&conn, &id, &model).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_provider_models(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<Vec<ProviderModel>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let provider = db::get_provider(&conn, &provider_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;
    let provider = decrypt_provider(provider)?;
    drop(conn);
    fetch_provider_models(&provider)
}

fn fetch_provider_models(provider: &db::Provider) -> Result<Vec<ProviderModel>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let is_ollama = is_ollama_provider(&provider.name, &provider.base_url);
    let endpoint = if is_ollama {
        format!("{}/api/tags", provider.base_url.trim_end_matches('/'))
    } else {
        format!("{}/models", provider.base_url.trim_end_matches('/'))
    };
    let mut request = client.get(&endpoint);
    if !is_ollama {
        let api_key = resolve_provider_api_key(provider)?;
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }
    let response = request.send().map_err(|e| e.to_string())?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Models HTTP {}: {}", status, truncate_error(&body)));
    }
    parse_provider_models(&body, is_ollama)
}

#[tauri::command]
fn list_cached_provider_models(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<Vec<db::ModelMeta>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_cached_provider_models(&conn, &provider_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn refresh_provider_models(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<Vec<db::ModelMeta>, String> {
    let provider = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::get_provider(&conn, &provider_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Provider not found".to_string())?
    };
    let provider = decrypt_provider(provider)?;
    let models = fetch_provider_models(&provider)?;
    let inputs: Vec<(String, Option<String>)> =
        models.into_iter().map(|m| (m.id, m.owned_by)).collect();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::upsert_provider_models(&conn, &provider_id, &inputs).map_err(|e| e.to_string())?;
    db::list_cached_provider_models(&conn, &provider_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_provider_model_meta(
    state: State<'_, db::Db>,
    provider_id: String,
    model_id: String,
    meta: db::ModelMetaPatch,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_model_meta(
        &conn,
        &provider_id,
        &model_id,
        db::ModelMetaPatch {
            context_window: meta.context_window.clamp(0, 1_000_000_000),
            input_price_per_mtok: meta.input_price_per_mtok.max(0.0),
            output_price_per_mtok: meta.output_price_per_mtok.max(0.0),
            rate_tpm: meta.rate_tpm.clamp(0, 1_000_000_000),
            rate_rpm: meta.rate_rpm.clamp(0, 1_000_000_000),
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_provider_model_favorite(
    state: State<'_, db::Db>,
    provider_id: String,
    model_id: String,
    favorite: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_model_favorite(&conn, &provider_id, &model_id, favorite).map_err(|e| e.to_string())
}

#[tauri::command]
fn touch_provider_model_usage(
    state: State<'_, db::Db>,
    provider_id: String,
    model_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::touch_model_usage(&conn, &provider_id, &model_id).map_err(|e| e.to_string())
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
fn list_agent_catalog(state: State<'_, db::Db>) -> Result<Vec<db::AgentCatalogEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_agent_catalog(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_agent_catalog(
    state: State<'_, db::Db>,
    entries: Vec<db::AgentCatalogInput>,
) -> Result<Vec<db::AgentCatalogEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::import_agent_catalog(&conn, &entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_team_presets(state: State<'_, db::Db>) -> Result<Vec<db::TeamPreset>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_team_presets(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_team_preset(
    state: State<'_, db::Db>,
    name: String,
    agent_slugs: Vec<String>,
) -> Result<db::TeamPreset, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_team_preset(&conn, &name, &agent_slugs).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_team_preset(
    state: State<'_, db::Db>,
    id: String,
    name: String,
    agent_slugs: Vec<String>,
) -> Result<db::TeamPreset, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_team_preset(&conn, &id, &name, &agent_slugs).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_team_preset(state: State<'_, db::Db>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_team_preset(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_cli_tools(state: State<'_, db::Db>) -> Result<Vec<db::CliToolDetection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_cli_tools(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn detect_cli_tools(state: State<'_, db::Db>) -> Result<Vec<db::CliToolDetection>, String> {
    let detected = cli_spawn::detect_cli_tools();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::save_cli_tool_detections(&conn, &detected).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_delivery_runs(
    state: State<'_, db::Db>,
    limit: i64,
) -> Result<Vec<db::DeliveryRun>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_delivery_runs(&conn, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_delivery_run(
    state: State<'_, db::Db>,
    request: db::DeliveryRun,
) -> Result<db::DeliveryRun, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::record_delivery_run(&conn, &request).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_cli_tool_detections(
    state: State<'_, db::Db>,
    tools: Vec<db::CliToolDetection>,
) -> Result<Vec<db::CliToolDetection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::save_cli_tool_detections(&conn, &tools).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sessions(state: State<'_, db::Db>) -> Result<Vec<db::Session>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_workspace_summary(state: State<'_, db::Db>) -> Result<db::WorkspaceSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_workspace_summary(&conn).map_err(|e| e.to_string())
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
fn get_error_log_summary(
    state: State<'_, db::Db>,
    granularity: String,
    source: Option<String>,
    severity: Option<String>,
    device_id: Option<String>,
    since_ms: Option<i64>,
    until_ms: Option<i64>,
) -> Result<db::ErrorLogSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::error_log_summary(
        &conn,
        &granularity,
        source.as_deref(),
        severity.as_deref(),
        device_id.as_deref(),
        since_ms,
        until_ms,
    )
    .map_err(|e| e.to_string())
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
    device_id: String,
) -> Result<db::ErrorLog, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::report_frontend_error(
        &conn,
        &source,
        &message,
        stack.as_deref(),
        &severity,
        &device_id,
    )
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
    source_filter: Option<db::RagSourceFilter>,
) -> Result<Vec<db::RagSearchResult>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::search_thoughts(&conn, &query, limit, source_filter.as_ref()).map_err(|e| e.to_string())
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
        let Ok(all) = decrypt_providers(all) else {
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

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamFallback {
    id: String,
    from: String,
    to: String,
}

fn auto_fallback_marker(from: &str, to: &str) -> String {
    format!("\n[auto fallback: {} → {}]\n", from, to)
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoaConsensus {
    pub summary: String,
    pub common: Vec<String>,
    pub viewpoints: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamSmokeResult {
    ok: bool,
    chunks: usize,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderE2eResult {
    ok: bool,
    chunks: usize,
    chars: usize,
    duration_ms: u128,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WebhookDeliveryResult {
    ok: bool,
    status: u16,
    duration_ms: u128,
    attempts: u32,
    signed: bool,
    message: String,
}

fn webhook_signature(secret: &str, payload: &str) -> String {
    const BLOCK_SIZE: usize = 64;
    let key = secret.as_bytes();
    let mut key_block = [0u8; BLOCK_SIZE];
    if key.len() > BLOCK_SIZE {
        let digest = Sha256::digest(key);
        key_block[..digest.len()].copy_from_slice(&digest);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let inner_pad: Vec<u8> = key_block.iter().map(|byte| byte ^ 0x36).collect();
    let outer_pad: Vec<u8> = key_block.iter().map(|byte| byte ^ 0x5c).collect();
    let mut inner = Sha256::new();
    inner.update(&inner_pad);
    inner.update(payload.as_bytes());
    let inner_digest = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(&outer_pad);
    outer.update(inner_digest);
    outer
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

const SYNC_PBKDF2_ITERATIONS: u32 = 100_000;
const SYNC_SALT_LEN: usize = 16;
const SYNC_NONCE_LEN: usize = 12;

fn derive_sync_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    let iterations =
        std::num::NonZeroU32::new(SYNC_PBKDF2_ITERATIONS).expect("iterations must be non-zero");
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        salt,
        passphrase.as_bytes(),
        &mut key,
    );
    Ok(key)
}

fn encrypt_sync_payload(payload: &str, passphrase: &str) -> Result<String, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let rng = SystemRandom::new();
    let mut salt = [0u8; SYNC_SALT_LEN];
    let mut nonce_bytes = [0u8; SYNC_NONCE_LEN];
    rng.fill(&mut salt)
        .map_err(|e| format!("Random salt failed: {}", e))?;
    rng.fill(&mut nonce_bytes)
        .map_err(|e| format!("Random nonce failed: {}", e))?;
    let key = derive_sync_key(passphrase, &salt)?;
    let unbound =
        UnboundKey::new(&AES_256_GCM, &key).map_err(|e| format!("Key setup failed: {}", e))?;
    let sealing_key = LessSafeKey::new(unbound);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut in_out = payload.as_bytes().to_vec();
    sealing_key
        .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let envelope = serde_json::json!({
        "v": 1,
        "alg": "AES-256-GCM",
        "salt": BASE64.encode(salt),
        "iv": BASE64.encode(nonce_bytes),
        "ciphertext": BASE64.encode(&in_out),
    });
    serde_json::to_string(&envelope).map_err(|e| format!("Envelope serialization failed: {}", e))
}

fn decrypt_sync_payload(envelope: &str, passphrase: &str) -> Result<String, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let parsed: Value =
        serde_json::from_str(envelope).map_err(|_| "Invalid encrypted payload".to_string())?;
    if parsed["v"] != 1 || parsed["alg"] != "AES-256-GCM" {
        return Err("Unsupported encrypted payload".to_string());
    }
    let salt = BASE64
        .decode(parsed["salt"].as_str().unwrap_or_default())
        .map_err(|_| "Invalid salt".to_string())?;
    let nonce_bytes: [u8; SYNC_NONCE_LEN] = BASE64
        .decode(parsed["iv"].as_str().unwrap_or_default())
        .map_err(|_| "Invalid iv".to_string())?
        .try_into()
        .map_err(|_| "Invalid iv length".to_string())?;
    let mut ciphertext = BASE64
        .decode(parsed["ciphertext"].as_str().unwrap_or_default())
        .map_err(|_| "Invalid ciphertext".to_string())?;
    let key = derive_sync_key(passphrase, &salt)?;
    let unbound =
        UnboundKey::new(&AES_256_GCM, &key).map_err(|e| format!("Key setup failed: {}", e))?;
    let opening_key = LessSafeKey::new(unbound);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let plaintext = opening_key
        .open_in_place(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| "Decryption failed: wrong passphrase or corrupted payload".to_string())?;
    String::from_utf8(plaintext.to_vec())
        .map_err(|_| "Decrypted payload is not valid UTF-8".to_string())
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{:02x}", byte));
    }
    out
}

fn sync_key_fingerprint(key: &[u8; 32]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key);
    let digest = hasher.finalize();
    hex_encode(&digest[..8])
}

fn build_sync_pairing_code(
    device_id: &str,
    salt: &[u8],
    fingerprint: &str,
    version: i64,
) -> String {
    let device_prefix = if device_id.is_empty() {
        "WB01".to_string()
    } else {
        device_id
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(4)
            .collect::<String>()
            .to_ascii_uppercase()
    };
    let device_b64 = BASE64_URL.encode(device_id.as_bytes());
    format!(
        "WB-{}-{}.{}.{}.{}",
        device_prefix,
        BASE64_URL.encode(salt),
        fingerprint,
        version,
        device_b64
    )
}

fn parse_sync_pairing_code(code: &str) -> Result<(String, Vec<u8>, String, i64), String> {
    let trimmed = code.trim();
    let parts: Vec<&str> = trimmed.split('.').collect();
    if parts.len() != 4 || !trimmed.starts_with("WB-") {
        return Err("Invalid pairing code format".to_string());
    }
    let header = parts[0].strip_prefix("WB-").unwrap_or_default();
    if header.len() < 5 {
        return Err("Invalid pairing code header".to_string());
    }
    let device_prefix = &header[..4];
    if !header[4..].starts_with('-') {
        return Err("Invalid pairing code header delimiter".to_string());
    }
    let salt_b64 = &header[5..];
    let salt = BASE64_URL
        .decode(salt_b64)
        .map_err(|_| "Invalid pairing code salt".to_string())?;
    let fingerprint = parts[1].to_lowercase();
    let version = parts[2]
        .parse::<i64>()
        .map_err(|_| "Invalid pairing code version".to_string())?;
    let remote_device_id = BASE64_URL
        .decode(parts[3])
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .unwrap_or_default();
    if device_prefix.len() != 4 || fingerprint.len() != 16 || version < 1 {
        return Err("Invalid pairing code fields".to_string());
    }
    Ok((remote_device_id, salt, fingerprint, version))
}

static PROVIDER_SECRET: OnceLock<[u8; 32]> = OnceLock::new();
const PROVIDER_KEY_NONCE_LEN: usize = 12;

fn provider_secret() -> Result<&'static [u8; 32], String> {
    PROVIDER_SECRET
        .get()
        .ok_or_else(|| "Provider encryption key is not initialized".to_string())
}

fn set_provider_secret(key: [u8; 32]) {
    let _ = PROVIDER_SECRET.set(key);
}

fn load_or_create_provider_secret(dir: &Path) -> Result<[u8; 32], String> {
    let path = dir.join("provider.key");
    if let Ok(hex) = fs::read_to_string(&path) {
        let decoded = hex.trim();
        if decoded.len() == 64 {
            let mut key = [0u8; 32];
            for (index, byte) in decoded.as_bytes().chunks(2).enumerate() {
                key[index] =
                    u8::from_str_radix(std::str::from_utf8(byte).map_err(|e| e.to_string())?, 16)
                        .map_err(|e| e.to_string())?;
            }
            return Ok(key);
        }
    }
    let rng = SystemRandom::new();
    let mut key = [0u8; 32];
    rng.fill(&mut key)
        .map_err(|e| format!("Failed to generate provider key: {}", e))?;
    let hex = key
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>();
    fs::write(&path, hex).map_err(|e| format!("Failed to write provider key: {}", e))?;
    Ok(key)
}

fn encrypt_provider_api_key(plain: &str, secret: &[u8; 32]) -> Result<String, String> {
    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; PROVIDER_KEY_NONCE_LEN];
    rng.fill(&mut nonce_bytes)
        .map_err(|e| format!("Random nonce failed: {}", e))?;
    let unbound =
        UnboundKey::new(&AES_256_GCM, secret).map_err(|e| format!("Key setup failed: {}", e))?;
    let sealing_key = LessSafeKey::new(unbound);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut in_out = plain.as_bytes().to_vec();
    sealing_key
        .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    let mut payload = Vec::with_capacity(nonce_bytes.len() + in_out.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&in_out);
    Ok(format!("enc:v1:{}", BASE64.encode(payload)))
}

fn decrypt_provider_api_key(envelope: &str, secret: &[u8; 32]) -> Result<String, String> {
    let stored = envelope
        .strip_prefix("enc:v1:")
        .ok_or_else(|| "Invalid encrypted provider key".to_string())?;
    let decoded = BASE64
        .decode(stored)
        .map_err(|_| "Invalid encrypted provider key".to_string())?;
    if decoded.len() <= PROVIDER_KEY_NONCE_LEN {
        return Err("Invalid encrypted provider key".to_string());
    }
    let nonce_bytes: [u8; PROVIDER_KEY_NONCE_LEN] = decoded[..PROVIDER_KEY_NONCE_LEN]
        .try_into()
        .map_err(|_| "Invalid encrypted provider key".to_string())?;
    let mut ciphertext = decoded[PROVIDER_KEY_NONCE_LEN..].to_vec();
    let unbound =
        UnboundKey::new(&AES_256_GCM, secret).map_err(|e| format!("Key setup failed: {}", e))?;
    let opening_key = LessSafeKey::new(unbound);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let plaintext = opening_key
        .open_in_place(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| "Provider key decryption failed".to_string())?;
    String::from_utf8(plaintext.to_vec()).map_err(|_| "Provider key is not valid UTF-8".to_string())
}

fn decrypt_provider(mut provider: db::Provider) -> Result<db::Provider, String> {
    if provider.api_key_encrypted {
        let secret = provider_secret()?;
        provider.api_key = decrypt_provider_api_key(&provider.api_key, secret)?;
        provider.api_key_encrypted = false;
    }
    Ok(provider)
}

fn decrypt_providers(providers: Vec<db::Provider>) -> Result<Vec<db::Provider>, String> {
    providers.into_iter().map(decrypt_provider).collect()
}

fn looks_like_keyring_ref(key: &str) -> bool {
    let trimmed = key.trim();
    !trimmed.is_empty()
        && trimmed.len() <= 64
        && trimmed
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
}

fn resolve_provider_api_key(provider: &db::Provider) -> Result<String, String> {
    if provider.api_key.is_empty() {
        return get_api_key("OPENAI_API_KEY");
    }
    if looks_like_keyring_ref(&provider.api_key) {
        return get_api_key(provider.api_key.trim());
    }
    Ok(provider.api_key.clone())
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderModel {
    id: String,
    owned_by: Option<String>,
}

fn parse_provider_models(body: &str, is_ollama: bool) -> Result<Vec<ProviderModel>, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let mut models = Vec::new();
    if is_ollama {
        if let Some(items) = value.get("models").and_then(|v| v.as_array()) {
            for item in items {
                if let Some(id) = item.get("name").and_then(|v| v.as_str()) {
                    models.push(ProviderModel {
                        id: id.to_string(),
                        owned_by: None,
                    });
                }
            }
        }
    } else if let Some(items) = value.get("data").and_then(|v| v.as_array()) {
        for item in items {
            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                let owned_by = item
                    .get("owned_by")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                models.push(ProviderModel {
                    id: id.to_string(),
                    owned_by,
                });
            }
        }
    }
    if models.is_empty() {
        Err("No models returned by provider".to_string())
    } else {
        Ok(models)
    }
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
        match resolve_provider_api_key(provider) {
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
    let provider = decrypt_provider(provider)?;
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
    let all = decrypt_providers(db::list_providers(&conn).map_err(|e| e.to_string())?)?;
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
    let provider = decrypt_provider(provider)?;
    drop(conn);
    let messages_json = serde_json::json!([{ "role": "user", "content": "ping" }]).to_string();
    let mut chunks = 0usize;
    let is_cancelled = || false;
    let timeout_secs = provider.timeout_secs.clamp(1, 300) as u64;
    let result = if is_ollama_provider(&provider.name, &provider.base_url) {
        let model = if provider.model.is_empty() {
            "qwen2.5:3b"
        } else {
            &provider.model
        };
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
            }
        };
        stream_ollama_with(
            "smoke",
            &provider.base_url,
            &messages_json,
            model,
            timeout_secs,
            &is_cancelled,
            &mut emit,
        )
    } else {
        let api_key = resolve_provider_api_key(&provider)?;
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
            }
        };
        let model = if provider.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &provider.model
        };
        stream_openai_compatible_with(
            "smoke",
            &provider.base_url,
            &api_key,
            &messages_json,
            model,
            timeout_secs,
            &is_cancelled,
            &mut emit,
        )
    };
    match result {
        Ok(_) => Ok(StreamSmokeResult {
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
fn run_provider_e2e_stream(
    state: State<'_, db::Db>,
    provider_id: String,
) -> Result<ProviderE2eResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let provider = db::get_provider(&conn, &provider_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;
    let provider = decrypt_provider(provider)?;
    drop(conn);
    let messages_json =
        serde_json::json!([{ "role": "user", "content": "Ping stream e2e" }]).to_string();
    let mut chunks = 0usize;
    let mut chars = 0usize;
    let started = std::time::Instant::now();
    let is_cancelled = || false;
    let timeout_secs = provider.timeout_secs.clamp(1, 300) as u64;
    let result = if is_ollama_provider(&provider.name, &provider.base_url) {
        let model = if provider.model.is_empty() {
            "qwen2.5:3b"
        } else {
            &provider.model
        };
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
                chars += chunk.delta.chars().count();
            }
        };
        stream_ollama_with(
            "e2e",
            &provider.base_url,
            &messages_json,
            model,
            timeout_secs,
            &is_cancelled,
            &mut emit,
        )
    } else {
        let api_key = resolve_provider_api_key(&provider)?;
        let mut emit = |chunk: &StreamChunk| {
            if !chunk.delta.is_empty() {
                chunks += 1;
                chars += chunk.delta.chars().count();
            }
        };
        let model = if provider.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &provider.model
        };
        stream_openai_compatible_with(
            "e2e",
            &provider.base_url,
            &api_key,
            &messages_json,
            model,
            timeout_secs,
            &is_cancelled,
            &mut emit,
        )
    };
    let duration_ms = started.elapsed().as_millis();
    match result {
        Ok(text) => Ok(ProviderE2eResult {
            ok: true,
            chunks,
            chars,
            duration_ms,
            message: text.chars().take(120).collect(),
        }),
        Err(err) => Ok(ProviderE2eResult {
            ok: false,
            chunks,
            chars,
            duration_ms,
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
    moa_chain: bool,
    run_id: String,
    auto_fallback: bool,
) -> Result<(), String> {
    let messages_json = serde_json::to_string(&messages).map_err(|e| e.to_string())?;
    let mut selected: Vec<db::Provider> = {
        let state = app.state::<db::Db>();
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut selected = Vec::new();
        for id in provider_ids {
            if let Some(p) = db::get_provider(&conn, &id).map_err(|e| e.to_string())? {
                selected.push(decrypt_provider(p)?);
            }
        }
        selected
    };
    if !auto_fallback {
        selected.sort_by_key(|provider| std::cmp::Reverse(provider.priority));
    }
    if selected.is_empty() {
        return Err("No providers configured".to_string());
    }

    let done: Result<(), String> = if moa && moa_chain {
        let providers: Vec<db::Provider> = selected.into_iter().take(3).collect();
        let total_steps = providers.len();
        let mut previous_name: Option<String> = None;
        let mut previous_output = String::new();
        let mut completed_steps = 0;
        for (index, provider) in providers.into_iter().enumerate() {
            if is_stream_cancelled(&app, &run_id) {
                break;
            }
            let sub_run_id = moa_lane_run_id(&run_id, "s", index);
            let step_messages_json = match &previous_name {
                Some(name) => append_moa_chain_context(&messages_json, name, &previous_output)?,
                None => messages_json.clone(),
            };
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: sub_run_id.clone(),
                    delta: format!("\n\n## {}\n\n", provider.name),
                    done: false,
                    error: None,
                    cancelled: false,
                },
            );
            let app_step = app.clone();
            let run_id_step = sub_run_id.clone();
            let provider_step = provider.clone();
            let streamed: Result<String, String> =
                tauri::async_runtime::spawn_blocking(move || {
                    stream_provider(&app_step, &run_id_step, &provider_step, &step_messages_json)
                })
                .await
                .map_err(|e| e.to_string())?;
            let sub_cancelled = is_stream_cancelled(&app, &sub_run_id);
            clear_stream_cancel(&app, &sub_run_id);
            match streamed {
                Ok(text) => {
                    let _ = app.emit(
                        "stream-chunk",
                        StreamChunk {
                            id: sub_run_id.clone(),
                            delta: String::new(),
                            done: true,
                            error: None,
                            cancelled: sub_cancelled,
                        },
                    );
                    completed_steps += 1;
                    if sub_cancelled {
                        break;
                    }
                    previous_output = text;
                    previous_name = Some(provider.name);
                }
                Err(err) => {
                    let _ = app.emit(
                        "stream-chunk",
                        StreamChunk {
                            id: sub_run_id,
                            delta: String::new(),
                            done: true,
                            error: if sub_cancelled {
                                None
                            } else {
                                Some(err.clone())
                            },
                            cancelled: sub_cancelled,
                        },
                    );
                    completed_steps += 1;
                    if sub_cancelled {
                        break;
                    }
                    previous_output = String::new();
                    previous_name = Some(provider.name);
                }
            }
        }
        for remaining in completed_steps..total_steps {
            let remaining_run_id = moa_lane_run_id(&run_id, "s", remaining);
            clear_stream_cancel(&app, &remaining_run_id);
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: remaining_run_id,
                    delta: String::new(),
                    done: true,
                    error: None,
                    cancelled: true,
                },
            );
        }
        Ok(())
    } else if moa {
        let mut tasks: Vec<tauri::async_runtime::JoinHandle<Result<Option<String>, String>>> =
            Vec::new();
        for (index, provider) in selected.into_iter().take(3).enumerate() {
            let app = app.clone();
            let sub_run_id = moa_lane_run_id(&run_id, "p", index);
            let messages_json = messages_json.clone();
            tasks.push(tauri::async_runtime::spawn_blocking(move || {
                if is_stream_cancelled(&app, &sub_run_id) {
                    return Ok(None);
                }
                let _ = app.emit(
                    "stream-chunk",
                    StreamChunk {
                        id: sub_run_id.clone(),
                        delta: format!("\n\n## {}\n\n", provider.name),
                        done: false,
                        error: None,
                        cancelled: false,
                    },
                );
                let streamed = stream_provider(&app, &sub_run_id, &provider, &messages_json);
                let sub_cancelled = is_stream_cancelled(&app, &sub_run_id);
                clear_stream_cancel(&app, &sub_run_id);
                match streamed {
                    Ok(text) => {
                        let _ = app.emit(
                            "stream-chunk",
                            StreamChunk {
                                id: sub_run_id.clone(),
                                delta: String::new(),
                                done: true,
                                error: None,
                                cancelled: sub_cancelled,
                            },
                        );
                        if sub_cancelled {
                            Ok(None)
                        } else {
                            Ok(Some(text))
                        }
                    }
                    Err(err) => {
                        let _ = app.emit(
                            "stream-chunk",
                            StreamChunk {
                                id: sub_run_id,
                                delta: String::new(),
                                done: true,
                                error: if sub_cancelled {
                                    None
                                } else {
                                    Some(err.clone())
                                },
                                cancelled: sub_cancelled,
                            },
                        );
                        Ok(None)
                    }
                }
            }));
        }
        let mut outputs = Vec::new();
        for task in tasks {
            let task_result = task.await.map_err(|e| e.to_string())?;
            if let Some(text) = task_result? {
                outputs.push(text);
            }
        }
        let parent_cancelled = is_stream_cancelled(&app, &run_id);
        let consensus_run_id = format!("{}-c", run_id);
        if parent_cancelled {
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: consensus_run_id,
                    delta: String::new(),
                    done: true,
                    error: None,
                    cancelled: true,
                },
            );
        } else {
            let consensus = build_moa_consensus_text(outputs);
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: consensus_run_id.clone(),
                    delta: format!("\n\n## MOA Consensus\n\n{}", consensus),
                    done: false,
                    error: None,
                    cancelled: false,
                },
            );
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: consensus_run_id,
                    delta: String::new(),
                    done: true,
                    error: None,
                    cancelled: false,
                },
            );
        }
        Ok(())
    } else {
        let providers = if auto_fallback {
            selected
        } else {
            selected.into_iter().take(1).collect::<Vec<_>>()
        };
        let total = providers.len();
        let mut last_error: Option<String> = None;
        let mut result: Result<(), String> = Err("All providers failed".to_string());
        for index in 0..total {
            let provider = providers[index].clone();
            let provider_name = provider.name.clone();
            let next_name = providers.get(index + 1).map(|next| next.name.clone());
            let app_clone = app.clone();
            let run_id_clone = run_id.clone();
            let messages_json = messages_json.clone();
            let streamed: Result<String, String> =
                tauri::async_runtime::spawn_blocking(move || {
                    stream_provider(&app_clone, &run_id_clone, &provider, &messages_json)
                })
                .await
                .map_err(|e| e.to_string())?;
            match streamed {
                Ok(_) => {
                    result = Ok(());
                    break;
                }
                Err(err) => {
                    last_error = Some(err);
                    if let Some(next_name) = next_name {
                        if auto_fallback {
                            let marker = auto_fallback_marker(&provider_name, &next_name);
                            let _ = app.emit(
                                "stream-chunk",
                                StreamChunk {
                                    id: run_id.clone(),
                                    delta: marker,
                                    done: false,
                                    error: None,
                                    cancelled: false,
                                },
                            );
                            let _ = app.emit(
                                "stream-fallback",
                                StreamFallback {
                                    id: run_id.clone(),
                                    from: provider_name,
                                    to: next_name,
                                },
                            );
                        }
                    }
                }
            }
        }
        if result.is_err() {
            result = Err(last_error.unwrap_or_else(|| "All providers failed".to_string()));
        }
        result
    };

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
    committer: String,
    last_commit_at: i64,
    changes: Vec<String>,
}

fn reflog_metadata_tokens(line: &str) -> Vec<&str> {
    line.split('\t')
        .next()
        .unwrap_or(line)
        .split_whitespace()
        .collect()
}

fn reflog_committer(line: &str) -> String {
    let tokens = reflog_metadata_tokens(line);
    if tokens.len() < 5 {
        return String::new();
    }
    let email_index = tokens.len() - 3;
    if email_index > 2 && tokens[email_index].starts_with('<') {
        return tokens[2..email_index].join(" ");
    }
    tokens.get(2).copied().unwrap_or("").to_string()
}

fn reflog_timestamp_ms(line: &str) -> i64 {
    let tokens = reflog_metadata_tokens(line);
    if tokens.len() < 5 {
        return 0;
    }
    tokens[tokens.len() - 2]
        .parse::<i64>()
        .ok()
        .unwrap_or(0)
        .saturating_mul(1000)
}

fn reflog_timestamps_ms(path: &str) -> Vec<i64> {
    let reflog_path = Path::new(path).join(".git").join("logs").join("HEAD");
    let Ok(content) = fs::read_to_string(&reflog_path) else {
        return Vec::new();
    };
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(reflog_timestamp_ms)
        .filter(|timestamp| *timestamp > 0)
        .collect()
}

fn git_change_paths(changes: &[String]) -> Vec<String> {
    changes
        .iter()
        .filter_map(|line| {
            let raw = line.trim_end();
            let has_status_prefix = raw.len() >= 3 && raw.as_bytes()[2] == b' ';
            let path = if has_status_prefix {
                raw.get(3..)?.trim()
            } else {
                raw.trim()
            };
            let path = path.split(" -> ").last().unwrap_or(path).trim();
            if path.is_empty() {
                None
            } else {
                Some(path.to_string())
            }
        })
        .collect()
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChangeGroup {
    path: String,
    status: String,
    group: String,
}

fn git_change_groups(changes: &[String]) -> Vec<GitChangeGroup> {
    changes
        .iter()
        .filter_map(|line| {
            let raw = line.trim_end();
            let has_status_prefix = raw.len() >= 3 && raw.as_bytes()[2] == b' ';
            let (status, raw_path) = if has_status_prefix {
                (raw.get(..2).unwrap_or("").to_string(), raw.get(3..)?)
            } else {
                (" ".to_string(), raw.trim())
            };
            let path = raw_path.split(" -> ").last().unwrap_or(raw_path).trim();
            if path.is_empty() {
                return None;
            }
            let group = if status == "??" {
                "untracked"
            } else {
                let bytes = status.as_bytes();
                let staged = bytes
                    .first()
                    .copied()
                    .is_some_and(|b| b != b' ' && b != b'?');
                let unstaged = bytes
                    .get(1)
                    .copied()
                    .is_some_and(|b| b != b' ' && b != b'?');
                if staged && unstaged {
                    "both"
                } else if staged {
                    "staged"
                } else {
                    "unstaged"
                }
            };
            Some(GitChangeGroup {
                path: path.to_string(),
                status,
                group: group.to_string(),
            })
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileDiff {
    path: String,
    status: String,
    diff: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileVersions {
    path: String,
    status: String,
    old_content: String,
    new_content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QualityGateLevel {
    level: u32,
    name: String,
    status: String,
    errors: Vec<String>,
    duration_ms: u64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderAuditProfile {
    id: String,
    name: String,
    base_url: String,
    model: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QualityGateResult {
    status: String,
    errors: Vec<String>,
    levels: Vec<QualityGateLevel>,
    provider_profile: Option<ProviderAuditProfile>,
}

struct CommandOutcome {
    exit_code: i32,
    text: String,
}

fn run_check_command(
    dir: &str,
    program: &str,
    args: &[&str],
    timeout_ms: u64,
) -> Result<CommandOutcome, String> {
    use std::process::Command;
    let resolved = verify_matrix::platform_program(program);
    let mut child = Command::new(&resolved)
        .args(args)
        .current_dir(dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("{} not available: {}", program, e))?;
    let start = std::time::Instant::now();
    loop {
        if let Some(_status) = child.try_wait().map_err(|e| e.to_string())? {
            let out = child.wait_with_output().map_err(|e| e.to_string())?;
            let mut text = String::from_utf8_lossy(&out.stdout).to_string();
            if !out.stderr.is_empty() {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(&String::from_utf8_lossy(&out.stderr));
            }
            return Ok(CommandOutcome {
                exit_code: out.status.code().unwrap_or(-1),
                text,
            });
        }
        if start.elapsed().as_millis() > timeout_ms as u128 {
            let _ = child.kill();
            return Err(format!("{} check timed out", program));
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

fn append_command_result(
    outcome: Result<CommandOutcome, String>,
    label: &str,
    errors: &mut Vec<String>,
    max_lines: usize,
) {
    match outcome {
        Ok(o) if o.exit_code == 0 => {}
        Ok(o) => {
            let meaningful: Vec<String> = o
                .text
                .lines()
                .filter(|l| {
                    let lower = l.to_lowercase();
                    lower.contains("error") || lower.contains("failed") || lower.contains("panic")
                })
                .take(max_lines)
                .map(|l| format!("{label}: {l}"))
                .collect();
            if meaningful.is_empty() {
                let trimmed = o.text.trim().to_string();
                if !trimmed.is_empty() {
                    errors.push(format!("{label}: {trimmed}"));
                } else {
                    errors.push(format!("{label}: command exited with {}", o.exit_code));
                }
            } else {
                errors.extend(meaningful);
            }
        }
        Err(e) => errors.push(format!("{label}: {e}")),
    }
}

fn semantic_evidence_summary(evidence: &verify_matrix::SemanticAuditEvidence) -> String {
    format!(
        "tasks {}/{} code {} doc {} other {} archived {}",
        evidence.checked_tasks,
        evidence.pending_tasks,
        evidence.code_files,
        evidence.doc_files,
        evidence.other_files,
        evidence.archived
    )
}

fn run_quality_gate_sync(
    path: &str,
    dod_path: Option<String>,
    provider_profile: Option<ProviderAuditProfile>,
) -> Result<QualityGateResult, String> {
    fn diff_added_text(hunk: &str) -> String {
        hunk.lines()
            .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
            .map(|line| &line[1..])
            .collect::<Vec<_>>()
            .join("\n")
    }

    let mut levels: Vec<QualityGateLevel> = Vec::new();
    let root = Path::new(path);
    let has_ts = root.join("tsconfig.json").exists();
    let has_pkg = root.join("package.json").exists();
    let cargo_dir = if root.join("Cargo.toml").exists() {
        Some(path.to_string())
    } else if root.join("src-tauri").join("Cargo.toml").exists() {
        Some(format!(
            "{}/src-tauri",
            path.trim_end_matches('/').trim_end_matches('\\')
        ))
    } else {
        None
    };
    let has_ui_verify = root.join("scripts").join("ui-verify.mjs").exists();
    let has_cargo = cargo_dir.is_some();
    let manifest = verify_matrix::load_manifest()?;
    if manifest.version < 1 {
        return Err("verify.matrix.json: unsupported manifest version".to_string());
    }

    fn requirement_met(
        requires: &str,
        has_ts: bool,
        has_pkg: bool,
        has_cargo: bool,
        has_ui_verify: bool,
    ) -> bool {
        match requires {
            "ts" => has_ts,
            "pkg" => has_pkg,
            "cargo" => has_cargo,
            "ui" => has_pkg && has_ui_verify,
            _ => true,
        }
    }

    for level_meta in &manifest.levels {
        if level_meta.level > 3 {
            continue;
        }
        let start = std::time::Instant::now();
        let mut errors: Vec<String> = Vec::new();
        for check in &level_meta.checks {
            if check.program == "internal" {
                continue;
            }
            if !requirement_met(&check.requires, has_ts, has_pkg, has_cargo, has_ui_verify) {
                continue;
            }
            let dir = match check.cwd.as_str() {
                "src-tauri" => match &cargo_dir {
                    Some(dir) => dir.clone(),
                    None => continue,
                },
                _ => path.to_string(),
            };
            let args: Vec<&str> = check.args.iter().map(String::as_str).collect();
            append_command_result(
                run_check_command(&dir, &check.program, &args, check.timeout_ms),
                &check.name,
                &mut errors,
                20,
            );
        }
        levels.push(QualityGateLevel {
            level: level_meta.level,
            name: level_meta.name.clone(),
            status: if errors.is_empty() {
                "GREEN".to_string()
            } else {
                "FAILED".to_string()
            },
            errors: errors.clone(),
            duration_ms: start.elapsed().as_millis() as u64,
        });
        if !errors.is_empty() && manifest.fail_fast == "level" {
            break;
        }
    }

    let mut l4_errors = Vec::new();
    let l4_start = std::time::Instant::now();
    let l4_meta = manifest.levels.iter().find(|level| level.level == 4);
    let ai_mode = l4_meta
        .and_then(|level| level.ai_audit.as_ref())
        .map(|audit| audit.mode.as_str())
        .unwrap_or("in-app");
    if levels.iter().all(|level| level.status == "GREEN") {
        match dod_path.as_deref().filter(|p| !p.trim().is_empty()) {
            Some(dod) => {
                let dod_abs = if Path::new(dod).is_absolute() {
                    dod.to_string()
                } else {
                    format!(
                        "{}/{}",
                        path.trim_end_matches('/').trim_end_matches('\\'),
                        dod.replace('\\', "/")
                    )
                };
                match fs::read_to_string(&dod_abs) {
                    Ok(dod_text) => {
                        let diff = get_project_diff_tree(path.to_string()).unwrap_or_default();
                        if diff.is_empty() {
                            // Nothing changed yet; semantic alignment cannot be proven, treat as green
                            // with a note so the DoD doc requirement remains visible.
                        } else {
                            let mut security_hits: Vec<String> = Vec::new();
                            let file_stats: Vec<(String, usize)> = diff
                                .iter()
                                .map(|file| (file.path.clone(), file.insertions))
                                .collect();
                            for file in &diff {
                                let added_text = diff_added_text(&file.hunk_preview);
                                security_hits.extend(verify_matrix::scan_security_hits(
                                    &file.path,
                                    &added_text,
                                    &manifest.security_rules,
                                ));
                            }
                            if ai_mode != "in-app" {
                                let semantic =
                                    verify_matrix::run_semantic_audit(Some(&dod_text), &file_stats);
                                if semantic.status == "FAIL" {
                                    l4_errors.extend(semantic.warnings.iter().take(5).cloned());
                                }
                                l4_errors.extend(semantic.errors.iter().take(10).cloned());
                                if !semantic.errors.is_empty() {
                                    l4_errors.push(format!(
                                        "semantic audit evidence: {}",
                                        semantic_evidence_summary(&semantic.evidence)
                                    ));
                                }
                            }
                            if ai_mode == "in-app" {
                                let dod_snippet: String = dod_text.chars().take(4000).collect();
                                let diff_summary: Vec<String> = diff
                                    .iter()
                                    .take(20)
                                    .map(|f| {
                                        format!("{}: +{}/-{}", f.path, f.insertions, f.deletions)
                                    })
                                    .collect();
                                let consensus = build_moa_consensus_inner(vec![
                                    format!("DoD:\n{}", dod_snippet),
                                    format!("Git diff 摘要:\n{}", diff_summary.join("\n")),
                                ]);
                                if consensus.summary.contains("No agent output") {
                                    l4_errors.push("QA/CISO 审查未生成有效结论".to_string());
                                }
                            }
                            l4_errors.extend(security_hits.iter().take(10).cloned());
                        }
                    }
                    Err(e) => l4_errors.push(format!("无法读取旅程文档（DoD）{}: {}", dod_abs, e)),
                }
            }
            None => {
                let diff = get_project_diff_tree(path.to_string()).unwrap_or_default();
                let file_stats: Vec<(String, usize)> = diff
                    .iter()
                    .map(|file| (file.path.clone(), file.insertions))
                    .collect();
                let semantic = verify_matrix::run_semantic_audit(None, &file_stats);
                if semantic.status == "FAIL" {
                    l4_errors.push("未提供旅程文档（DoD），无法执行语义对齐审查".to_string());
                }
            }
        }
    }
    levels.push(QualityGateLevel {
        level: 4,
        name: l4_meta
            .map(|level| level.name.clone())
            .unwrap_or_else(|| "AI DoD 语义对齐与安全审计".to_string()),
        status: if !l4_errors.is_empty() {
            "FAILED".to_string()
        } else {
            "GREEN".to_string()
        },
        errors: l4_errors.clone(),
        duration_ms: l4_start.elapsed().as_millis() as u64,
    });

    let errors: Vec<String> = levels
        .iter()
        .flat_map(|level| level.errors.clone())
        .collect();
    let status = if errors.is_empty() {
        "GREEN".to_string()
    } else {
        "FAILED".to_string()
    };
    Ok(QualityGateResult {
        status,
        errors,
        levels,
        provider_profile,
    })
}

#[tauri::command]
async fn run_quality_gate(
    path: String,
    dod_path: Option<String>,
    provider_profile: Option<ProviderAuditProfile>,
) -> Result<QualityGateResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_quality_gate_sync(&path, dod_path, provider_profile)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffFile {
    path: String,
    status: String,
    insertions: usize,
    deletions: usize,
    hunk_preview: String,
}

fn git_diff_stats(path: &str, git_file: &str) -> (usize, usize) {
    let diff = run_git(
        path,
        &["diff", "--numstat", "--", &git_file.replace('\\', "/")],
    )
    .unwrap_or_default();
    if let Some(line) = diff.lines().next() {
        return git_diff_stats_numstat(line);
    }
    (0, 0)
}

fn git_diff_stats_numstat(line: &str) -> (usize, usize) {
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 2 {
        let added = parts[0].parse::<usize>().unwrap_or(0);
        let deleted = parts[1].parse::<usize>().unwrap_or(0);
        return (added, deleted);
    }
    (0, 0)
}

fn porcelain_kind(line: &str) -> &'static str {
    if line.starts_with("??") {
        "Added"
    } else if line.starts_with("D") {
        "Deleted"
    } else {
        "Modified"
    }
}

#[tauri::command]
fn get_project_diff_tree(path: String) -> Result<Vec<GitDiffFile>, String> {
    let porcelain = run_git(&path, &["status", "--porcelain"]).unwrap_or_default();
    let mut files: Vec<GitDiffFile> = Vec::new();
    for line in porcelain.lines() {
        if line.len() < 3 {
            continue;
        }
        let file_part = line[3..].to_string();
        let git_file = file_part.replace('\\', "/");
        let status = porcelain_kind(line);
        let (add, del) = if status == "Added" {
            fs::read_to_string(Path::new(&path).join(&git_file))
                .map(|c| (c.lines().count(), 0usize))
                .unwrap_or((0, 0))
        } else {
            git_diff_stats(&path, &git_file)
        };
        let hunk = if status == "Deleted" {
            String::new()
        } else {
            get_git_file_diff(path.clone(), git_file.clone())
                .map(|d| truncate_hunk(&d.diff, 1200))
                .unwrap_or_default()
        };
        files.push(GitDiffFile {
            path: git_file,
            status: status.to_string(),
            insertions: add,
            deletions: del,
            hunk_preview: hunk,
        });
    }
    Ok(files)
}

fn truncate_hunk(diff: &str, max: usize) -> String {
    if diff.chars().count() <= max {
        diff.to_string()
    } else {
        let mut s: String = diff.chars().take(max).collect();
        s.push_str("\n... (truncated)");
        s
    }
}

#[tauri::command]
fn get_file_hunk_patch(path: String, relative_path: String) -> Result<GitFileDiff, String> {
    get_git_file_diff(path, relative_path)
}

fn read_untracked_diff(path: &str, file: &str) -> String {
    let display = file.replace('\\', "/");
    let target = Path::new(path).join(file);
    let content = fs::read_to_string(&target).unwrap_or_default();
    let mut out = format!(
        "diff --git a/{} b/{}\n--- /dev/null\n+++ b/{}\n",
        display, display, display
    );
    for line in content.lines() {
        out.push_str(&format!("+{}\n", line));
    }
    out
}

#[tauri::command]
fn get_git_file_diff(path: String, file: String) -> Result<GitFileDiff, String> {
    let git_file = file.replace('\\', "/");
    let status = run_git(&path, &["status", "--porcelain", "--", &git_file])
        .unwrap_or_default()
        .lines()
        .next()
        .map(|line| line.trim().to_string())
        .unwrap_or_else(|| "clean".to_string());
    let diff = if status.starts_with("??") {
        read_untracked_diff(&path, &file)
    } else {
        let tracked = run_git(
            &path,
            &["diff", "--no-ext-diff", "--unified=3", "--", &git_file],
        )
        .unwrap_or_default();
        if tracked.trim().is_empty() {
            run_git(
                &path,
                &[
                    "diff",
                    "--cached",
                    "--no-ext-diff",
                    "--unified=3",
                    "--",
                    &git_file,
                ],
            )
            .unwrap_or_default()
        } else {
            tracked
        }
    };
    Ok(GitFileDiff {
        path: file,
        status,
        diff,
    })
}

#[tauri::command]
fn get_git_file_versions(path: String, file: String) -> Result<GitFileVersions, String> {
    let git_file = file.replace('\\', "/");
    let status = run_git(&path, &["status", "--porcelain", "--", &git_file])
        .unwrap_or_default()
        .lines()
        .next()
        .map(|line| line.trim().to_string())
        .unwrap_or_else(|| "clean".to_string());
    let old_content = if status.starts_with("??") {
        String::new()
    } else {
        run_git(&path, &["show", &format!("HEAD:{git_file}")]).unwrap_or_default()
    };
    let new_content = fs::read_to_string(Path::new(&path).join(&file)).unwrap_or_default();
    Ok(GitFileVersions {
        path: file,
        status,
        old_content,
        new_content,
    })
}

#[tauri::command]
fn get_project_git_context(path: String) -> Result<GitContext, String> {
    let mut head = String::from("unknown");
    let mut branch = String::from("unknown");
    let mut commit_count = 0usize;
    let mut latest_commit = String::from("no commits");
    let mut committer = String::new();
    let mut last_commit_at = 0i64;
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
            let hash: String = last.split_whitespace().next().unwrap_or("").to_string();
            last_commit_at = reflog_timestamp_ms(last);
            committer = reflog_committer(last);
            let raw_message = last
                .split_once('\t')
                .map(|(_, message)| message.to_string())
                .unwrap_or_else(|| {
                    last.split_whitespace()
                        .skip(5)
                        .collect::<Vec<_>>()
                        .join(" ")
                });
            let message = raw_message
                .strip_prefix("commit:")
                .unwrap_or(&raw_message)
                .trim();
            latest_commit = format!(
                "{} {}",
                if hash.len() >= 8 { &hash[..8] } else { &hash },
                message
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
        committer,
        last_commit_at,
        changes,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitActivityItem {
    project_id: String,
    project_name: String,
    path: String,
    branch: String,
    commit_count: usize,
    latest_commit: String,
    committer: String,
    last_commit_at: i64,
    changed_files: usize,
    changed_paths: Vec<String>,
    change_groups: Vec<GitChangeGroup>,
    dirty: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitBucket {
    day_ms: i64,
    count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitTrend {
    granularity: String,
    buckets: Vec<GitCommitBucket>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitActivityBoard {
    total_projects: usize,
    total_commits: usize,
    dirty_projects: usize,
    committers: Vec<String>,
    items: Vec<GitActivityItem>,
    commit_trend: GitCommitTrend,
}

fn build_commit_trend(timestamps: Vec<i64>) -> GitCommitTrend {
    let mut counts = std::collections::BTreeMap::<i64, usize>::new();
    for timestamp in timestamps {
        let day = (timestamp / 86_400_000).saturating_mul(86_400_000);
        *counts.entry(day).or_insert(0) += 1;
    }
    let buckets = counts
        .into_iter()
        .rev()
        .take(7)
        .map(|(day_ms, count)| GitCommitBucket { day_ms, count })
        .collect();
    GitCommitTrend {
        granularity: "day".to_string(),
        buckets,
    }
}

fn build_git_activity(
    projects: Vec<db::Project>,
    since_ms: Option<i64>,
    until_ms: Option<i64>,
    committer: Option<String>,
) -> GitActivityBoard {
    let mut items = Vec::new();
    let mut committers = Vec::new();
    let mut seen_committers = std::collections::HashSet::new();
    let mut total_commits = 0usize;
    let mut dirty_projects = 0usize;
    let mut trend_timestamps = Vec::new();
    let committer_filter = committer
        .map(|filter| filter.trim().to_string())
        .filter(|filter| !filter.is_empty());
    for project in projects {
        let Some(path) = project.path.clone() else {
            continue;
        };
        let Ok(ctx) = get_project_git_context(path.clone()) else {
            continue;
        };
        if !ctx.committer.is_empty() && seen_committers.insert(ctx.committer.clone()) {
            committers.push(ctx.committer.clone());
        }
        if let Some(since) = since_ms {
            if ctx.last_commit_at < since {
                continue;
            }
        }
        if let Some(until) = until_ms {
            if ctx.last_commit_at > until {
                continue;
            }
        }
        if let Some(filter) = committer_filter.as_deref() {
            if !ctx.committer.eq_ignore_ascii_case(filter) {
                continue;
            }
        }
        trend_timestamps.extend(reflog_timestamps_ms(&path));
        let changed_files = ctx.changes.len();
        let dirty = changed_files > 0;
        if dirty {
            dirty_projects += 1;
        }
        total_commits += ctx.commit_count;
        items.push(GitActivityItem {
            project_id: project.id,
            project_name: project.name,
            path,
            branch: ctx.branch,
            commit_count: ctx.commit_count,
            latest_commit: ctx.latest_commit,
            committer: ctx.committer,
            last_commit_at: ctx.last_commit_at,
            changed_files,
            changed_paths: git_change_paths(&ctx.changes),
            change_groups: git_change_groups(&ctx.changes),
            dirty,
        });
    }
    committers.sort();
    items.sort_by_key(|item| std::cmp::Reverse(item.last_commit_at));
    GitActivityBoard {
        total_projects: items.len(),
        total_commits,
        dirty_projects,
        committers,
        items,
        commit_trend: build_commit_trend(trend_timestamps),
    }
}

#[tauri::command]
fn get_git_activity(
    state: State<'_, db::Db>,
    since_ms: Option<i64>,
    until_ms: Option<i64>,
    committer: Option<String>,
) -> Result<GitActivityBoard, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let projects = db::list_projects(&conn).map_err(|e| e.to_string())?;
    Ok(build_git_activity(projects, since_ms, until_ms, committer))
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
struct GitLintIssue {
    file: String,
    line: usize,
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
struct RemoteSyncPushResult {
    ok: bool,
    synced_at: i64,
    message: String,
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConflictResolutionResult {
    resolved: bool,
    strategy: String,
    files: Vec<String>,
    rebased: bool,
    branch: String,
    head: String,
    message: String,
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

fn run_commit_lint_gate_impl(path: &str, files: &[String]) -> Result<Vec<GitLintIssue>, String> {
    let mut issues = Vec::new();
    for file in files {
        let target = Path::new(path).join(file);
        let Ok(content) = fs::read_to_string(&target) else {
            issues.push(GitLintIssue {
                file: file.clone(),
                line: 0,
                message: "File could not be read".to_string(),
            });
            continue;
        };
        for (index, line) in content.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("<<<<<<<") || trimmed.starts_with(">>>>>>>") {
                issues.push(GitLintIssue {
                    file: file.clone(),
                    line: index + 1,
                    message: "Unresolved merge conflict marker".to_string(),
                });
            }
        }
        if file.to_lowercase().ends_with(".json")
            && serde_json::from_str::<Value>(&content).is_err()
        {
            issues.push(GitLintIssue {
                file: file.clone(),
                line: 0,
                message: "JSON is not valid".to_string(),
            });
        }
    }
    Ok(issues)
}

#[tauri::command]
fn run_commit_lint_gate(path: String, files: Vec<String>) -> Result<Vec<GitLintIssue>, String> {
    run_commit_lint_gate_impl(&path, &files)
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

fn finalize_commit(
    path: &str,
    message: &str,
    output: std::process::Output,
) -> Result<GitCommitResult, String> {
    let head = run_git(path, &["rev-parse", "HEAD"])?;
    let hash = head.chars().take(8).collect();
    let branch = git_branch(path);
    if output.status.success() {
        return Ok(GitCommitResult {
            committed: true,
            hash,
            branch,
            message: message.to_string(),
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
            message: message.to_string(),
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
    finalize_commit(&path, &message, output)
}

#[tauri::command]
fn commit_git_files(
    path: String,
    files: Vec<String>,
    message: String,
) -> Result<GitCommitResult, String> {
    if message.trim().is_empty() {
        return Err("Commit message is empty".into());
    }
    if files.is_empty() {
        return Err("No files selected".into());
    }
    let lint_issues = run_commit_lint_gate_impl(&path, &files)?;
    if !lint_issues.is_empty() {
        let detail = lint_issues
            .iter()
            .map(|issue| format!("{}:{} {}", issue.file, issue.line, issue.message))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!("Lint gate failed: {}", detail));
    }
    run_git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    let mut add_args: Vec<&str> = vec!["add", "--"];
    for file in &files {
        add_args.push(file.as_str());
    }
    run_git(&path, &add_args)?;
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;
    finalize_commit(&path, &message, output)
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

fn git_show_bytes(path: &str, spec: &str) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .args(["show", spec])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git show failed: {}", e))?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn resolve_file_with_union(path: &str, file: &str) -> Result<(), String> {
    let temp = std::env::temp_dir().join(format!("aiwb-union-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp).map_err(|e| format!("union temp dir failed: {}", e))?;
    let base_file = temp.join("base.txt");
    let ours_file = temp.join("ours.txt");
    let theirs_file = temp.join("theirs.txt");
    let base = git_show_bytes(path, &format!(":1:{}", file)).unwrap_or_default();
    let ours = git_show_bytes(path, &format!(":2:{}", file))?;
    let theirs = git_show_bytes(path, &format!(":3:{}", file))?;
    std::fs::write(&base_file, base).map_err(|e| e.to_string())?;
    std::fs::write(&ours_file, ours).map_err(|e| e.to_string())?;
    std::fs::write(&theirs_file, theirs).map_err(|e| e.to_string())?;
    let output = Command::new("git")
        .args([
            "merge-file",
            "-p",
            "--union",
            ours_file.to_str().unwrap_or_default(),
            base_file.to_str().unwrap_or_default(),
            theirs_file.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| format!("git merge-file failed: {}", e))?;
    let merge_detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        std::fs::remove_dir_all(&temp).map_err(|e| e.to_string())?;
        return Err(if merge_detail.is_empty() {
            format!("union merge failed for {}", file)
        } else {
            merge_detail
        });
    }
    let merged = output.stdout;
    std::fs::remove_dir_all(&temp).map_err(|e| e.to_string())?;
    let target = Path::new(path).join(file);
    std::fs::write(&target, merged).map_err(|e| format!("write resolved file failed: {}", e))?;
    run_git(path, &["add", "--", file])?;
    Ok(())
}

fn write_stage_to_file(path: &str, stage: &str, file: &str) -> Result<(), String> {
    let content = git_show_bytes(path, &format!(":{}:{}", stage, file))?;
    let target = Path::new(path).join(file);
    std::fs::write(&target, content).map_err(|e| format!("write resolved file failed: {}", e))?;
    run_git(path, &["add", "--", file])?;
    Ok(())
}

#[tauri::command]
fn resolve_rebase_conflicts(
    path: String,
    strategy: String,
) -> Result<ConflictResolutionResult, String> {
    let files = git_conflict_files(&path);
    if files.is_empty() {
        return Err("No rebase conflicts to resolve".into());
    }
    match strategy.as_str() {
        "ours" | "theirs" => {
            for file in &files {
                if strategy == "ours" {
                    write_stage_to_file(&path, "3", file)?;
                } else {
                    write_stage_to_file(&path, "2", file)?;
                }
            }
        }
        "union" => {
            for file in &files {
                resolve_file_with_union(&path, file)?;
            }
        }
        _ => {
            return Err(format!("Unsupported conflict strategy: {}", strategy));
        }
    }
    run_git(&path, &["add", "-A"])?;
    let branch = git_branch(&path);
    let output = Command::new("git")
        .args(["rebase", "--continue"])
        .current_dir(&path)
        .env("GIT_EDITOR", "true")
        .output()
        .map_err(|e| format!("git rebase --continue failed: {}", e))?;
    let head = short_head(&path);
    if output.status.success() {
        return Ok(ConflictResolutionResult {
            resolved: true,
            strategy: strategy.clone(),
            files: files.clone(),
            rebased: true,
            branch,
            head,
            message: format!(
                "Resolved {} conflicted file(s) with {} and continued rebase",
                files.len(),
                strategy.as_str()
            ),
        });
    }
    let remaining = git_conflict_files(&path);
    if !remaining.is_empty() {
        return Ok(ConflictResolutionResult {
            resolved: true,
            strategy,
            files: remaining,
            rebased: false,
            branch,
            head,
            message: "Conflicts resolved, rebase still in progress".to_string(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(truncate_error(format!("{}{}", stdout, stderr).trim()))
}

fn push_sync_payload_http(
    payload: &str,
    remote_url: &str,
    token: Option<&str>,
) -> Result<(), String> {
    let client = reqwest::blocking::Client::new();
    let mut request = client
        .put(remote_url)
        .header("Content-Type", "application/json")
        .body(payload.to_string());
    if let Some(token) = token.filter(|token| !token.trim().is_empty()) {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    let resp = request
        .send()
        .map_err(|e| format!("Remote sync failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "Remote sync {} : {}",
            resp.status(),
            resp.text().unwrap_or_default()
        ));
    }
    Ok(())
}

fn push_sync_snapshot_http(
    snapshot: &db::SyncSnapshot,
    remote_url: &str,
    token: Option<&str>,
) -> Result<RemoteSyncPushResult, String> {
    let payload = serde_json::to_string(snapshot)
        .map_err(|e| format!("Snapshot serialization failed: {}", e))?;
    push_sync_payload_http(&payload, remote_url, token)?;
    Ok(RemoteSyncPushResult {
        ok: true,
        synced_at: snapshot.exported_at,
        message: "Pushed snapshot to remote".to_string(),
    })
}

fn pull_sync_payload_http(remote_url: &str, token: Option<&str>) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let mut request = client.get(remote_url);
    if let Some(token) = token.filter(|token| !token.trim().is_empty()) {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    let resp = request
        .send()
        .map_err(|e| format!("Remote sync failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "Remote sync {} : {}",
            resp.status(),
            resp.text().unwrap_or_default()
        ));
    }
    resp.text()
        .map_err(|e| format!("Failed to read remote snapshot: {}", e))
}

fn pull_sync_snapshot_http(
    remote_url: &str,
    token: Option<&str>,
) -> Result<db::SyncSnapshot, String> {
    let body = pull_sync_payload_http(remote_url, token)?;
    serde_json::from_str(&body).map_err(|e| format!("Invalid remote snapshot: {}", e))
}

fn deliver_webhook_http(
    url: &str,
    payload: &str,
    method: &str,
    token: Option<&str>,
    secret: Option<&str>,
    retries: u32,
) -> Result<WebhookDeliveryResult, String> {
    let method = method.trim().to_uppercase();
    if !matches!(method.as_str(), "POST" | "PUT" | "PATCH" | "GET" | "DELETE") {
        return Err(format!("Unsupported webhook method: {}", method));
    }
    let payload = if payload.trim().is_empty() {
        "{}"
    } else {
        payload
    };
    if serde_json::from_str::<Value>(payload).is_err() {
        return Err("Webhook payload is not valid JSON".to_string());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());
    let started = std::time::Instant::now();
    let signed = secret
        .map(|secret| !secret.trim().is_empty())
        .unwrap_or(false);
    let max_attempts = retries.saturating_add(1).max(1);
    let mut last: Option<Result<WebhookDeliveryResult, String>> = None;
    for attempt in 0..max_attempts {
        let mut request = match method.as_str() {
            "GET" => client.get(url),
            "DELETE" => client.delete(url),
            "PUT" => client.put(url),
            "PATCH" => client.patch(url),
            _ => client.post(url),
        };
        if let Some(token) = token.filter(|token| !token.trim().is_empty()) {
            request = request.header("Authorization", format!("Bearer {}", token.trim()));
        }
        if signed {
            request = request
                .header(
                    "X-Webhook-Signature",
                    format!(
                        "sha256={}",
                        webhook_signature(secret.unwrap_or_default().trim(), payload)
                    ),
                )
                .header("X-Webhook-Timestamp", now_millis().to_string());
        }
        let request = if matches!(method.as_str(), "POST" | "PUT" | "PATCH") {
            request
                .header("Content-Type", "application/json")
                .body(payload.to_string())
        } else {
            request
        };
        match request.send() {
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().unwrap_or_default();
                let summary = if body.trim().is_empty() {
                    "empty response".to_string()
                } else {
                    body.chars().take(400).collect::<String>()
                };
                let result = WebhookDeliveryResult {
                    ok: status.is_success(),
                    status: status.as_u16(),
                    duration_ms: started.elapsed().as_millis(),
                    attempts: attempt + 1,
                    signed,
                    message: format!("HTTP {} {}", status.as_u16(), summary),
                };
                if status.is_success() || attempt + 1 >= max_attempts {
                    return Ok(result);
                }
                last = Some(Ok(result));
            }
            Err(err) => {
                if attempt + 1 >= max_attempts {
                    return Err(format!("Webhook delivery failed: {}", err));
                }
                last = Some(Err(format!("Webhook delivery failed: {}", err)));
            }
        }
        thread::sleep(Duration::from_millis(
            50_u64.saturating_mul(1 << attempt.min(6)),
        ));
    }
    last.unwrap_or_else(|| Err("Webhook delivery failed".to_string()))
}

fn build_event_forward_payload(log: &db::EventLogRecord) -> String {
    let context = serde_json::from_str::<Value>(&log.context)
        .unwrap_or_else(|_| Value::Object(Default::default()));
    serde_json::json!({
        "id": log.id,
        "event": log.event,
        "context": context,
        "source": log.source,
        "deviceId": log.device_id,
        "schemaVersion": log.schema_version,
        "status": log.status,
        "rejectedReason": log.rejected_reason,
        "createdAt": log.created_at,
    })
    .to_string()
}

fn spawn_event_forward_worker(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(2));
        let Some(state) = app.try_state::<db::Db>() else {
            continue;
        };
        let now = now_millis();
        let claimed = {
            let Ok(conn) = state.0.lock() else {
                continue;
            };
            if let Ok(config) = db::get_event_bus_config(&conn) {
                if config.forward_enabled {
                    let _ = db::prune_event_logs(&conn, config.retention_days, config.max_logs);
                }
            }
            let Ok(claimed) = db::claim_due_event_forwards(&conn, now, 8) else {
                continue;
            };
            claimed
        };
        for forward in claimed {
            let log = state.0.lock().ok().and_then(|conn| {
                db::get_event_log(&conn, &forward.event_log_id)
                    .ok()
                    .flatten()
            });
            let Some(log) = log else {
                let Ok(conn) = state.0.lock() else {
                    continue;
                };
                let _ = db::complete_event_forward(
                    &conn,
                    &forward.id,
                    "dead",
                    0,
                    "Event log not found",
                    forward.attempts + 1,
                    now,
                );
                continue;
            };
            let payload = build_event_forward_payload(&log);
            let token = if forward.target_token.trim().is_empty() {
                None
            } else {
                Some(forward.target_token.as_str())
            };
            let outcome =
                deliver_webhook_http(&forward.target_url, &payload, "POST", token, None, 0);
            let (ok, status, message) = match outcome {
                Ok(result) => (true, result.status as i64, result.message),
                Err(err) => (false, 0, format!("Event forward failed: {}", err)),
            };
            let attempts = forward.attempts + 1;
            let dead = !ok && attempts >= 5;
            let next_attempt_at = if ok || dead {
                now
            } else {
                now + 1000 * (1_i64 << attempts.min(6))
            };
            let forward_status = if dead {
                "dead"
            } else if ok {
                "success"
            } else {
                "queued"
            };
            let Ok(conn) = state.0.lock() else {
                continue;
            };
            let _ = db::complete_event_forward(
                &conn,
                &forward.id,
                forward_status,
                status,
                &message,
                attempts,
                next_attempt_at,
            );
        }
    });
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventEmitRequest {
    event: String,
    context: Option<Value>,
    source: Option<String>,
    device_id: Option<String>,
}

#[tauri::command]
fn emit_event_bus_event(
    state: State<'_, db::Db>,
    request: EventEmitRequest,
) -> Result<db::EventEmitResult, String> {
    let event = request.event.trim().to_string();
    if event.is_empty() {
        return Err("Event name is required".to_string());
    }
    let context = request
        .context
        .unwrap_or_else(|| Value::Object(Default::default()));
    let (recorded, validated, rejected_reason, forwarded) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let log = db::record_event_log(
            &conn,
            &event,
            &context,
            request.source.as_deref().unwrap_or("workbench"),
            request.device_id.as_deref().unwrap_or(""),
        )
        .map_err(|e| e.to_string())?;
        let validated = log.status == "accepted";
        let config = db::get_event_bus_config(&conn).map_err(|e| e.to_string())?;
        let forwarded =
            if validated && config.forward_enabled && !config.forward_url.trim().is_empty() {
                let _ = db::enqueue_event_forward(
                    &conn,
                    &log.id,
                    &config.forward_url,
                    &config.forward_token,
                )
                .map_err(|e| e.to_string())?;
                1
            } else {
                0
            };
        (true, validated, log.rejected_reason.clone(), forwarded)
    };
    let webhook_deliveries = 0;
    Ok(db::EventEmitResult {
        event,
        recorded,
        validated,
        rejected_reason,
        forwarded,
        webhook_deliveries,
    })
}

#[tauri::command]
fn list_event_logs(
    state: State<'_, db::Db>,
    limit: Option<i64>,
    event: Option<String>,
) -> Result<Vec<db::EventLogRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_event_logs(&conn, limit.unwrap_or(50), &event.unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_event_logs(state: State<'_, db::Db>, status: Option<String>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_event_logs(&conn, &status.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_event_schema(
    state: State<'_, db::Db>,
    event: String,
) -> Result<Option<db::EventSchema>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_event_schema(&conn, &event).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventSchemaRequest {
    event: String,
    schema: String,
    enabled: bool,
}

#[tauri::command]
fn set_event_schema(
    state: State<'_, db::Db>,
    request: EventSchemaRequest,
) -> Result<db::EventSchema, String> {
    if request.event.trim().is_empty() {
        return Err("Event name is required".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_event_schema(
        &conn,
        request.event.trim(),
        &request.schema,
        request.enabled,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_event_schemas(state: State<'_, db::Db>) -> Result<Vec<db::EventSchema>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_event_schemas(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_event_bus_config(state: State<'_, db::Db>) -> Result<db::EventBusConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_event_bus_config(&conn).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventBusConfigRequest {
    forward_enabled: bool,
    forward_url: String,
    forward_token: String,
    retention_days: i64,
    max_logs: i64,
    schema_strict: bool,
}

#[tauri::command]
fn set_event_bus_config(
    state: State<'_, db::Db>,
    request: EventBusConfigRequest,
) -> Result<db::EventBusConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_event_bus_config(
        &conn,
        request.forward_enabled,
        &request.forward_url,
        &request.forward_token,
        request.retention_days,
        request.max_logs,
        request.schema_strict,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_event_forwards(
    state: State<'_, db::Db>,
    limit: Option<i64>,
    status: Option<String>,
) -> Result<Vec<db::EventForwardRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_event_forwards(&conn, limit.unwrap_or(50), &status.unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn retry_event_forward(
    state: State<'_, db::Db>,
    id: String,
) -> Result<db::EventForwardRecord, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::retry_event_forward(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_event_forward(state: State<'_, db::Db>, id: String) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_event_forward(&conn, &id).map_err(|e| e.to_string())?;
    Ok(format!(
        "Deleted event forward {}",
        id.chars().take(8).collect::<String>()
    ))
}

#[tauri::command]
fn clear_event_forwards(state: State<'_, db::Db>, status: Option<String>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_event_forwards(&conn, &status.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_event_bus_stats(state: State<'_, db::Db>) -> Result<db::EventBusStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_event_bus_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn push_sync_snapshot(
    state: State<'_, db::Db>,
    remote_url: String,
    token: Option<String>,
    passphrase: Option<String>,
) -> Result<RemoteSyncPushResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let snapshot = db::build_sync_snapshot(&conn).map_err(|e| e.to_string())?;
    drop(conn);
    if let Some(secret) = passphrase.filter(|pass| !pass.trim().is_empty()) {
        let payload = serde_json::to_string(&snapshot)
            .map_err(|e| format!("Snapshot serialization failed: {}", e))?;
        let envelope = encrypt_sync_payload(&payload, &secret)?;
        push_sync_payload_http(&envelope, &remote_url, token.as_deref())?;
        return Ok(RemoteSyncPushResult {
            ok: true,
            synced_at: snapshot.exported_at,
            message: "Pushed encrypted snapshot to remote".to_string(),
        });
    }
    push_sync_snapshot_http(&snapshot, &remote_url, token.as_deref())
}

#[tauri::command]
fn pull_sync_snapshot(
    state: State<'_, db::Db>,
    remote_url: String,
    token: Option<String>,
    passphrase: Option<String>,
) -> Result<db::SyncResult, String> {
    let payload = if let Some(secret) = passphrase.filter(|pass| !pass.trim().is_empty()) {
        let envelope = pull_sync_payload_http(&remote_url, token.as_deref())?;
        decrypt_sync_payload(&envelope, &secret)?
    } else {
        let snapshot = pull_sync_snapshot_http(&remote_url, token.as_deref())?;
        serde_json::to_string(&snapshot)
            .map_err(|e| format!("Snapshot serialization failed: {}", e))?
    };
    let snapshot: db::SyncSnapshot =
        serde_json::from_str(&payload).map_err(|e| format!("Invalid remote snapshot: {}", e))?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::merge_sync_snapshot(&conn, snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
fn encrypt_sync_payload_command(payload: String, passphrase: String) -> Result<String, String> {
    encrypt_sync_payload(&payload, &passphrase)
}

#[tauri::command]
fn decrypt_sync_payload_command(envelope: String, passphrase: String) -> Result<String, String> {
    decrypt_sync_payload(&envelope, &passphrase)
}

#[tauri::command]
fn export_encrypted_sync_snapshot(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    passphrase: String,
) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let snapshot = db::export_sync_snapshot(&conn, &dir.join("sync-snapshot.json"))
        .map_err(|e| e.to_string())?;
    drop(conn);
    let payload = serde_json::to_string(&snapshot)
        .map_err(|e| format!("Snapshot serialization failed: {}", e))?;
    let envelope = encrypt_sync_payload(&payload, &passphrase)?;
    fs::write(dir.join("sync-snapshot.enc.json"), &envelope)
        .map_err(|e| format!("Failed to write encrypted snapshot: {}", e))?;
    Ok(envelope)
}

#[tauri::command]
fn import_encrypted_sync_snapshot(
    app: tauri::AppHandle,
    state: State<'_, db::Db>,
    passphrase: String,
) -> Result<db::SyncResult, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let envelope = fs::read_to_string(dir.join("sync-snapshot.enc.json"))
        .map_err(|_| "Encrypted sync snapshot not found".to_string())?;
    let payload = decrypt_sync_payload(&envelope, &passphrase)?;
    let snapshot: db::SyncSnapshot =
        serde_json::from_str(&payload).map_err(|e| format!("Invalid encrypted snapshot: {}", e))?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::merge_sync_snapshot(&conn, snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_passphrase_strength(passphrase: String) -> db::PassphraseStrength {
    db::assess_passphrase_strength(&passphrase)
}

#[tauri::command]
fn get_sync_key_status(state: State<'_, db::Db>) -> Result<db::SyncKeyStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_sync_key_status(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sync_key_versions(state: State<'_, db::Db>) -> Result<Vec<db::SyncKeyVersion>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_sync_key_versions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn register_sync_passphrase(
    state: State<'_, db::Db>,
    device_id: String,
    passphrase: String,
) -> Result<db::SyncCredential, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let strength = db::assess_passphrase_strength(&passphrase);
    if strength.score < 40 {
        return Err(
            "Passphrase is too weak; use at least 8 characters with mixed cases".to_string(),
        );
    }
    let rng = SystemRandom::new();
    let mut salt = [0u8; SYNC_SALT_LEN];
    rng.fill(&mut salt)
        .map_err(|e| format!("Random salt failed: {}", e))?;
    let key = derive_sync_key(&passphrase, &salt)?;
    let fingerprint = sync_key_fingerprint(&key);
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::register_sync_key_version(
        &conn,
        &device_id,
        &hex_encode(&salt),
        &fingerprint,
        "AES-256-GCM",
        SYNC_PBKDF2_ITERATIONS as i64,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn confirm_sync_passphrase(
    state: State<'_, db::Db>,
    passphrase: String,
) -> Result<db::SyncCredential, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let credential = db::get_sync_credential(&conn, "").map_err(|e| e.to_string())?;
    if credential.active_key_version == 0 {
        return Err("Register a sync passphrase before confirming".to_string());
    }
    let row = conn
        .query_row(
            "SELECT salt FROM sync_key_versions
             WHERE device_id = ?1 AND version = ?2",
            params![credential.device_id, credential.active_key_version],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| e.to_string())?;
    let salt = hex_to_bytes(&row)?;
    let key = derive_sync_key(&passphrase, &salt)?;
    let fingerprint = sync_key_fingerprint(&key);
    db::confirm_sync_credential(&conn, &fingerprint).map_err(|e| e.to_string())
}

#[tauri::command]
fn rotate_sync_passphrase(
    state: State<'_, db::Db>,
    device_id: String,
    passphrase: String,
) -> Result<db::SyncCredential, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let strength = db::assess_passphrase_strength(&passphrase);
    if strength.score < 40 {
        return Err(
            "Passphrase is too weak; use at least 8 characters with mixed cases".to_string(),
        );
    }
    let rng = SystemRandom::new();
    let mut salt = [0u8; SYNC_SALT_LEN];
    rng.fill(&mut salt)
        .map_err(|e| format!("Random salt failed: {}", e))?;
    let key = derive_sync_key(&passphrase, &salt)?;
    let fingerprint = sync_key_fingerprint(&key);
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let credential = db::get_sync_credential(&conn, &device_id).map_err(|e| e.to_string())?;
    if credential.active_key_version == 0 {
        return Err("Register a sync passphrase before rotating".to_string());
    }
    db::register_sync_key_version(
        &conn,
        &device_id,
        &hex_encode(&salt),
        &fingerprint,
        "AES-256-GCM",
        SYNC_PBKDF2_ITERATIONS as i64,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sync_pairing_code(state: State<'_, db::Db>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let credential = db::get_sync_credential(&conn, "").map_err(|e| e.to_string())?;
    if credential.active_key_version == 0 {
        return Err("Register a sync passphrase before generating a pairing code".to_string());
    }
    let row = conn.query_row(
        "SELECT salt, fingerprint FROM sync_key_versions
         WHERE device_id = ?1 AND version = ?2",
        params![credential.device_id, credential.active_key_version],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    );
    let (salt_hex, fingerprint) = row.map_err(|e| e.to_string())?;
    let salt = hex_to_bytes(&salt_hex)?;
    Ok(build_sync_pairing_code(
        &credential.device_id,
        &salt,
        &fingerprint,
        credential.active_key_version,
    ))
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    if !hex.len().is_multiple_of(2) {
        return Err("Invalid salt hex".to_string());
    }
    let mut out = Vec::with_capacity(hex.len() / 2);
    for index in (0..hex.len()).step_by(2) {
        let byte = u8::from_str_radix(&hex[index..index + 2], 16)
            .map_err(|_| "Invalid salt hex".to_string())?;
        out.push(byte);
    }
    Ok(out)
}

#[tauri::command]
fn verify_sync_pairing_code(
    state: State<'_, db::Db>,
    pairing_code: String,
    passphrase: String,
) -> Result<db::SyncPairedDevice, String> {
    if passphrase.trim().is_empty() {
        return Err("Passphrase is required".to_string());
    }
    let (remote_device_id, remote_salt, remote_fingerprint, remote_version) =
        parse_sync_pairing_code(&pairing_code)?;
    let remote_key = derive_sync_key(&passphrase, &remote_salt)?;
    let expected = sync_key_fingerprint(&remote_key);
    if expected != remote_fingerprint {
        return Err("Pairing code does not match this passphrase".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let remote_device_id = if remote_device_id.trim().is_empty() {
        format!("remote-{}", &remote_fingerprint[..8])
    } else {
        remote_device_id.trim().to_string()
    };
    db::upsert_sync_paired_device(
        &conn,
        &remote_device_id,
        &remote_fingerprint,
        pairing_code.trim(),
        remote_version,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sync_paired_devices(state: State<'_, db::Db>) -> Result<Vec<db::SyncPairedDevice>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_sync_paired_devices(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_sync_paired_device(
    state: State<'_, db::Db>,
    remote_device_id: String,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::remove_sync_paired_device(&conn, &remote_device_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_sync_conflict(
    state: State<'_, db::Db>,
    conflict: db::SyncConflictItem,
    choice: String,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflict(&conn, &conflict, &choice)?;
    Ok(format!(
        "Resolved {} conflict {} with {}",
        conflict.kind, conflict.id, choice
    ))
}

#[tauri::command]
fn resolve_sync_conflicts(
    state: State<'_, db::Db>,
    conflicts: Vec<db::SyncConflictItem>,
    choice: String,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflicts(&conn, &conflicts, &choice).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_sync_conflict_union(
    state: State<'_, db::Db>,
    conflict: db::SyncConflictItem,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflict_union(&conn, &conflict).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_sync_conflicts_union(
    state: State<'_, db::Db>,
    conflicts: Vec<db::SyncConflictItem>,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflicts_union(&conn, &conflicts).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_sync_conflict_structured(
    state: State<'_, db::Db>,
    conflict: db::SyncConflictItem,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflict_structured(&conn, &conflict).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_sync_conflicts_structured(
    state: State<'_, db::Db>,
    conflicts: Vec<db::SyncConflictItem>,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::resolve_conflicts_structured(&conn, &conflicts).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sync_conflicts(
    state: State<'_, db::Db>,
    status: String,
) -> Result<Vec<db::SyncConflictRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_sync_conflicts(&conn, &status).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_resolved_sync_conflicts(state: State<'_, db::Db>) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_resolved_sync_conflicts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sync_audit(
    state: State<'_, db::Db>,
    limit: Option<i64>,
    event: Option<String>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<String>,
) -> Result<Vec<db::SyncAuditEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(until) = until {
        db::list_sync_audit_range(
            &conn,
            limit.unwrap_or(50).clamp(1, 200),
            event.as_deref(),
            since,
            Some(until),
            device_id.as_deref(),
        )
        .map_err(|e| e.to_string())
    } else {
        db::list_sync_audit(
            &conn,
            limit.unwrap_or(50).clamp(1, 200),
            event.as_deref(),
            since,
            device_id.as_deref(),
        )
        .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn export_sync_audit(
    state: State<'_, db::Db>,
    format: Option<String>,
    event: Option<String>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<String>,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(until) = until {
        db::export_sync_audit_range(
            &conn,
            &format.unwrap_or_else(|| "json".to_string()),
            event.as_deref(),
            since,
            Some(until),
            device_id.as_deref(),
        )
        .map_err(|e| e.to_string())
    } else {
        db::export_sync_audit(
            &conn,
            &format.unwrap_or_else(|| "json".to_string()),
            event.as_deref(),
            since,
            device_id.as_deref(),
        )
        .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_sync_audit_summary(
    state: State<'_, db::Db>,
    granularity: String,
    event: Option<String>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<String>,
) -> Result<db::SyncAuditSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::sync_audit_summary_range(
        &conn,
        &granularity,
        event.as_deref(),
        since,
        until,
        device_id.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_sync_audit(state: State<'_, db::Db>) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_sync_audit(&conn).map_err(|e| e.to_string())
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

fn moa_first_line(content: &str) -> String {
    content
        .lines()
        .map(str::trim)
        .find(|line| {
            !line.is_empty()
                && !line.starts_with("**")
                && !line.starts_with('-')
                && !line.starts_with('[')
                && !line.starts_with("## ")
        })
        .unwrap_or("No output")
        .chars()
        .take(140)
        .collect()
}

fn moa_keywords(contents: &[String]) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "a",
        "an",
        "the",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "it",
        "this",
        "that",
        "you",
        "your",
        "we",
        "our",
        "i",
        "as",
        "at",
        "by",
        "from",
        "not",
        "but",
        "if",
        "then",
        "can",
        "will",
        "should",
        "would",
        "please",
        "output",
        "outputs",
        "streaming",
        "fallback",
    ];
    let mut counts: HashMap<String, usize> = HashMap::new();
    for content in contents {
        let mut seen = HashSet::new();
        for token in content.split(|c: char| !c.is_alphanumeric()) {
            let token = token.trim();
            if token.chars().count() < 2 {
                continue;
            }
            let lower = token.to_lowercase();
            if STOPWORDS.contains(&lower.as_str()) || lower.chars().all(|c| c.is_ascii_digit()) {
                continue;
            }
            seen.insert(lower);
        }
        for token in seen {
            *counts.entry(token).or_default() += 1;
        }
    }
    let mut keywords: Vec<(String, usize)> = counts
        .into_iter()
        .filter(|(_, count)| *count >= 2)
        .collect();
    keywords.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    keywords.truncate(3);
    keywords.into_iter().map(|(token, _)| token).collect()
}

fn moa_viewpoints(contents: &[String]) -> Vec<String> {
    let lines: Vec<String> = contents
        .iter()
        .map(|content| moa_first_line(content))
        .collect();
    let mut viewpoints = Vec::new();
    for line in &lines {
        let shared = lines.iter().all(|other| other == line);
        if !shared && !viewpoints.contains(line) {
            viewpoints.push(line.clone());
        }
    }
    if viewpoints.is_empty() && !lines.is_empty() {
        viewpoints.push(lines[0].clone());
    }
    viewpoints.truncate(3);
    viewpoints
}

fn build_moa_consensus_inner(contents: Vec<String>) -> MoaConsensus {
    let first_lines: Vec<String> = contents
        .iter()
        .map(|content| moa_first_line(content))
        .collect();
    let common = moa_keywords(&contents);
    let viewpoints = moa_viewpoints(&contents);
    let mut summary = String::new();
    if contents.is_empty() || first_lines.iter().all(|line| line == "No output") {
        summary.push_str("No agent output collected.");
    } else {
        summary.push_str("共识点：\n");
        if common.is_empty() {
            summary.push_str("- 各输出均有有效回答\n");
        } else {
            for keyword in &common {
                summary.push_str(&format!("- {}\n", keyword));
            }
        }
        summary.push_str("\n分歧/独特观点：\n");
        for viewpoint in &viewpoints {
            summary.push_str(&format!("- {}\n", viewpoint));
        }
        summary.push_str("\n结论：\n");
        for (index, line) in first_lines.iter().enumerate() {
            summary.push_str(&format!("- Output {}: {}\n", index + 1, line));
        }
    }
    MoaConsensus {
        summary,
        common,
        viewpoints,
    }
}

#[tauri::command]
fn build_moa_consensus(contents: Vec<String>) -> Result<MoaConsensus, String> {
    Ok(build_moa_consensus_inner(contents))
}

fn build_moa_consensus_text(contents: Vec<String>) -> String {
    build_moa_consensus_inner(contents).summary
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
                selected.push(decrypt_provider(p)?);
            }
        }
        selected
    };
    selected.sort_by_key(|provider| std::cmp::Reverse(provider.priority));

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
        Ok(format!(
            "MOA consensus\n\n{}",
            build_moa_consensus_text(parts.to_vec())
        ))
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
            let provider_key =
                load_or_create_provider_secret(&dir).expect("load provider encryption key");
            set_provider_secret(provider_key);
            let conn = db::init_connection(&dir.join("workbench.db")).expect("init db");
            app.manage(db::Db(std::sync::Mutex::new(conn)));
            app.manage(StreamCancellation::default());
            app.manage(ProviderHeartbeat::default());
            spawn_clipboard_monitor(app.handle().clone());
            spawn_provider_heartbeat_monitor(app.handle().clone());
            spawn_event_forward_worker(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_secret,
            get_secret,
            delete_secret,
            send_chat_message,
            run_codex,
            cli_spawn::spawn_cli_process,
            fetch_url,
            fetch_rss,
            write_note,
            read_vault_notes,
            init_db,
            list_tasks,
            create_task,
            update_task_status,
            set_task_today,
            set_task_due_date,
            update_task_title,
            delete_task,
            list_projects,
            create_project,
            update_project,
            update_project_material,
            update_project_journey,
            write_journey_doc,
            delete_project,
            reorder_projects,
            list_project_revenue_history,
            list_thoughts,
            create_thought,
            update_thought_tags,
            update_thought_content,
            record_thought_reference,
            open_obsidian,
            update_thought_type,
            delete_thought,
            list_providers,
            create_provider,
            set_provider_active,
            set_provider_priority,
            update_provider_model,
            update_provider_stream_config,
            export_providers,
            import_providers,
            list_provider_models,
            list_cached_provider_models,
            refresh_provider_models,
            update_provider_model_meta,
            set_provider_model_favorite,
            touch_provider_model_usage,
            list_departments,
            list_agents,
            create_department,
            create_agent,
            update_agent_system_prompt,
            list_agent_prompt_versions,
            restore_agent_prompt,
            list_agent_catalog,
            import_agent_catalog,
            list_team_presets,
            create_team_preset,
            update_team_preset,
            delete_team_preset,
            list_cli_tools,
            detect_cli_tools,
            list_delivery_runs,
            record_delivery_run,
            save_cli_tool_detections,
            list_sessions,
            get_workspace_summary,
            create_session,
            delete_session,
            save_chat_message,
            list_chat_messages,
            list_clipboard,
            list_error_logs,
            get_error_log_summary,
            export_sync_snapshot,
            import_sync_snapshot,
            encrypt_sync_payload_command,
            decrypt_sync_payload_command,
            export_encrypted_sync_snapshot,
            import_encrypted_sync_snapshot,
            sync_passphrase_strength,
            get_sync_key_status,
            list_sync_key_versions,
            register_sync_passphrase,
            confirm_sync_passphrase,
            rotate_sync_passphrase,
            get_sync_pairing_code,
            verify_sync_pairing_code,
            list_sync_paired_devices,
            remove_sync_paired_device,
            push_sync_snapshot,
            pull_sync_snapshot,
            resolve_sync_conflict,
            resolve_sync_conflicts,
            resolve_sync_conflict_union,
            resolve_sync_conflicts_union,
            resolve_sync_conflict_structured,
            resolve_sync_conflicts_structured,
            list_sync_conflicts,
            clear_resolved_sync_conflicts,
            list_sync_audit,
            get_sync_audit_summary,
            clear_sync_audit,
            export_sync_audit,
            report_frontend_error,
            capture_clipboard,
            search_thoughts,
            get_project_git_context,
            get_git_activity,
            get_git_file_diff,
            get_project_diff_tree,
            get_file_hunk_patch,
            run_quality_gate,
            get_git_file_versions,
            generate_commit_pr_draft,
            apply_commit,
            commit_git_files,
            run_commit_lint_gate,
            create_remote_pr,
            rebase_branch,
            abort_rebase,
            resolve_rebase_conflicts,
            build_team_summary,
            build_moa_consensus,
            send_ai_message,
            stream_ai_message,
            cancel_ai_stream,
            check_provider_health,
            run_provider_heartbeat,
            emit_event_bus_event,
            list_event_logs,
            clear_event_logs,
            get_event_schema,
            set_event_schema,
            list_event_schemas,
            get_event_bus_config,
            set_event_bus_config,
            list_event_forwards,
            retry_event_forward,
            delete_event_forward,
            clear_event_forwards,
            get_event_bus_stats,
            run_provider_stream_smoke_test,
            run_provider_e2e_stream,
            create_fsm_run,
            create_fsm_node,
            update_fsm_node_status,
            update_fsm_node_context,
            list_fsm_nodes,
            list_active_fsm_runs,
            delete_fsm_run,
            get_run_metric,
            list_run_metrics,
            file_ops::apply_code_snippet,
            file_ops::rollback_snapshot,
            file_ops::list_snapshots,
            file_ops::prune_snapshots,
            list_agent_specs,
            ensure_agent_specs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn list_agent_specs(project_path: String) -> Result<Vec<prism_agents::AgentSpec>, String> {
    prism_agents::load_agent_specs(&project_path)
}

#[tauri::command]
fn ensure_agent_specs(project_path: String) -> Result<usize, String> {
    prism_agents::ensure_default_agent_specs(&project_path)
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
    fn auto_fallback_marker_links_provider_names() {
        assert_eq!(
            auto_fallback_marker("Alpha", "Beta"),
            "\n[auto fallback: Alpha → Beta]\n"
        );
    }

    #[test]
    fn moa_lane_run_id_keeps_provider_and_consensus_runs_distinct() {
        assert_eq!(moa_lane_run_id("ai-7", "p", 0), "ai-7-p0");
        assert_eq!(moa_lane_run_id("ai-7", "p", 2), "ai-7-p2");
        assert_eq!(moa_lane_run_id("ai-7", "s", 1), "ai-7-s1");
        assert_eq!(format!("{}-c", "ai-7"), "ai-7-c");
    }

    #[test]
    fn moa_chain_context_appends_previous_output() {
        let base = serde_json::json!([{ "role": "user", "content": "plan a trip" }]).to_string();
        let next = append_moa_chain_context(&base, "Alpha AI", "step one").unwrap();
        let parsed: Vec<Value> = serde_json::from_str(&next).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["role"], "user");
        assert_eq!(parsed[1]["role"], "user");
        let content = parsed[1]["content"].as_str().unwrap();
        assert!(content.contains("[Previous agent output from Alpha AI]"));
        assert!(content.contains("step one"));
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
    fn provider_models_parses_openai_and_ollama_shapes() {
        let openai = r#"{"object":"list","data":[{"id":"gpt-4o-mini","owned_by":"openai"},{"id":"mock-gpt","owned_by":"acme"}]}"#;
        let parsed = parse_provider_models(openai, false).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].id, "gpt-4o-mini");
        assert_eq!(parsed[0].owned_by.as_deref(), Some("openai"));
        assert_eq!(parsed[1].id, "mock-gpt");
        assert_eq!(parsed[1].owned_by.as_deref(), Some("acme"));

        let ollama = r#"{"models":[{"name":"qwen2.5:3b"},{"name":"llama3.2"}]}"#;
        let parsed = parse_provider_models(ollama, true).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].id, "qwen2.5:3b");
        assert!(parsed[0].owned_by.is_none());
        assert_eq!(parsed[1].id, "llama3.2");

        assert!(parse_provider_models("{}", false).is_err());
        assert!(parse_provider_models(r#"{"data":[]}"#, false).is_err());
        assert!(parse_provider_models("not json", false).is_err());
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
        assert_eq!(ctx.committer, "Bob");
        assert_eq!(ctx.last_commit_at, 1_720_000_100_000);
        assert!(ctx.changes.is_empty());

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reflog_parses_committer_with_spaces() {
        let line = "aaaa0001 0000000000000000000000000000000000000000 John Doe <john@x> 1720000000 +0800\tcommit: first";
        assert_eq!(reflog_committer(line), "John Doe");
        assert_eq!(reflog_timestamp_ms(line), 1_720_000_000_000);
    }

    #[test]
    fn git_change_paths_strips_status_prefixes() {
        let changes = vec![
            " M src/lib/db.ts".to_string(),
            "?? docs/plan.md".to_string(),
            "R  src/a.ts -> src/b.ts".to_string(),
            "A  README.md".to_string(),
        ];
        assert_eq!(
            git_change_paths(&changes),
            vec![
                "src/lib/db.ts".to_string(),
                "docs/plan.md".to_string(),
                "src/b.ts".to_string(),
                "README.md".to_string(),
            ]
        );
    }

    #[test]
    fn git_change_groups_classifies_staged_unstaged_and_untracked() {
        let changes = vec![
            "M  staged.txt".to_string(),
            " M unstaged.txt".to_string(),
            "MM both.txt".to_string(),
            "?? untracked.txt".to_string(),
        ];
        let groups = git_change_groups(&changes);
        assert_eq!(groups.len(), 4);
        assert_eq!(
            groups
                .iter()
                .find(|g| g.path == "staged.txt")
                .unwrap()
                .group,
            "staged"
        );
        assert_eq!(
            groups
                .iter()
                .find(|g| g.path == "unstaged.txt")
                .unwrap()
                .group,
            "unstaged"
        );
        assert_eq!(
            groups.iter().find(|g| g.path == "both.txt").unwrap().group,
            "both"
        );
        assert_eq!(
            groups
                .iter()
                .find(|g| g.path == "untracked.txt")
                .unwrap()
                .group,
            "untracked"
        );
    }

    #[test]
    fn git_file_diff_returns_unified_diff_for_modified_file() {
        let temp = std::env::temp_dir().join(format!("aiwb-file-diff-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "line one\nline two\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        std::fs::write(temp.join("README.md"), "line one\nline changed\n").unwrap();

        let diff = get_git_file_diff(path.clone(), "README.md".to_string()).unwrap();
        assert!(diff.diff.contains("diff --git"));
        assert!(diff.diff.contains("-line two"));
        assert!(diff.diff.contains("+line changed"));
        assert!(diff.status.contains("M"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn git_file_diff_reads_untracked_file_content() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-untracked-diff-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("notes.txt"), "new content\nsecond line\n").unwrap();

        let diff = get_git_file_diff(path.clone(), "notes.txt".to_string()).unwrap();
        assert!(diff.status.starts_with("??"));
        assert!(diff.diff.contains("diff --git"));
        assert!(diff.diff.contains("+new content"));
        assert!(diff.diff.contains("+second line"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn git_file_versions_returns_head_and_worktree_content() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-file-versions-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "line one\nline two\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        std::fs::write(temp.join("README.md"), "line one\nline changed\n").unwrap();

        let versions = get_git_file_versions(path.clone(), "README.md".to_string()).unwrap();
        assert!(versions.old_content.contains("line two"));
        assert!(versions.new_content.contains("line changed"));
        assert!(!versions.new_content.contains("line two"));
        assert!(versions.status.contains("M"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn git_file_versions_untracked_returns_empty_old() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-untracked-versions-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("notes.txt"), "new content\n").unwrap();

        let versions = get_git_file_versions(path.clone(), "notes.txt".to_string()).unwrap();
        assert!(versions.old_content.is_empty());
        assert!(versions.new_content.contains("new content"));
        assert!(versions.status.starts_with("??"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn git_activity_aggregates_and_sorts_projects() {
        let first = std::env::temp_dir().join(format!("aiwb-git-board-a-{}", uuid::Uuid::new_v4()));
        let second =
            std::env::temp_dir().join(format!("aiwb-git-board-b-{}", uuid::Uuid::new_v4()));
        for (dir, head, log) in [
            (
                &first,
                "ref: refs/heads/develop\n",
                "aaaa0001 0000000000000000000000000000000000000000 Alice <a@x> 1720000000 +0800\tcommit: first\n",
            ),
            (
                &second,
                "ref: refs/heads/main\n",
                "bbbb0002 aaaa00010000000000000000000000000000000000 Bob <b@x> 1720000100 +0800\tcommit: second\n",
            ),
        ] {
            let git_dir = dir.join(".git");
            std::fs::create_dir_all(git_dir.join("logs")).unwrap();
            std::fs::write(git_dir.join("HEAD"), head).unwrap();
            std::fs::write(git_dir.join("logs").join("HEAD"), log).unwrap();
        }
        std::fs::write(second.join("notes.md"), "wip").unwrap();

        let projects = vec![
            db::Project {
                id: "p-a".to_string(),
                name: "Alpha".to_string(),
                path: Some(first.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                journey_stage: "idea".to_string(),
                journey_doc_path: None,
                created_at: 1,
                sort_order: 0,
                material: String::new(),
            },
            db::Project {
                id: "p-b".to_string(),
                name: "Beta".to_string(),
                path: Some(second.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                journey_stage: "idea".to_string(),
                journey_doc_path: None,
                created_at: 2,
                sort_order: 1,
                material: String::new(),
            },
            db::Project {
                id: "p-c".to_string(),
                name: "No Git".to_string(),
                path: None,
                revenue: 0.0,
                status: "active".to_string(),
                journey_stage: "idea".to_string(),
                journey_doc_path: None,
                created_at: 3,
                sort_order: 2,
                material: String::new(),
            },
        ];
        let board = build_git_activity(projects, None, None, None);
        assert_eq!(board.total_projects, 2);
        assert_eq!(board.total_commits, 2);
        assert_eq!(board.dirty_projects, 1);
        assert_eq!(
            board.committers,
            vec!["Alice".to_string(), "Bob".to_string()]
        );
        assert_eq!(board.items[0].project_name, "Beta");
        assert_eq!(board.items[0].branch, "main");
        assert_eq!(board.items[0].committer, "Bob");
        assert!(board.items[0].dirty);
        assert_eq!(board.items[0].changed_files, 1);
        assert_eq!(board.items[0].changed_paths, vec!["notes.md".to_string()]);
        assert_eq!(board.items[1].project_name, "Alpha");
        assert_eq!(board.items[1].committer, "Alice");
        assert!(!board.items[1].dirty);
        assert_eq!(board.commit_trend.granularity, "day");
        assert_eq!(board.commit_trend.buckets.len(), 1);
        assert_eq!(board.commit_trend.buckets[0].count, 2);
        assert_eq!(
            board.commit_trend.buckets[0].day_ms,
            1_720_000_000_000 / 86_400_000 * 86_400_000
        );

        std::fs::remove_dir_all(&first).unwrap();
        std::fs::remove_dir_all(&second).unwrap();
    }

    #[test]
    fn git_activity_filters_by_time_and_committer() {
        let first =
            std::env::temp_dir().join(format!("aiwb-git-filter-a-{}", uuid::Uuid::new_v4()));
        let second =
            std::env::temp_dir().join(format!("aiwb-git-filter-b-{}", uuid::Uuid::new_v4()));
        for (dir, head, log) in [
            (
                &first,
                "ref: refs/heads/develop\n",
                "aaaa0001 0000000000000000000000000000000000000000 Alice <a@x> 1720000000 +0800\tcommit: first\n",
            ),
            (
                &second,
                "ref: refs/heads/main\n",
                "bbbb0002 aaaa00010000000000000000000000000000000000 Bob <b@x> 1720000100 +0800\tcommit: second\n",
            ),
        ] {
            let git_dir = dir.join(".git");
            std::fs::create_dir_all(git_dir.join("logs")).unwrap();
            std::fs::write(git_dir.join("HEAD"), head).unwrap();
            std::fs::write(git_dir.join("logs").join("HEAD"), log).unwrap();
        }

        let projects = vec![
            db::Project {
                id: "p-a".to_string(),
                name: "Alpha".to_string(),
                path: Some(first.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                journey_stage: "idea".to_string(),
                journey_doc_path: None,
                created_at: 1,
                sort_order: 0,
                material: String::new(),
            },
            db::Project {
                id: "p-b".to_string(),
                name: "Beta".to_string(),
                path: Some(second.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                journey_stage: "idea".to_string(),
                journey_doc_path: None,
                created_at: 2,
                sort_order: 1,
                material: String::new(),
            },
        ];

        let all = build_git_activity(projects.clone(), None, None, None);
        assert_eq!(all.total_projects, 2);
        assert_eq!(all.committers, vec!["Alice".to_string(), "Bob".to_string()]);

        let recent = build_git_activity(projects.clone(), Some(1_720_000_050_000), None, None);
        assert_eq!(recent.total_projects, 1);
        assert_eq!(recent.items[0].project_name, "Beta");
        assert_eq!(recent.total_commits, 1);

        let old = build_git_activity(projects.clone(), None, Some(1_720_000_050_000), None);
        assert_eq!(old.total_projects, 1);
        assert_eq!(old.items[0].project_name, "Alpha");

        let alice = build_git_activity(projects.clone(), None, None, Some("alice".to_string()));
        assert_eq!(alice.total_projects, 1);
        assert_eq!(alice.items[0].committer, "Alice");

        let nobody = build_git_activity(projects.clone(), None, None, Some("nobody".to_string()));
        assert_eq!(nobody.total_projects, 0);
        assert_eq!(nobody.total_commits, 0);
        assert_eq!(nobody.committers.len(), 2);

        std::fs::remove_dir_all(&first).unwrap();
        std::fs::remove_dir_all(&second).unwrap();
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
    fn moa_consensus_combines_common_keywords_and_viewpoints() {
        let consensus = build_moa_consensus_inner(vec![
            "Alpha answer part2\n- alpha".to_string(),
            "Beta answer part2\n- beta".to_string(),
            "Gamma answer part2\n- gamma".to_string(),
        ]);
        assert!(consensus.common.contains(&"answer".to_string()));
        assert!(consensus.common.contains(&"part2".to_string()));
        assert_eq!(consensus.common.len(), 2);
        assert_eq!(consensus.viewpoints.len(), 3);
        assert!(consensus.summary.contains("共识点"));
        assert!(consensus.summary.contains("分歧/独特观点"));
        assert!(consensus.summary.contains("结论"));
        assert!(consensus.summary.contains("Output 1: Alpha answer part2"));
        assert!(build_moa_consensus_text(Vec::new()).contains("No agent output"));
    }

    #[test]
    fn provider_heartbeat_tracks_consecutive_failures_and_alerts() {
        let heartbeat = ProviderHeartbeat::default();
        let provider = |id: &str, name: &str| db::Provider {
            id: id.to_string(),
            name: name.to_string(),
            base_url: "http://localhost:11434".to_string(),
            api_key: String::new(),
            model: String::new(),
            priority: 0,
            is_active: true,
            api_key_encrypted: false,
            timeout_secs: 30,
            retry_count: 1,
            retry_delay_secs: 1,
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
    fn commit_git_files_commits_only_selected_files() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-commit-files-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "# Test\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        std::fs::write(temp.join("a.txt"), "a1\n").unwrap();
        std::fs::write(temp.join("b.txt"), "b1\n").unwrap();

        let result = commit_git_files(
            path.clone(),
            vec!["a.txt".to_string()],
            "feat(test): selected a".to_string(),
        )
        .unwrap();
        assert!(result.committed);
        assert_eq!(
            run_git(&path, &["log", "-1", "--format=%s"]).unwrap(),
            "feat(test): selected a"
        );
        let status = run_git(&path, &["status", "--porcelain"]).unwrap();
        assert!(
            status.contains("b.txt"),
            "b.txt should stay dirty: {}",
            status
        );
        assert!(
            !status.contains("a.txt"),
            "a.txt should be committed: {}",
            status
        );
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn commit_git_files_rejects_empty_selection() {
        let temp = std::env::temp_dir().join(format!(
            "aiwb-commit-files-empty-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);

        let err =
            commit_git_files(path.clone(), vec![], "chore(test): none".to_string()).unwrap_err();
        assert!(
            err.contains("No files selected"),
            "unexpected error: {}",
            err
        );
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn commit_lint_gate_blocks_conflict_markers_and_invalid_json() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-lint-gate-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("README.md"), "# Test\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        std::fs::write(
            temp.join("conflict.md"),
            "# title\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n",
        )
        .unwrap();
        std::fs::write(temp.join("broken.json"), "{ not json").unwrap();
        std::fs::write(temp.join("clean.md"), "# clean\n").unwrap();

        let issues = run_commit_lint_gate_impl(
            &path,
            &[
                "conflict.md".to_string(),
                "broken.json".to_string(),
                "clean.md".to_string(),
            ],
        )
        .unwrap();
        assert!(issues
            .iter()
            .any(|issue| issue.file == "conflict.md" && issue.message.contains("conflict")));
        assert!(issues
            .iter()
            .any(|issue| issue.file == "broken.json" && issue.message.contains("JSON")));

        let err = commit_git_files(
            path.clone(),
            vec!["conflict.md".to_string()],
            "feat(test): blocked".to_string(),
        )
        .unwrap_err();
        assert!(
            err.contains("Lint gate failed"),
            "unexpected error: {}",
            err
        );

        let result = commit_git_files(
            path.clone(),
            vec!["clean.md".to_string()],
            "feat(test): clean".to_string(),
        )
        .unwrap();
        assert!(result.committed);
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
    fn resolve_rebase_conflicts_takes_theirs_and_continues() {
        let temp = std::env::temp_dir().join(format!(
            "aiwb-rebase-resolve-theirs-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("shared.txt"), "base\n").unwrap();
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

        let conflicted = rebase_branch(path.clone(), "main".to_string()).unwrap();
        assert!(conflicted.conflict);
        let err = resolve_rebase_conflicts(path.clone(), "sideways".to_string()).unwrap_err();
        assert!(err.contains("Unsupported conflict strategy"), "{}", err);
        let result = resolve_rebase_conflicts(path.clone(), "theirs".to_string()).unwrap();
        assert!(result.resolved);
        assert!(result.rebased, "{}", result.message);
        assert_eq!(result.strategy, "theirs");
        assert!(result.files.iter().any(|file| file.ends_with("shared.txt")));
        assert_eq!(
            std::fs::read_to_string(temp.join("shared.txt")).unwrap(),
            "main changed\n"
        );
        let log = run_git(&path, &["log", "--oneline"]).unwrap();
        assert!(log.contains("main edit"));
        assert!(
            run_git(&path, &["rebase", "--abort"]).is_err(),
            "rebase should be finished"
        );
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn resolve_rebase_conflicts_union_merges_both_sides() {
        let temp = std::env::temp_dir().join(format!(
            "aiwb-rebase-resolve-union-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let path = init_test_git_repo(&temp);
        std::fs::write(temp.join("notes.txt"), "# Title\n\nbase line\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "init"]).unwrap();
        run_git(&path, &["checkout", "-b", "feature"]).unwrap();
        std::fs::write(
            temp.join("notes.txt"),
            "# Title\n\nbase line\nfeature line\n",
        )
        .unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "feature edit"]).unwrap();
        run_git(&path, &["checkout", "main"]).unwrap();
        std::fs::write(temp.join("notes.txt"), "# Title\n\nbase line\nmain line\n").unwrap();
        run_git(&path, &["add", "-A"]).unwrap();
        run_git(&path, &["commit", "-m", "main edit"]).unwrap();
        run_git(&path, &["checkout", "feature"]).unwrap();

        let conflicted = rebase_branch(path.clone(), "main".to_string()).unwrap();
        assert!(conflicted.conflict);
        let result = resolve_rebase_conflicts(path.clone(), "union".to_string()).unwrap();
        assert!(result.resolved);
        assert!(result.rebased, "{}", result.message);
        let content = std::fs::read_to_string(temp.join("notes.txt")).unwrap();
        assert!(content.contains("feature line"), "{}", content);
        assert!(content.contains("main line"), "{}", content);
        assert!(!content.contains("<<<<<<<"), "{}", content);
        assert!(!content.contains(">>>>>>>"), "{}", content);
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
            let read = stream.read(&mut buf).unwrap();
            let request = String::from_utf8_lossy(&buf[..read]).to_string();
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body_owned.len(),
                body_owned
            );
            let _ = stream.write_all(response.as_bytes());
            request
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
            "mock-gpt",
            30,
            &is_cancelled,
            &mut emit,
        );
        let request = server.join().unwrap();
        assert!(result.is_ok(), "stream failed: {:?}", result);
        assert!(
            request.contains("\"model\":\"mock-gpt\""),
            "request model missing: {}",
            request
        );
        assert!(
            request.contains("\"stream\":true"),
            "request stream flag missing: {}",
            request
        );
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
            "gpt-4o-mini",
            30,
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

    #[test]
    fn remote_push_sends_snapshot_with_auth() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            let mut buf = [0u8; 1024];
            loop {
                let n = stream.read(&mut buf).unwrap();
                request.push_str(&String::from_utf8_lossy(&buf[..n]));
                if request.contains("\r\n\r\n") || n == 0 {
                    break;
                }
            }
            let has_auth = request
                .to_lowercase()
                .contains("authorization: bearer test-token");
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let _ = stream.write_all(response.as_bytes());
            has_auth
        });
        let snapshot = db::SyncSnapshot {
            device_id: "device-a".to_string(),
            exported_at: 1234,
            clipboard: Vec::new(),
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let result =
            push_sync_snapshot_http(&snapshot, &format!("http://{}", addr), Some("test-token"))
                .unwrap();
        assert!(result.ok);
        assert_eq!(result.synced_at, 1234);
        assert!(server.join().unwrap(), "Authorization header missing");
    }

    #[test]
    fn sync_encrypt_decrypt_roundtrip() {
        let payload = r#"{"deviceId":"device-a","exportedAt":1234,"clipboard":[],"logs":[],"quickPrompts":[],"quickPromptUsage":[]}"#;
        let envelope = encrypt_sync_payload(payload, "test-passphrase").unwrap();
        assert!(envelope.contains("AES-256-GCM"));
        assert!(!envelope.contains("device-a"));
        let decrypted = decrypt_sync_payload(&envelope, "test-passphrase").unwrap();
        assert_eq!(decrypted, payload);
    }

    #[test]
    fn sync_decrypt_wrong_passphrase_fails() {
        let envelope = encrypt_sync_payload("secret sync content", "right-pass").unwrap();
        let err = decrypt_sync_payload(&envelope, "wrong-pass").unwrap_err();
        assert!(err.contains("Decryption failed"), "{}", err);
    }

    #[test]
    fn sync_passphrase_strength_scores_weak_and_strong() {
        let weak = db::assess_passphrase_strength("short");
        assert!(weak.score < 40, "weak score {}", weak.score);
        assert_eq!(weak.label, "weak");
        assert!(!weak.feedback.is_empty());

        let strong = db::assess_passphrase_strength("Tr0ub4dor&3-Life");
        assert!(strong.score >= 70, "strong score {}", strong.score);
        assert!(
            strong.label == "strong" || strong.label == "excellent",
            "unexpected label {}",
            strong.label
        );
    }

    #[test]
    fn sync_key_register_rotate_persists_salt_and_versions() {
        let conn = db::new_test_connection();
        let first = db::register_sync_key_version(
            &conn,
            "device-a",
            "a1b2c3d4e5f60718",
            "0011223344556677",
            "AES-256-GCM",
            100_000,
        )
        .unwrap();
        assert_eq!(first.active_key_version, 1);
        assert!(first.confirmed);
        assert!(first.encryption_enabled);

        let rotated = db::register_sync_key_version(
            &conn,
            "device-a",
            "ffeeddccbbaa9988",
            "8899aabbccddeeff",
            "AES-256-GCM",
            100_000,
        )
        .unwrap();
        assert_eq!(rotated.active_key_version, 2);

        let versions = db::list_sync_key_versions(&conn).unwrap();
        assert_eq!(versions.len(), 2);
        assert!(versions[0].active);
        assert_eq!(versions[0].version, 2);
        assert_eq!(versions[0].salt, "ffeeddccbbaa9988");
        assert!(!versions[1].active);

        let status = db::get_sync_key_status(&conn).unwrap();
        assert_eq!(status.active_key_version, 2);
        assert_eq!(status.active_salt, "ffeeddccbbaa9988");
        assert_eq!(status.active_fingerprint, "8899aabbccddeeff");
        assert_eq!(status.device_id, "device-a");
    }

    #[test]
    fn sync_key_confirm_does_not_rotate_and_rejects_wrong_fingerprint() {
        let conn = db::new_test_connection();
        db::register_sync_key_version(
            &conn,
            "device-c",
            "a1b2c3d4e5f60718",
            "0011223344556677",
            "AES-256-GCM",
            100_000,
        )
        .unwrap();
        let confirmed = db::confirm_sync_credential(&conn, "0011223344556677").unwrap();
        assert!(confirmed.confirmed);
        assert_eq!(confirmed.active_key_version, 1);

        let wrong = db::confirm_sync_credential(&conn, "ffffffffffffffff");
        assert!(wrong.is_err());

        let versions = db::list_sync_key_versions(&conn).unwrap();
        assert_eq!(versions.len(), 1);
        let status = db::get_sync_key_status(&conn).unwrap();
        assert!(status.confirmed);
        assert_eq!(status.active_key_version, 1);
    }

    #[test]
    fn sync_pairing_code_roundtrip_and_verify() {
        let mut salt = [0u8; SYNC_SALT_LEN];
        for (index, byte) in salt.iter_mut().enumerate() {
            *byte = index as u8;
        }
        let key = derive_sync_key("Tr0ub4dor&3-Life", &salt).unwrap();
        let fingerprint = sync_key_fingerprint(&key);
        let code = build_sync_pairing_code("device-a", &salt, &fingerprint, 1);
        let (device_id, parsed_salt, parsed_fingerprint, version) =
            parse_sync_pairing_code(&code).unwrap();
        assert_eq!(device_id, "device-a");
        assert_eq!(parsed_salt, salt);
        assert_eq!(parsed_fingerprint, fingerprint);
        assert_eq!(version, 1);

        let wrong = "WB-DEVB-AAECAwQFBgcICQoLDA0ODw.0000000000000000.1.dGVzdA";
        let (wrong_device, wrong_salt, wrong_fingerprint, wrong_version) =
            parse_sync_pairing_code(wrong).unwrap();
        assert_eq!(wrong_device, "test");
        assert_eq!(wrong_salt, salt);
        assert_eq!(wrong_fingerprint, "0000000000000000");
        assert_eq!(wrong_version, 1);
        assert_ne!(wrong_fingerprint, fingerprint);
    }

    #[test]
    fn sync_key_versions_reject_weak_passphrase_flow() {
        let conn = db::new_test_connection();
        let weak = db::assess_passphrase_strength("short");
        assert!(weak.score < 40);
        let strong = db::assess_passphrase_strength("Tr0ub4dor&3-Life");
        assert!(strong.score >= 70);
        let first = db::register_sync_key_version(
            &conn,
            "device-b",
            "0102030405060708",
            "0102030405060708",
            "AES-256-GCM",
            100_000,
        )
        .unwrap();
        assert_eq!(first.active_key_version, 1);
    }

    #[test]
    fn push_sync_payload_http_posts_encrypted_body() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let envelope =
            encrypt_sync_payload(r#"{"deviceId":"device-e2e","exportedAt":99}"#, "test-pass")
                .unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_http_request_until(&mut stream, "AES-256-GCM");
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let _ = stream.write_all(response.as_bytes());
            (
                request.contains("AES-256-GCM"),
                request.contains("device-e2e"),
            )
        });
        push_sync_payload_http(&envelope, &format!("http://{}", addr), None).unwrap();
        let (has_alg, has_plaintext) = server.join().unwrap();
        assert!(has_alg, "expected encrypted envelope body");
        assert!(!has_plaintext, "plaintext leaked in request body");
    }

    #[test]
    fn remote_pull_merges_snapshot_into_db() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let snapshot = db::SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 5678,
            clipboard: vec![db::ClipboardItem {
                id: "remote-clip-1".to_string(),
                content: "remote sync content".to_string(),
                source: "remote".to_string(),
                timestamp: 5678,
                updated_at: 5678,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let body = serde_json::to_string(&snapshot).unwrap();
        let body_len = body.len();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            let mut buf = [0u8; 1024];
            loop {
                let n = stream.read(&mut buf).unwrap();
                request.push_str(&String::from_utf8_lossy(&buf[..n]));
                if request.contains("\r\n\r\n") || n == 0 {
                    break;
                }
            }
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body_len,
                body
            );
            let _ = stream.write_all(response.as_bytes());
        });
        let pulled = pull_sync_snapshot_http(&format!("http://{}", addr), None).unwrap();
        server.join().unwrap();
        let temp =
            std::env::temp_dir().join(format!("aiwb-remote-sync-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let result = db::merge_sync_snapshot(&conn, pulled).unwrap();
        assert_eq!(result.clipboard_added, 1);
        assert_eq!(result.device_id, "device-remote");
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn sync_snapshot_merges_quick_prompts_and_usage() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-quick-prompt-sync-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        db::upsert_quick_prompt(
            &conn,
            &db::QuickPrompt {
                id: "custom-local".to_string(),
                label: "Local prompt".to_string(),
                category: "work".to_string(),
                text: "local".to_string(),
                custom: true,
                sort_order: 0,
                updated_at: 1000,
                created_at: 500,
            },
        )
        .unwrap();
        db::upsert_quick_prompt_usage(&conn, "custom-local", 1, 1000).unwrap();

        let snapshot = db::SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 3000,
            clipboard: Vec::new(),
            logs: Vec::new(),
            quick_prompts: vec![
                db::QuickPrompt {
                    id: "custom-local".to_string(),
                    label: "Remote prompt".to_string(),
                    category: "work".to_string(),
                    text: "remote".to_string(),
                    custom: true,
                    sort_order: 0,
                    updated_at: 2000,
                    created_at: 500,
                },
                db::QuickPrompt {
                    id: "custom-remote-only".to_string(),
                    label: "Remote only".to_string(),
                    category: "life".to_string(),
                    text: "only remote".to_string(),
                    custom: true,
                    sort_order: 1,
                    updated_at: 2500,
                    created_at: 2500,
                },
            ],
            quick_prompt_usage: vec![db::QuickPromptUsageEntry {
                id: "custom-local".to_string(),
                count: 3,
                updated_at: 2000,
            }],
        };
        let result = db::merge_sync_snapshot(&conn, snapshot).unwrap();
        assert_eq!(result.quick_prompts_added, 1);
        assert_eq!(result.quick_prompts_updated, 1);
        assert_eq!(result.quick_prompt_usage_updated, 1);
        let prompts = db::list_quick_prompts(&conn).unwrap();
        assert!(prompts.iter().any(|p| p.label == "Remote prompt"));
        assert!(prompts.iter().any(|p| p.id == "custom-remote-only"));
        let usage = db::list_quick_prompt_usage(&conn).unwrap();
        assert_eq!(
            usage.iter().find(|e| e.id == "custom-local").unwrap().count,
            3
        );
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    fn read_http_request_until(stream: &mut std::net::TcpStream, marker: &str) -> String {
        use std::io::Read;
        let mut request = String::new();
        let mut buf = [0u8; 4096];
        for _ in 0..100 {
            let n = stream.read(&mut buf).unwrap();
            if n == 0 {
                break;
            }
            request.push_str(&String::from_utf8_lossy(&buf[..n]));
            if request.contains(marker) || (marker.is_empty() && request.contains("\r\n\r\n")) {
                break;
            }
            thread::sleep(Duration::from_millis(5));
        }
        request
    }

    #[test]
    fn event_forward_payload_includes_context_and_device() {
        let log = db::EventLogRecord {
            id: "evt-1".to_string(),
            event: "sync.completed".to_string(),
            context: r#"{"ok":true}"#.to_string(),
            source: "workbench".to_string(),
            device_id: "device-a".to_string(),
            schema_version: 3,
            status: "accepted".to_string(),
            rejected_reason: String::new(),
            created_at: 1234,
        };
        let payload = build_event_forward_payload(&log);
        let value: Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(value["event"], "sync.completed");
        assert_eq!(value["deviceId"], "device-a");
        assert_eq!(value["context"]["ok"], true);
        assert_eq!(value["schemaVersion"], 3);
        assert_eq!(value["createdAt"], 1234);
    }

    #[test]
    fn provider_api_key_encryption_roundtrip_and_wrong_key() {
        let key = [7u8; 32];
        set_provider_secret(key);
        let other = [9u8; 32];
        let envelope = encrypt_provider_api_key("sk-live-secret-123", &key).unwrap();
        assert!(envelope.starts_with("enc:v1:"));
        assert_eq!(
            decrypt_provider_api_key(&envelope, &key).unwrap(),
            "sk-live-secret-123"
        );
        assert!(decrypt_provider_api_key(&envelope, &other).is_err());
        assert!(decrypt_provider_api_key("not-an-envelope", &key).is_err());

        let mut provider = db::Provider {
            id: "p1".to_string(),
            name: "Encrypted".to_string(),
            base_url: "https://example.test/v1".to_string(),
            api_key: envelope,
            model: "mock".to_string(),
            priority: 0,
            is_active: true,
            api_key_encrypted: true,
            timeout_secs: 30,
            retry_count: 1,
            retry_delay_secs: 1,
        };
        let decrypted = decrypt_provider(provider.clone()).unwrap();
        assert_eq!(decrypted.api_key, "sk-live-secret-123");
        assert!(!decrypted.api_key_encrypted);

        provider.api_key_encrypted = false;
        provider.api_key = "plain-key".to_string();
        assert_eq!(decrypt_provider(provider).unwrap().api_key, "plain-key");
    }

    #[test]
    fn keyring_ref_detection_keeps_plaintext_keys_readable() {
        assert!(looks_like_keyring_ref("OPENAI_API_KEY"));
        assert!(looks_like_keyring_ref("ANTHROPIC_API_KEY_2"));
        assert!(!looks_like_keyring_ref("sk-ant-abc123"));
        assert!(!looks_like_keyring_ref(""));
        assert!(!looks_like_keyring_ref("lower_case"));
        assert!(!looks_like_keyring_ref(&"K".repeat(65)));
    }

    #[test]
    fn diff_stats_parses_numstat_lines() {
        // 模拟 "12\t4\tsrc/foo.ts"
        let (add, del) = git_diff_stats_numstat("12\t4\tsrc/foo.ts");
        assert_eq!(add, 12);
        assert_eq!(del, 4);
    }

    #[test]
    fn porcelain_status_maps_to_kind() {
        assert_eq!(porcelain_kind("?? new.txt"), "Added");
        assert_eq!(porcelain_kind(" M modified.ts"), "Modified");
        assert_eq!(porcelain_kind("D  removed.rs"), "Deleted");
    }
}
