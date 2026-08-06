use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::pbkdf2;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
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
    active: std::sync::Mutex<Vec<ActiveVaultWatch>>,
}

#[derive(Clone)]
struct VaultIndexRequest {
    run_id: String,
    path: String,
    ignore_patterns: Vec<String>,
    concurrency: usize,
    priority: usize,
    attempts: usize,
    last_error: String,
}

const VAULT_INDEX_MAX_ATTEMPTS: usize = 3;
const VAULT_INDEX_RETRY_BASE_MS: u64 = 500;
const VAULT_INDEX_RETRY_MAX_MS: u64 = 4000;

fn vault_index_retry_delay_ms(attempts: usize) -> u64 {
    if attempts == 0 {
        return 0;
    }
    let exponent = attempts.saturating_sub(1).min(3) as u32;
    (VAULT_INDEX_RETRY_BASE_MS << exponent).min(VAULT_INDEX_RETRY_MAX_MS)
}

#[derive(Default)]
struct VaultIndexState {
    inner: std::sync::Mutex<VaultIndexQueue>,
}

#[derive(Default)]
struct VaultIndexQueue {
    cancelled: HashSet<String>,
    active: Option<VaultIndexRequest>,
    queue: VecDeque<VaultIndexRequest>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultIndexQueueEntry {
    run_id: String,
    path: String,
    status: String,
    position: usize,
    priority: usize,
    attempts: usize,
    last_error: String,
    retry_delay_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultIndexQueueStatus {
    active: Option<VaultIndexQueueEntry>,
    queue: Vec<VaultIndexQueueEntry>,
}

impl VaultIndexState {
    fn enqueue(&self, request: VaultIndexRequest) -> Result<usize, String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        let position = guard
            .queue
            .iter()
            .position(|queued| queued.priority < request.priority)
            .unwrap_or(guard.queue.len());
        guard.queue.insert(position, request);
        Ok(position)
    }

    fn mark(&self, run_id: &str) -> bool {
        self.inner
            .lock()
            .map(|mut guard| guard.cancelled.insert(run_id.to_string()))
            .unwrap_or(false)
    }

    fn is_cancelled(&self, run_id: &str) -> bool {
        self.inner
            .lock()
            .map(|guard| guard.cancelled.contains(run_id))
            .unwrap_or(false)
    }

    fn clear(&self, run_id: &str) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.cancelled.remove(run_id);
        }
    }

    fn take_queued(&self, run_id: &str) -> Option<VaultIndexRequest> {
        self.inner.lock().ok().and_then(|mut guard| {
            let index = guard
                .queue
                .iter()
                .position(|request| request.run_id == run_id)?;
            guard.queue.remove(index)
        })
    }

    fn claim_next(&self) -> Result<Option<VaultIndexRequest>, String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        if guard.active.is_some() {
            return Ok(None);
        }
        let next = guard.queue.pop_front();
        if let Some(request) = &next {
            guard.active = Some(request.clone());
        }
        Ok(next)
    }

    fn finish_active(&self, run_id: &str) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        guard.cancelled.remove(run_id);
        if guard.active.as_ref().map(|r| r.run_id.as_str()) == Some(run_id) {
            guard.active = None;
        }
        Ok(())
    }

    fn retry_failed(&self, run_id: &str, error: &str) -> Result<Option<VaultIndexRequest>, String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        let Some(active) = guard.active.take() else {
            return Ok(None);
        };
        if active.run_id != run_id {
            guard.active = Some(active);
            return Err("active run does not match failed run".to_string());
        }
        guard.cancelled.remove(run_id);
        let mut request = active;
        request.attempts += 1;
        request.last_error = error.to_string();
        if request.attempts >= VAULT_INDEX_MAX_ATTEMPTS {
            return Ok(None);
        }
        let position = guard
            .queue
            .iter()
            .position(|queued| queued.priority < request.priority)
            .unwrap_or(guard.queue.len());
        guard.queue.insert(position, request.clone());
        Ok(Some(request))
    }

    fn snapshot(&self) -> Result<VaultIndexQueueStatus, String> {
        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(VaultIndexQueueStatus {
            active: guard.active.as_ref().map(|request| VaultIndexQueueEntry {
                run_id: request.run_id.clone(),
                path: request.path.clone(),
                status: "running".to_string(),
                position: 1,
                priority: request.priority,
                attempts: request.attempts,
                last_error: request.last_error.clone(),
                retry_delay_ms: vault_index_retry_delay_ms(request.attempts),
            }),
            queue: guard
                .queue
                .iter()
                .enumerate()
                .map(|(index, request)| VaultIndexQueueEntry {
                    run_id: request.run_id.clone(),
                    path: request.path.clone(),
                    status: "queued".to_string(),
                    position: index + 1,
                    priority: request.priority,
                    attempts: request.attempts,
                    last_error: request.last_error.clone(),
                    retry_delay_ms: vault_index_retry_delay_ms(request.attempts),
                })
                .collect(),
        })
    }
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
    paths: Vec<String>,
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

fn is_vault_index_cancelled(app: &tauri::AppHandle, run_id: &str) -> bool {
    app.try_state::<VaultIndexState>()
        .map(|state| state.is_cancelled(run_id))
        .unwrap_or(false)
}

fn clear_vault_index_cancel(app: &tauri::AppHandle, run_id: &str) {
    if let Some(state) = app.try_state::<VaultIndexState>() {
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
    chat_openai_compatible(
        "https://api.openai.com/v1",
        &api_key,
        messages_json,
        "gpt-4o-mini",
    )
}

fn stream_openai_compatible_with(
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
    model: &str,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<String, String> {
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = stream_client();
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

fn stream_openai_compatible(
    app: &tauri::AppHandle,
    run_id: &str,
    base_url: &str,
    api_key: &str,
    messages_json: &str,
    model: &str,
) -> Result<String, String> {
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
        model,
        &is_cancelled,
        &mut emit,
    )
}

fn stream_ollama_with(
    run_id: &str,
    base_url: &str,
    messages_json: &str,
    model_name: &str,
    is_cancelled: &dyn Fn() -> bool,
    emit: &mut dyn FnMut(&StreamChunk),
) -> Result<String, String> {
    let messages: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;
    let client = stream_client();
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

fn stream_ollama(
    app: &tauri::AppHandle,
    run_id: &str,
    base_url: &str,
    messages_json: &str,
    model_name: &str,
) -> Result<String, String> {
    let app = app.clone();
    let run_id_owned = run_id.to_string();
    let app_for_cancel = app.clone();
    let is_cancelled = move || is_stream_cancelled(&app_for_cancel, &run_id_owned);
    let mut emit = |chunk: &StreamChunk| {
        let _ = app.emit("stream-chunk", chunk.clone());
    };
    stream_ollama_with(
        run_id,
        base_url,
        messages_json,
        model_name,
        &is_cancelled,
        &mut emit,
    )
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
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        let api_key = get_api_key(key_ref)?;
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
    if is_ollama_provider(&provider.name, &provider.base_url) {
        let model = if provider.model.is_empty() {
            "qwen2.5:3b"
        } else {
            &provider.model
        };
        stream_ollama(app, run_id, &provider.base_url, messages_json, model)
    } else {
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        let api_key = get_api_key(key_ref)?;
        let model = if provider.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &provider.model
        };
        stream_openai_compatible(
            app,
            run_id,
            &provider.base_url,
            &api_key,
            messages_json,
            model,
        )
    }
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

fn wildcard_match(pattern: &str, text: &str) -> bool {
    if pattern.is_empty() {
        return text.is_empty();
    }
    if let Some(rest) = pattern.strip_prefix("**") {
        for (idx, _) in text.char_indices() {
            if wildcard_match(rest, &text[idx..]) {
                return true;
            }
        }
        return wildcard_match(rest, "");
    }
    if let Some(rest) = pattern.strip_prefix('*') {
        for (idx, ch) in text.char_indices() {
            if ch == '/' {
                break;
            }
            if wildcard_match(rest, &text[idx..]) {
                return true;
            }
        }
        return wildcard_match(rest, "");
    }
    let pat_c = pattern.chars().next().unwrap();
    let text_c = text.chars().next();
    match text_c {
        Some(text_c) if text_c == pat_c => {
            wildcard_match(&pattern[pat_c.len_utf8()..], &text[text_c.len_utf8()..])
        }
        _ => false,
    }
}

fn should_ignore_path(relative: &str, patterns: &[String]) -> bool {
    let rel = relative.replace('\\', "/");
    let rel = rel.trim_start_matches("./");
    patterns.iter().any(|raw| {
        let pattern = raw.trim().replace('\\', "/");
        let pattern = pattern.trim_start_matches("./");
        if pattern.is_empty() {
            return false;
        }
        if pattern.contains('/') {
            wildcard_match(pattern, rel)
        } else {
            rel.split('/')
                .any(|segment| wildcard_match(pattern, segment))
        }
    })
}

fn collect_markdown_paths(
    dir: &Path,
    patterns: &[String],
    out: &mut Vec<std::path::PathBuf>,
    ignored: &mut i64,
    relative: &str,
    depth: usize,
) -> Result<(), String> {
    if depth > 10 {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|e| format!("Read dir failed: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if relative.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative, name)
        };
        if should_ignore_path(&rel, patterns) {
            *ignored += 1;
            continue;
        }
        if path.is_dir() {
            collect_markdown_paths(&path, patterns, out, ignored, &rel, depth + 1)?;
        } else if path.extension().is_some_and(|e| e == "md") {
            out.push(path);
        }
    }
    Ok(())
}

fn read_markdown_file(path: std::path::PathBuf) -> (String, String, String, String) {
    let content = fs::read_to_string(&path).unwrap_or_default();
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
    (path.to_string_lossy().to_string(), title, tags, body)
}

fn index_vault_files(
    conn: &rusqlite::Connection,
    vault_path: &str,
    ignore_patterns: &[String],
    concurrency: usize,
) -> Result<db::IndexResult, String> {
    index_vault_files_inner(conn, vault_path, ignore_patterns, concurrency, None, None)
}

fn index_vault_files_inner(
    conn: &rusqlite::Connection,
    vault_path: &str,
    ignore_patterns: &[String],
    concurrency: usize,
    mut on_progress: Option<&mut dyn FnMut(usize, usize)>,
    should_cancel: Option<&dyn Fn() -> bool>,
) -> Result<db::IndexResult, String> {
    let dir = Path::new(vault_path);
    if !dir.is_dir() {
        return Err("Vault path not a directory".into());
    }
    let mut paths = Vec::new();
    let mut ignored = 0i64;
    collect_markdown_paths(dir, ignore_patterns, &mut paths, &mut ignored, "", 0)?;
    let mut files = Vec::new();
    let workers = if paths.is_empty() {
        0
    } else if concurrency == 0 {
        let cores = std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(4);
        plan_index_concurrency(paths.len(), count_large_vault_files(&paths), cores)
    } else {
        concurrency.clamp(1, 16).min(paths.len())
    };
    if workers > 0 {
        let chunk_size = paths.len().div_ceil(workers);
        std::thread::scope(|scope| {
            let mut handles = Vec::new();
            for chunk in paths.chunks(chunk_size) {
                let chunk = chunk.to_vec();
                handles.push(scope.spawn(move || {
                    chunk
                        .into_iter()
                        .map(read_markdown_file)
                        .collect::<Vec<_>>()
                }));
            }
            for handle in handles {
                files.extend(
                    handle
                        .join()
                        .map_err(|_| "Vault scan worker failed".to_string())?,
                );
            }
            Ok::<(), String>(())
        })?;
    };
    let mut indexed = 0i64;
    let file_count = files.len();
    if file_count > 0 {
        if let Some(callback) = on_progress.as_deref_mut() {
            callback(0, file_count);
        }
    }
    for (path, title, tags, content) in files.iter() {
        if should_cancel.map(|check| check()).unwrap_or(false) {
            return Err("Vault index cancelled".into());
        }
        db::upsert_knowledge_file(conn, path, title, tags, content, vault_path)
            .map_err(|e| e.to_string())?;
        indexed += 1;
        if let Some(callback) = on_progress.as_deref_mut() {
            if indexed % 5 == 0 || indexed == file_count as i64 {
                callback(indexed as usize, file_count);
            }
        }
    }
    Ok(db::IndexResult {
        files: indexed,
        ignored,
        concurrency_used: workers as i64,
    })
}

fn plan_index_concurrency(file_count: usize, large_file_count: usize, cores: usize) -> usize {
    let cores = cores.clamp(1, 16);
    if file_count <= 32 {
        1
    } else if file_count <= 256 || large_file_count >= 8 {
        cores.min(4)
    } else {
        cores.min(16)
    }
}

fn count_large_vault_files(paths: &[std::path::PathBuf]) -> usize {
    paths
        .iter()
        .take(64)
        .filter(|path| {
            fs::metadata(path)
                .map(|meta| meta.len() > 1_048_576)
                .unwrap_or(false)
        })
        .count()
}

fn upsert_markdown_path(
    conn: &rusqlite::Connection,
    path: &Path,
    vault_path: &str,
) -> Result<(), String> {
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
    db::upsert_knowledge_file(
        conn,
        &path.to_string_lossy(),
        &title,
        &tags,
        &body,
        vault_path,
    )
    .map_err(|e| e.to_string())
}

fn sync_vault_path(
    conn: &rusqlite::Connection,
    path: &Path,
    vault_path: &str,
) -> Result<bool, String> {
    if path.extension().is_none_or(|ext| ext != "md") {
        return Ok(false);
    }
    if path.exists() {
        upsert_markdown_path(conn, path, vault_path)?;
        Ok(true)
    } else {
        db::delete_knowledge_file(conn, &path.to_string_lossy()).map_err(|e| e.to_string())?;
        Ok(true)
    }
}

fn sync_vault_event(
    conn: &rusqlite::Connection,
    paths: &[std::path::PathBuf],
    vault_path: &Path,
    ignore_patterns: &[String],
) -> Vec<String> {
    let mut changed_paths = Vec::new();
    let vault_str = vault_path.to_string_lossy().to_string();
    for path in paths {
        let rel = path
            .strip_prefix(vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        if should_ignore_path(&rel, ignore_patterns) {
            continue;
        }
        if let Ok(synced) = sync_vault_path(conn, path, &vault_str) {
            if synced {
                changed_paths.push(path.to_string_lossy().to_string());
            }
        }
    }
    changed_paths
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
    let (watching, paths) = match app.try_state::<VaultWatchState>() {
        Some(state) => match state.active.lock() {
            Ok(active) => {
                let paths: Vec<String> = active.iter().map(|handle| handle.path.clone()).collect();
                (!paths.is_empty(), paths)
            }
            Err(_) => (false, Vec::new()),
        },
        None => (false, Vec::new()),
    };
    let status = db::knowledge_index_status(conn).map_err(|e| e.to_string())?;
    Ok(VaultWatchStatus {
        watching,
        path: paths.first().cloned(),
        paths,
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
fn set_task_due_date(
    state: State<'_, db::Db>,
    id: String,
    due_date: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_task_due_date(&conn, &id, due_date.as_deref()).map_err(|e| e.to_string())
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
fn list_quick_prompts(state: State<'_, db::Db>) -> Result<Vec<db::QuickPrompt>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_quick_prompts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_custom_quick_prompt(
    state: State<'_, db::Db>,
    label: String,
    category: String,
    text: String,
) -> Result<db::QuickPrompt, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = now_millis();
    let sort_order = db::next_quick_prompt_order(&conn).map_err(|e| e.to_string())?;
    let prompt = db::QuickPrompt {
        id: uuid::Uuid::new_v4().to_string(),
        label,
        category,
        text,
        custom: true,
        sort_order,
        updated_at: now,
        created_at: now,
    };
    db::upsert_quick_prompt(&conn, &prompt).map_err(|e| e.to_string())?;
    Ok(prompt)
}

#[tauri::command]
fn update_custom_quick_prompt(
    state: State<'_, db::Db>,
    id: String,
    label: String,
    category: String,
    text: String,
) -> Result<db::QuickPrompt, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_custom_quick_prompt(&conn, &id, &label, &category, &text).map_err(|e| e.to_string())
}

#[tauri::command]
fn reorder_custom_quick_prompts(
    state: State<'_, db::Db>,
    ids: Vec<String>,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::reorder_custom_quick_prompts(&conn, &ids).map_err(|e| e.to_string())?;
    Ok(ids.len())
}

#[tauri::command]
fn delete_custom_quick_prompt(state: State<'_, db::Db>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_quick_prompt(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_quick_prompt_usage(
    state: State<'_, db::Db>,
) -> Result<Vec<db::QuickPromptUsageEntry>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_quick_prompt_usage(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_quick_prompt_usage(state: State<'_, db::Db>, id: String) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::record_quick_prompt_usage(&conn, &id).map_err(|e| e.to_string())
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
    model: Option<String>,
) -> Result<db::Provider, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_provider(
        &conn,
        &name,
        &base_url,
        &api_key,
        &model.unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
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
    drop(conn);
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
        let key_ref = if provider.api_key.is_empty() {
            "OPENAI_API_KEY"
        } else {
            &provider.api_key
        };
        let api_key = get_api_key(key_ref)?;
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
fn search_sessions(
    state: State<'_, db::Db>,
    query: String,
    since: Option<i64>,
    until: Option<i64>,
    limit: Option<i64>,
    include_messages: Option<bool>,
) -> Result<Vec<db::SessionSearchHit>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::search_sessions(
        &conn,
        &query,
        since,
        until,
        limit,
        include_messages.unwrap_or(true),
    )
    .map_err(|e| e.to_string())
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
fn set_session_pinned(state: State<'_, db::Db>, id: String, pinned: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_session_pinned(&conn, &id, pinned).map_err(|e| e.to_string())
}

#[tauri::command]
fn duplicate_session(state: State<'_, db::Db>, id: String) -> Result<db::Session, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::duplicate_session(&conn, &id)
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
    index_vault_files(&conn, &vault_path, &[], 4)
}

#[tauri::command]
fn index_vault_ex(
    state: State<'_, db::Db>,
    vault_path: String,
    ignore_patterns: Vec<String>,
    concurrency: usize,
) -> Result<db::IndexResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    index_vault_files(&conn, &vault_path, &ignore_patterns, concurrency)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexProgress {
    run_id: String,
    path: String,
    done: usize,
    total: usize,
    files: i64,
    ignored: i64,
    concurrency_used: i64,
    status: String,
}

fn emit_vault_index_queue(app: &tauri::AppHandle) {
    if let Ok(status) = app.state::<VaultIndexState>().snapshot() {
        let _ = app.emit("vault-index-queue", status);
    }
}

fn spawn_vault_index_worker(
    app: tauri::AppHandle,
    request: VaultIndexRequest,
) -> Result<(), String> {
    let run_id = request.run_id.clone();
    let app_clone = app.clone();
    let run_path = request.path.clone();
    let thread_run_id = run_id.clone();
    let ignore_patterns = request.ignore_patterns.clone();
    let concurrency = request.concurrency;
    let latest = std::sync::Arc::new(std::sync::Mutex::new((0usize, 0usize)));
    let latest_clone = latest.clone();
    thread::Builder::new()
        .name("vault-index".to_string())
        .spawn(move || {
            let Some(db_state) = app_clone.try_state::<db::Db>() else {
                return;
            };
            let Ok(conn) = db_state.0.lock() else {
                return;
            };
            let mut emit_progress = |done: usize, total: usize| {
                if let Ok(mut slot) = latest_clone.lock() {
                    *slot = (done, total);
                }
                let payload = IndexProgress {
                    run_id: thread_run_id.clone(),
                    path: run_path.clone(),
                    done,
                    total,
                    files: 0,
                    ignored: 0,
                    concurrency_used: 0,
                    status: "running".to_string(),
                };
                let _ = app_clone.emit("vault-index-progress", payload);
            };
            let cancel_run_id = thread_run_id.clone();
            let is_cancelled = || is_vault_index_cancelled(&app_clone, &cancel_run_id);
            let result = index_vault_files_inner(
                &conn,
                &run_path,
                &ignore_patterns,
                concurrency,
                Some(&mut emit_progress),
                Some(&is_cancelled),
            );
            let cancelled = is_cancelled();
            let (last_done, last_total) = latest.lock().map(|slot| *slot).unwrap_or((0, 0));
            let (status, done, total, files, ignored, concurrency_used) = match result {
                Ok(index_result) => (
                    "done".to_string(),
                    index_result.files as usize,
                    index_result.files as usize,
                    index_result.files,
                    index_result.ignored,
                    index_result.concurrency_used,
                ),
                Err(_) if cancelled => ("cancelled".to_string(), last_done, last_total, 0, 0, 0),
                Err(error) => (format!("error: {}", error), 0, 0, 0, 0, 0),
            };
            let retry_error = status.strip_prefix("error:").map(|s| s.trim().to_string());
            let payload = IndexProgress {
                run_id: thread_run_id.clone(),
                path: run_path,
                done,
                total,
                files,
                ignored,
                concurrency_used,
                status,
            };
            let _ = app_clone.emit("vault-index-progress", payload);
            clear_vault_index_cancel(&app_clone, &thread_run_id);
            let retry = if let Some(error) = retry_error {
                app_clone
                    .state::<VaultIndexState>()
                    .retry_failed(&thread_run_id, &error)
                    .ok()
                    .flatten()
            } else {
                let _ = app_clone
                    .state::<VaultIndexState>()
                    .finish_active(&thread_run_id);
                None
            };
            if let Some(retry) = retry {
                persist_vault_index_request(&app_clone, &retry, "queued");
                thread::sleep(Duration::from_millis(vault_index_retry_delay_ms(
                    retry.attempts,
                )));
                emit_vault_index_queue(&app_clone);
            } else {
                delete_vault_index_request(&app_clone, &thread_run_id);
                emit_vault_index_queue(&app_clone);
            }
            let _ = maybe_start_next_vault_index(&app_clone);
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn maybe_start_next_vault_index(app: &tauri::AppHandle) -> Result<(), String> {
    let request = app.state::<VaultIndexState>().claim_next()?;
    if let Some(request) = request {
        if let Err(error) = spawn_vault_index_worker(app.clone(), request.clone()) {
            let _ = app
                .state::<VaultIndexState>()
                .finish_active(&request.run_id);
            emit_vault_index_queue(app);
            return Err(error);
        }
    }
    emit_vault_index_queue(app);
    Ok(())
}

fn persist_vault_index_request(app: &tauri::AppHandle, request: &VaultIndexRequest, status: &str) {
    if let Some(db_state) = app.try_state::<db::Db>() {
        if let Ok(conn) = db_state.0.lock() {
            let record = db::VaultIndexQueueRecord {
                run_id: request.run_id.clone(),
                path: request.path.clone(),
                ignore_patterns: request.ignore_patterns.clone(),
                concurrency: request.concurrency,
                status: status.to_string(),
                priority: request.priority,
                attempts: request.attempts,
                last_error: request.last_error.clone(),
            };
            let _ = db::persist_vault_index_queue(&conn, &record);
        }
    }
}

fn delete_vault_index_request(app: &tauri::AppHandle, run_id: &str) {
    if let Some(db_state) = app.try_state::<db::Db>() {
        if let Ok(conn) = db_state.0.lock() {
            let _ = db::delete_vault_index_queue(&conn, run_id);
        }
    }
}

fn enqueue_restored_requests(
    state: &VaultIndexState,
    records: Vec<db::VaultIndexQueueRecord>,
) -> usize {
    let mut restored = 0usize;
    for record in records {
        if (record.status == "queued" || record.status == "running")
            && state
                .enqueue(VaultIndexRequest {
                    run_id: record.run_id,
                    path: record.path,
                    ignore_patterns: record.ignore_patterns,
                    concurrency: record.concurrency,
                    priority: record.priority,
                    attempts: record.attempts,
                    last_error: record.last_error,
                })
                .is_ok()
        {
            restored += 1;
        }
    }
    restored
}

fn restore_vault_index_queue(app: &tauri::AppHandle) {
    let Some(db_state) = app.try_state::<db::Db>() else {
        return;
    };
    let records = {
        let Ok(conn) = db_state.0.lock() else {
            return;
        };
        let Ok(records) = db::list_vault_index_queue(&conn) else {
            return;
        };
        for record in &records {
            if record.status == "running" {
                let mut reset = record.clone();
                reset.status = "queued".to_string();
                let _ = db::persist_vault_index_queue(&conn, &reset);
            }
        }
        records
    };
    let restored = enqueue_restored_requests(&app.state::<VaultIndexState>(), records);
    if restored > 0 {
        let _ = maybe_start_next_vault_index(app);
    }
}

#[tauri::command]
fn start_vault_index(
    app: tauri::AppHandle,
    vault_path: String,
    ignore_patterns: Vec<String>,
    concurrency: usize,
    priority: Option<usize>,
) -> Result<String, String> {
    let run_id = uuid::Uuid::new_v4().to_string();
    let request = VaultIndexRequest {
        run_id: run_id.clone(),
        path: vault_path.clone(),
        ignore_patterns,
        concurrency,
        priority: priority.unwrap_or(0),
        attempts: 0,
        last_error: String::new(),
    };
    let position = app.state::<VaultIndexState>().enqueue(request.clone())?;
    persist_vault_index_request(&app, &request, "queued");
    let _ = app.emit(
        "vault-index-progress",
        IndexProgress {
            run_id: run_id.clone(),
            path: vault_path,
            done: 0,
            total: 0,
            files: 0,
            ignored: 0,
            concurrency_used: 0,
            status: if position > 1 {
                "queued".to_string()
            } else {
                "running".to_string()
            },
        },
    );
    maybe_start_next_vault_index(&app)?;
    Ok(run_id)
}

#[tauri::command]
fn cancel_vault_index(
    app: tauri::AppHandle,
    state: State<'_, VaultIndexState>,
    run_id: String,
) -> Result<bool, String> {
    let active = state
        .inner
        .lock()
        .map_err(|e| e.to_string())?
        .active
        .as_ref()
        .map(|request| request.run_id == run_id)
        .unwrap_or(false);
    let _ = state.mark(&run_id);
    let removed_path = if active {
        None
    } else {
        state.take_queued(&run_id).map(|request| request.path)
    };
    if !active {
        if let Some(path) = removed_path {
            delete_vault_index_request(&app, &run_id);
            let _ = app.emit(
                "vault-index-progress",
                IndexProgress {
                    run_id,
                    path,
                    done: 0,
                    total: 0,
                    files: 0,
                    ignored: 0,
                    concurrency_used: 0,
                    status: "cancelled".to_string(),
                },
            );
        }
        emit_vault_index_queue(&app);
        maybe_start_next_vault_index(&app)?;
    }
    Ok(true)
}

#[tauri::command]
fn get_vault_index_queue_status(
    state: State<'_, VaultIndexState>,
) -> Result<VaultIndexQueueStatus, String> {
    state.snapshot()
}

#[tauri::command]
fn get_knowledge_index_status(
    state: State<'_, db::Db>,
) -> Result<db::KnowledgeIndexStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::knowledge_index_status(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_vault_target_stats(state: State<'_, db::Db>) -> Result<Vec<db::VaultTargetStats>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::vault_target_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_knowledge_files(
    state: State<'_, db::Db>,
    vault_path: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<db::KnowledgeFileRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_knowledge_files(&conn, vault_path.as_deref(), limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn cleanup_knowledge_files(
    state: State<'_, db::Db>,
    vault_path: Option<String>,
) -> Result<db::KnowledgeCleanupResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::cleanup_knowledge_files(&conn, vault_path.as_deref()).map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecommendedConcurrency {
    recommended: usize,
    cores: usize,
}

fn recommended_index_concurrency() -> usize {
    let cores = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(4);
    cores.clamp(1, 16)
}

#[tauri::command]
fn recommend_index_concurrency() -> RecommendedConcurrency {
    let cores = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(4);
    RecommendedConcurrency {
        recommended: recommended_index_concurrency(),
        cores,
    }
}

fn start_vault_watch_impl(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: String,
    ignore_patterns: Vec<String>,
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
        let mut remaining = Vec::with_capacity(active.len());
        for handle in active.drain(..) {
            if handle.path == canonical_str {
                handle.stop();
            } else {
                remaining.push(handle);
            }
        }
        *active = remaining;
    }
    {
        let conn = db_state.0.lock().map_err(|e| e.to_string())?;
        index_vault_files(&conn, &canonical_str, &ignore_patterns, 4)?;
    }
    let app_clone = app.clone();
    let canonical_for_events = canonical.clone();
    let patterns_for_config = ignore_patterns.clone();
    let on_event = move |event: &Event| {
        let event_kind = match &event.kind {
            EventKind::Create(_) => "created",
            EventKind::Modify(_) => "modified",
            EventKind::Remove(_) => "removed",
            _ => return,
        };
        let Some(db_state) = app_clone.try_state::<db::Db>() else {
            return;
        };
        let Ok(conn) = db_state.0.lock() else {
            return;
        };
        let vault_str = canonical_for_events.to_string_lossy().to_string();
        let changed_paths =
            sync_vault_event(&conn, &event.paths, &canonical_for_events, &ignore_patterns);
        if !changed_paths.is_empty() {
            for file_path in changed_paths {
                let _ = db::touch_vault_watch_event(&conn, &vault_str, &file_path, event_kind);
            }
            if let Ok(status) = vault_watch_status(&app_clone, &conn) {
                let _ = app_clone.emit("vault-watch-update", status);
            }
        }
    };
    let handle = start_vault_watcher(canonical_str.clone(), on_event)?;
    state.active.lock().map_err(|e| e.to_string())?.push(handle);
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    db::upsert_vault_watch_target(&conn, &canonical_str, &patterns_for_config, true)
        .map_err(|e| e.to_string())?;
    let status = vault_watch_status(&app, &conn)?;
    let _ = app.emit("vault-watch-update", status.clone());
    Ok(status)
}

#[tauri::command]
fn start_vault_watch(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: String,
) -> Result<VaultWatchStatus, String> {
    start_vault_watch_impl(app, state, db_state, vault_path, Vec::new())
}

#[tauri::command]
fn start_vault_watch_ex(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: String,
    ignore_patterns: Vec<String>,
) -> Result<VaultWatchStatus, String> {
    start_vault_watch_impl(app, state, db_state, vault_path, ignore_patterns)
}

#[tauri::command]
fn stop_vault_watch(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: Option<String>,
) -> Result<VaultWatchStatus, String> {
    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        let mut remaining = Vec::with_capacity(active.len());
        for handle in active.drain(..) {
            let matches = match &vault_path {
                Some(path) => handle.path == *path,
                None => true,
            };
            if matches {
                handle.stop();
            } else {
                remaining.push(handle);
            }
        }
        *active = remaining;
    }
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    if let Some(path) = &vault_path {
        let _ = db::set_vault_watch_target_enabled(&conn, path, false);
    } else {
        let targets = db::list_vault_watch_targets(&conn).map_err(|e| e.to_string())?;
        for target in targets {
            let _ = db::set_vault_watch_target_enabled(&conn, &target.path, false);
        }
    }
    let status = vault_watch_status(&app, &conn)?;
    let _ = app.emit("vault-watch-update", status.clone());
    Ok(status)
}

#[tauri::command]
fn list_vault_watch_targets(
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
) -> Result<Vec<db::VaultWatchTarget>, String> {
    let active_paths: Vec<String> = match state.active.lock() {
        Ok(active) => active.iter().map(|handle| handle.path.clone()).collect(),
        Err(_) => Vec::new(),
    };
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    let mut targets = db::list_vault_watch_targets(&conn).map_err(|e| e.to_string())?;
    for target in &mut targets {
        target.enabled = active_paths.contains(&target.path);
    }
    Ok(targets)
}

#[tauri::command]
fn upsert_vault_watch_target(
    state: State<'_, db::Db>,
    target: db::VaultWatchTarget,
) -> Result<db::VaultWatchTarget, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::upsert_vault_watch_target(&conn, &target.path, &target.ignore_patterns, target.enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_vault_watch_target(
    app: tauri::AppHandle,
    state: State<'_, VaultWatchState>,
    db_state: State<'_, db::Db>,
    vault_path: String,
) -> Result<bool, String> {
    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        let mut remaining = Vec::with_capacity(active.len());
        for handle in active.drain(..) {
            if handle.path == vault_path {
                handle.stop();
            } else {
                remaining.push(handle);
            }
        }
        *active = remaining;
    }
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    let deleted = db::delete_vault_watch_target(&conn, &vault_path).map_err(|e| e.to_string())?;
    let status = vault_watch_status(&app, &conn)?;
    let _ = app.emit("vault-watch-update", status.clone());
    Ok(deleted)
}

#[tauri::command]
fn list_vault_watch_events(
    state: State<'_, db::Db>,
    vault_path: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<db::VaultWatchEvent>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_vault_watch_events(&conn, vault_path.as_deref(), limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_vault_watch_events(
    state: State<'_, db::Db>,
    vault_path: Option<String>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_vault_watch_events(&conn, vault_path.as_deref()).map_err(|e| e.to_string())
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

#[tauri::command]
fn get_vault_watch_config(state: State<'_, db::Db>) -> Result<db::VaultWatchConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_vault_watch_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_vault_watch_config(
    state: State<'_, db::Db>,
    config: db::VaultWatchConfig,
) -> Result<db::VaultWatchConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_vault_watch_config(&conn, &config.path, &config.ignore_patterns, config.enabled)
        .map_err(|e| e.to_string())
}

fn restore_vault_watch(app: tauri::AppHandle) {
    let Some(db_state) = app.try_state::<db::Db>() else {
        return;
    };
    let targets = {
        let Ok(conn) = db_state.0.lock() else {
            return;
        };
        db::list_vault_watch_targets(&conn).ok()
    };
    if let Some(targets) = targets {
        for target in targets {
            if !target.enabled || target.path.is_empty() {
                continue;
            }
            let _ = start_vault_watch_impl(
                app.clone(),
                app.state::<VaultWatchState>(),
                db_state.clone(),
                target.path,
                target.ignore_patterns,
            );
        }
    }
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

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn spawn_webhook_delivery_worker(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let Some(state) = app.try_state::<db::Db>() else {
            continue;
        };
        let now = now_millis();
        let claimed = {
            let Ok(conn) = state.0.lock() else {
                continue;
            };
            let Ok(due) = db::list_due_webhook_rules(&conn, now) else {
                continue;
            };
            for rule in &due {
                let payload = render_webhook_payload(&rule.payload, "", None, now);
                let _ = db::enqueue_webhook_delivery(&conn, rule, "", &payload);
                let _ = db::mark_webhook_rule_run(&conn, &rule.id, 202, "Queued for delivery");
            }
            let Ok(claimed) = db::claim_due_webhook_deliveries(&conn, now, 8) else {
                continue;
            };
            claimed
        };
        for delivery in claimed {
            let token = if delivery.token.trim().is_empty() {
                None
            } else {
                Some(delivery.token.as_str())
            };
            let secret = if delivery.secret.trim().is_empty() {
                None
            } else {
                Some(delivery.secret.as_str())
            };
            let outcome = deliver_webhook_http(
                &delivery.url,
                &delivery.payload,
                &delivery.method,
                token,
                secret,
                0,
            );
            let (ok, status, message) = match outcome {
                Ok(result) => (true, result.status as i64, result.message),
                Err(err) => (false, 0, format!("Webhook delivery failed: {}", err)),
            };
            let Ok(conn) = state.0.lock() else {
                continue;
            };
            let attempts = delivery.attempts + 1;
            let max_attempts = delivery.retries.max(0) + 1;
            let dead = !ok && attempts >= max_attempts;
            let next_attempt_at = if ok || dead {
                now
            } else {
                now + 1000 * (1_i64 << attempts.min(6))
            };
            let state = if dead {
                "dead"
            } else if ok {
                "success"
            } else {
                "queued"
            };
            let _ = db::complete_webhook_delivery(
                &conn,
                &delivery.id,
                state,
                status,
                &message,
                attempts,
                next_attempt_at,
            );
        }
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
    drop(conn);
    let messages_json =
        serde_json::json!([{ "role": "user", "content": "Ping stream e2e" }]).to_string();
    let mut chunks = 0usize;
    let mut chars = 0usize;
    let started = std::time::Instant::now();
    let is_cancelled = || false;
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
                selected.push(p);
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
        let mut previous_name: Option<String> = None;
        let mut previous_output = String::new();
        for provider in providers {
            if is_stream_cancelled(&app, &run_id) {
                break;
            }
            let step_messages_json = match &previous_name {
                Some(name) => append_moa_chain_context(&messages_json, name, &previous_output)?,
                None => messages_json.clone(),
            };
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: run_id.clone(),
                    delta: format!("\n\n## {}\n\n", provider.name),
                    done: false,
                    error: None,
                    cancelled: false,
                },
            );
            let app_step = app.clone();
            let run_id_step = run_id.clone();
            let provider_step = provider.clone();
            let streamed: Result<String, String> =
                tauri::async_runtime::spawn_blocking(move || {
                    stream_provider(&app_step, &run_id_step, &provider_step, &step_messages_json)
                })
                .await
                .map_err(|e| e.to_string())?;
            match streamed {
                Ok(text) => {
                    previous_output = text;
                    previous_name = Some(provider.name);
                }
                Err(err) => {
                    if !is_stream_cancelled(&app, &run_id) {
                        let _ = app.emit(
                            "stream-chunk",
                            StreamChunk {
                                id: run_id.clone(),
                                delta: format!("\n[{} error: {}]\n", provider.name, err),
                                done: false,
                                error: None,
                                cancelled: false,
                            },
                        );
                    }
                    previous_output = String::new();
                    previous_name = Some(provider.name);
                }
            }
        }
        Ok(())
    } else if moa {
        let mut tasks: Vec<tauri::async_runtime::JoinHandle<Result<String, String>>> = Vec::new();
        for provider in selected.into_iter().take(3) {
            let app = app.clone();
            let run_id = run_id.clone();
            let messages_json = messages_json.clone();
            tasks.push(tauri::async_runtime::spawn_blocking(move || {
                if is_stream_cancelled(&app, &run_id) {
                    return Ok(String::new());
                }
                let _ = app.emit(
                    "stream-chunk",
                    StreamChunk {
                        id: run_id.clone(),
                        delta: format!("\n\n## {}\n\n", provider.name),
                        done: false,
                        error: None,
                        cancelled: false,
                    },
                );
                match stream_provider(&app, &run_id, &provider, &messages_json) {
                    Ok(text) => Ok(text),
                    Err(err) => {
                        if !is_stream_cancelled(&app, &run_id) {
                            let _ = app.emit(
                                "stream-chunk",
                                StreamChunk {
                                    id: run_id.clone(),
                                    delta: format!("\n[{} error: {}]\n", provider.name, err),
                                    done: false,
                                    error: None,
                                    cancelled: false,
                                },
                            );
                        }
                        Ok(String::new())
                    }
                }
            }));
        }
        let mut outputs = Vec::new();
        for task in tasks {
            let task_result = task.await.map_err(|e| e.to_string())?;
            outputs.push(task_result?);
        }
        if !is_stream_cancelled(&app, &run_id) && outputs.iter().any(|text| !text.is_empty()) {
            let consensus = build_moa_consensus_text(outputs);
            let _ = app.emit(
                "stream-chunk",
                StreamChunk {
                    id: run_id.clone(),
                    delta: format!("\n\n## MOA Consensus\n\n{}", consensus),
                    done: false,
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

#[tauri::command]
fn deliver_webhook(
    url: String,
    payload: String,
    method: Option<String>,
    token: Option<String>,
    secret: Option<String>,
    retries: Option<u32>,
) -> Result<WebhookDeliveryResult, String> {
    deliver_webhook_http(
        &url,
        &payload,
        method.as_deref().unwrap_or("POST"),
        token.as_deref(),
        secret.as_deref(),
        retries.unwrap_or(1),
    )
}

fn render_webhook_payload(
    template: &str,
    event: &str,
    context: Option<&Value>,
    now_ms: i64,
) -> String {
    let mut out = String::with_capacity(template.len() + 64);
    let mut rest = template;
    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find("}}") else {
            out.push_str(&rest[start..]);
            break;
        };
        let key = after[..end].trim();
        let replacement = match key {
            "event" => Some(serde_json::Value::String(event.to_string()).to_string()),
            "ts" => Some(serde_json::Value::String(now_ms.to_string()).to_string()),
            _ if key.starts_with("context.") => {
                let field = &key["context.".len()..];
                context
                    .and_then(|ctx| ctx.get(field))
                    .map(|value| value.to_string())
                    .or_else(|| Some("null".to_string()))
            }
            _ => None,
        };
        match replacement {
            Some(value) => out.push_str(&value),
            None => out.push_str(&rest[start..=end + 1]),
        }
        rest = &after[end + 2..];
    }
    out.push_str(rest);
    out
}

fn run_webhook_rule_inner(
    conn: &rusqlite::Connection,
    rule_id: &str,
) -> Result<WebhookDeliveryResult, String> {
    let rule = db::get_webhook_rule(conn, rule_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Webhook rule not found".to_string())?;
    let token = if rule.token.trim().is_empty() {
        None
    } else {
        Some(rule.token.as_str())
    };
    let secret = if rule.secret.trim().is_empty() {
        None
    } else {
        Some(rule.secret.as_str())
    };
    let payload = render_webhook_payload(&rule.payload, &rule.trigger_event, None, now_millis());
    let result = deliver_webhook_http(
        &rule.url,
        &payload,
        &rule.method,
        token,
        secret,
        rule.retries.max(0) as u32,
    )?;
    db::mark_webhook_rule_run(conn, &rule.id, result.status as i64, &result.message)
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn list_webhook_rules(state: State<'_, db::Db>) -> Result<Vec<db::WebhookRule>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_webhook_rules(&conn).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebhookRuleRequest {
    name: String,
    url: String,
    payload: String,
    method: Option<String>,
    token: Option<String>,
    secret: Option<String>,
    retries: Option<i64>,
    interval_seconds: i64,
    trigger_event: Option<String>,
}

#[tauri::command]
fn create_webhook_rule(
    state: State<'_, db::Db>,
    request: WebhookRuleRequest,
) -> Result<db::WebhookRule, String> {
    if request.name.trim().is_empty() {
        return Err("Rule name is required".to_string());
    }
    if request.url.trim().is_empty() {
        return Err("Webhook URL is required".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_webhook_rule(
        &conn,
        &db::WebhookRuleInput {
            name: request.name.trim(),
            url: request.url.trim(),
            payload: &request.payload,
            method: request.method.as_deref().unwrap_or("POST"),
            token: request.token.as_deref().unwrap_or(""),
            secret: request.secret.as_deref().unwrap_or(""),
            retries: request.retries.unwrap_or(1).max(0),
            interval_seconds: request.interval_seconds.max(5),
            trigger_event: request.trigger_event.as_deref().unwrap_or("").trim(),
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_webhook_rule_enabled(
    state: State<'_, db::Db>,
    id: String,
    enabled: bool,
) -> Result<db::WebhookRule, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_webhook_rule_enabled(&conn, &id, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_webhook_rule(state: State<'_, db::Db>, id: String) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_webhook_rule(&conn, &id).map_err(|e| e.to_string())?;
    Ok(format!(
        "Deleted webhook rule {}",
        id.chars().take(8).collect::<String>()
    ))
}

#[tauri::command]
fn run_webhook_rule(state: State<'_, db::Db>, id: String) -> Result<WebhookDeliveryResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    run_webhook_rule_inner(&conn, &id)
}

#[tauri::command]
fn trigger_webhook_event(
    state: State<'_, db::Db>,
    event: String,
    context: Option<Value>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rules = db::list_event_webhook_rules(&conn, &event).map_err(|e| e.to_string())?;
    let mut count = 0i64;
    for rule in &rules {
        let payload = render_webhook_payload(&rule.payload, &event, context.as_ref(), now_millis());
        db::enqueue_webhook_delivery(&conn, rule, &event, &payload).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
fn list_webhook_deliveries(
    state: State<'_, db::Db>,
    limit: Option<i64>,
    status: Option<String>,
) -> Result<Vec<db::WebhookDelivery>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_webhook_deliveries(
        &conn,
        limit.unwrap_or(50).clamp(1, 200),
        &status.unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn retry_webhook_delivery(
    state: State<'_, db::Db>,
    id: String,
) -> Result<db::WebhookDelivery, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::retry_webhook_delivery(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_webhook_delivery(state: State<'_, db::Db>, id: String) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_webhook_delivery(&conn, &id).map_err(|e| e.to_string())?;
    Ok(format!(
        "Deleted webhook delivery {}",
        id.chars().take(8).collect::<String>()
    ))
}

#[tauri::command]
fn clear_webhook_deliveries(
    state: State<'_, db::Db>,
    status: Option<String>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_webhook_deliveries(&conn, &status.unwrap_or_default()).map_err(|e| e.to_string())
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
                selected.push(p);
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
            let conn = db::init_connection(&dir.join("workbench.db")).expect("init db");
            app.manage(db::Db(std::sync::Mutex::new(conn)));
            app.manage(StreamCancellation::default());
            app.manage(ProviderHeartbeat::default());
            app.manage(VaultWatchState::default());
            app.manage(VaultIndexState::default());
            restore_vault_index_queue(app.handle());
            restore_vault_watch(app.handle().clone());
            spawn_clipboard_monitor(app.handle().clone());
            spawn_provider_heartbeat_monitor(app.handle().clone());
            spawn_webhook_delivery_worker(app.handle().clone());
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
            set_task_due_date,
            list_projects,
            create_project,
            update_project,
            list_thoughts,
            create_thought,
            update_thought_tags,
            list_quick_prompts,
            add_custom_quick_prompt,
            update_custom_quick_prompt,
            reorder_custom_quick_prompts,
            delete_custom_quick_prompt,
            list_quick_prompt_usage,
            record_quick_prompt_usage,
            list_providers,
            create_provider,
            set_provider_active,
            set_provider_priority,
            update_provider_model,
            list_provider_models,
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
            search_sessions,
            create_session,
            rename_session,
            set_session_pinned,
            duplicate_session,
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
            get_error_log_summary,
            export_sync_snapshot,
            import_sync_snapshot,
            encrypt_sync_payload_command,
            decrypt_sync_payload_command,
            export_encrypted_sync_snapshot,
            import_encrypted_sync_snapshot,
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
            get_rag_index_status,
            index_vault,
            index_vault_ex,
            start_vault_index,
            cancel_vault_index,
            get_vault_index_queue_status,
            get_knowledge_index_status,
            recommend_index_concurrency,
            list_vault_target_stats,
            list_knowledge_files,
            cleanup_knowledge_files,
            start_vault_watch,
            start_vault_watch_ex,
            stop_vault_watch,
            list_vault_watch_targets,
            upsert_vault_watch_target,
            delete_vault_watch_target,
            list_vault_watch_events,
            clear_vault_watch_events,
            get_vault_watch_status,
            get_vault_watch_config,
            set_vault_watch_config,
            get_project_git_context,
            get_git_activity,
            get_git_file_diff,
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
            deliver_webhook,
            list_webhook_rules,
            create_webhook_rule,
            set_webhook_rule_enabled,
            delete_webhook_rule,
            run_webhook_rule,
            trigger_webhook_event,
            list_webhook_deliveries,
            retry_webhook_delivery,
            delete_webhook_delivery,
            clear_webhook_deliveries,
            run_provider_stream_smoke_test,
            run_provider_e2e_stream
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
    fn auto_fallback_marker_links_provider_names() {
        assert_eq!(
            auto_fallback_marker("Alpha", "Beta"),
            "\n[auto fallback: Alpha → Beta]\n"
        );
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
    fn webhook_payload_template_renders_event_ts_and_context() {
        let context = serde_json::json!({
            "note": "hello",
            "count": 2,
            "nested": { "ok": true }
        });
        let rendered = render_webhook_payload(
            r#"{"event":{{event}},"ts":{{ts}},"note":{{context.note}},"count":{{context.count}},"nested":{{context.nested}},"missing":{{context.missing}}}"#,
            "sync.completed",
            Some(&context),
            12345,
        );
        let value: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        assert_eq!(value["event"], "sync.completed");
        assert_eq!(value["ts"], "12345");
        assert_eq!(value["note"], "hello");
        assert_eq!(value["count"], 2);
        assert_eq!(value["nested"]["ok"], true);
        assert!(value["missing"].is_null());
    }

    #[test]
    fn webhook_payload_template_without_variables_is_unchanged() {
        let template = r#"{"event":"daily.summary","source":"ai-workbench"}"#;
        assert_eq!(
            render_webhook_payload(template, "sync.completed", None, 123),
            template
        );
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
                created_at: 1,
            },
            db::Project {
                id: "p-b".to_string(),
                name: "Beta".to_string(),
                path: Some(second.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                created_at: 2,
            },
            db::Project {
                id: "p-c".to_string(),
                name: "No Git".to_string(),
                path: None,
                revenue: 0.0,
                status: "active".to_string(),
                created_at: 3,
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
                created_at: 1,
            },
            db::Project {
                id: "p-b".to_string(),
                name: "Beta".to_string(),
                path: Some(second.to_string_lossy().to_string()),
                revenue: 0.0,
                status: "active".to_string(),
                created_at: 2,
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
        let result = index_vault_files(&conn, vault.to_str().unwrap(), &[], 4).unwrap();
        assert_eq!(result.files, 2);
        assert_eq!(result.ignored, 0);
        let status = db::knowledge_index_status(&conn).unwrap();
        assert_eq!(status.files, 2);
        let results = db::search_thoughts(&conn, "obsidian vault", 5).unwrap();
        assert!(results.iter().any(|r| r.content.contains("Obsidian")));
        assert!(results.iter().any(|r| r.kind == "doc"));
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn vault_index_ex_parallel_respects_ignore_patterns() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-vault-ignore-test-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(vault.join("node_modules")).unwrap();
        std::fs::create_dir_all(vault.join("archive")).unwrap();
        std::fs::create_dir_all(vault.join("notes")).unwrap();
        std::fs::write(vault.join("keep.md"), "# Keep\n\nindexed").unwrap();
        std::fs::write(vault.join("node_modules").join("pkg.md"), "# Dep\n\nskip").unwrap();
        std::fs::write(vault.join("archive").join("old.md"), "# Old\n\nskip").unwrap();
        std::fs::write(vault.join("notes").join("deep.md"), "# Deep\n\nindexed").unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let patterns = vec!["node_modules".to_string(), "archive/**".to_string()];
        let result = index_vault_files(&conn, vault.to_str().unwrap(), &patterns, 4).unwrap();
        assert_eq!(result.files, 2);
        assert_eq!(result.ignored, 2);
        let status = db::knowledge_index_status(&conn).unwrap();
        assert_eq!(status.files, 2);
        let search = db::search_thoughts(&conn, "keep deep", 5).unwrap();
        assert!(search.iter().any(|r| r.content.contains("Keep")));
        assert!(search.iter().any(|r| r.content.contains("Deep")));
        assert!(!search.iter().any(|r| r.content.contains("skip")));
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn vault_index_concurrency_bounds_keep_results_stable() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-vault-concurrency-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(&vault).unwrap();
        std::fs::write(vault.join("a.md"), "# A\n\na").unwrap();
        std::fs::write(vault.join("b.md"), "# B\n\nb").unwrap();
        std::fs::write(vault.join("c.md"), "# C\n\nc").unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        for concurrency in [0usize, 1, 3, 16, 100] {
            let result =
                index_vault_files(&conn, vault.to_str().unwrap(), &[], concurrency).unwrap();
            assert_eq!(result.files, 3);
            assert_eq!(result.ignored, 0);
            assert!((1..=3).contains(&result.concurrency_used));
        }
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn plan_index_concurrency_scales_with_file_count() {
        assert_eq!(plan_index_concurrency(0, 0, 8), 1);
        assert_eq!(plan_index_concurrency(32, 0, 8), 1);
        assert_eq!(plan_index_concurrency(100, 0, 8), 4);
        assert_eq!(plan_index_concurrency(300, 0, 8), 8);
        assert_eq!(plan_index_concurrency(300, 8, 8), 4);
        assert_eq!(plan_index_concurrency(300, 8, 2), 2);
    }

    #[test]
    fn index_progress_callback_reports_steps() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-vault-progress-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(&vault).unwrap();
        for name in ["a.md", "b.md", "c.md"] {
            std::fs::write(vault.join(name), format!("# {}\n\n{}", name, name)).unwrap();
        }
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let mut calls = Vec::new();
        let result = index_vault_files_inner(
            &conn,
            vault.to_str().unwrap(),
            &[],
            4,
            Some(&mut |done, total| calls.push((done, total))),
            None,
        )
        .unwrap();
        assert_eq!(result.files, 3);
        assert!(!calls.is_empty());
        assert_eq!(calls.last(), Some(&(3usize, 3usize)));
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn index_vault_files_stops_when_cancelled() {
        let temp = std::env::temp_dir().join(format!("aiwb-vault-cancel-{}", uuid::Uuid::new_v4()));
        let vault = temp.join("vault");
        std::fs::create_dir_all(&vault).unwrap();
        for name in ["a.md", "b.md", "c.md"] {
            std::fs::write(vault.join(name), format!("# {}\n\n{}", name, name)).unwrap();
        }
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let result =
            index_vault_files_inner(&conn, vault.to_str().unwrap(), &[], 4, None, Some(&|| true));
        let error = match result {
            Ok(_) => panic!("expected cancellation"),
            Err(error) => error,
        };
        assert!(error.contains("cancelled"));
        assert_eq!(db::knowledge_index_status(&conn).unwrap().files, 0);
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn vault_index_cancel_state_marks_and_clears() {
        let state = VaultIndexState::default();
        assert!(state.mark("run-1"));
        assert!(!state.mark("run-1"));
        assert!(state.is_cancelled("run-1"));
        state.clear("run-1");
        assert!(!state.is_cancelled("run-1"));
    }

    #[test]
    fn vault_index_queue_serializes_and_promotes_next() {
        let state = VaultIndexState::default();
        let request = |run_id: &str, path: &str| VaultIndexRequest {
            run_id: run_id.to_string(),
            path: path.to_string(),
            ignore_patterns: Vec::new(),
            concurrency: 4,
            priority: 0,
            attempts: 0,
            last_error: String::new(),
        };
        state.enqueue(request("run-1", "C:/a")).unwrap();
        state.enqueue(request("run-2", "C:/b")).unwrap();
        let first = state.claim_next().unwrap().expect("first run");
        assert_eq!(first.run_id, "run-1");
        assert!(state.claim_next().unwrap().is_none());
        state.finish_active("run-1").unwrap();
        let second = state.claim_next().unwrap().expect("second run");
        assert_eq!(second.run_id, "run-2");
        let snapshot = state.snapshot().unwrap();
        assert_eq!(snapshot.active.unwrap().run_id, "run-2");
        assert!(snapshot.queue.is_empty());
    }

    #[test]
    fn vault_index_cancel_removes_only_queued_run() {
        let state = VaultIndexState::default();
        let request = |run_id: &str, path: &str| VaultIndexRequest {
            run_id: run_id.to_string(),
            path: path.to_string(),
            ignore_patterns: Vec::new(),
            concurrency: 4,
            priority: 0,
            attempts: 0,
            last_error: String::new(),
        };
        state.enqueue(request("run-1", "C:/a")).unwrap();
        state.enqueue(request("run-2", "C:/b")).unwrap();
        state.enqueue(request("run-3", "C:/c")).unwrap();
        let first = state.claim_next().unwrap().expect("first run");
        assert_eq!(first.run_id, "run-1");
        let removed = state.take_queued("run-2").expect("queued run");
        assert_eq!(removed.path, "C:/b");
        let snapshot = state.snapshot().unwrap();
        assert_eq!(snapshot.queue.len(), 1);
        assert_eq!(snapshot.queue[0].run_id, "run-3");
        assert_eq!(snapshot.queue[0].position, 1);
        assert_eq!(snapshot.active.unwrap().run_id, "run-1");
    }

    #[test]
    fn vault_index_queue_restore_enqueues_pending_and_resets_running() {
        let state = VaultIndexState::default();
        let records = vec![
            db::VaultIndexQueueRecord {
                run_id: "run-1".to_string(),
                path: "C:/a".to_string(),
                ignore_patterns: Vec::new(),
                concurrency: 4,
                status: "queued".to_string(),
                priority: 0,
                attempts: 0,
                last_error: String::new(),
            },
            db::VaultIndexQueueRecord {
                run_id: "run-2".to_string(),
                path: "C:/b".to_string(),
                ignore_patterns: vec!["Daily Notes".to_string()],
                concurrency: 2,
                status: "running".to_string(),
                priority: 1,
                attempts: 1,
                last_error: "boom".to_string(),
            },
            db::VaultIndexQueueRecord {
                run_id: "run-3".to_string(),
                path: "C:/c".to_string(),
                ignore_patterns: Vec::new(),
                concurrency: 1,
                status: "done".to_string(),
                priority: 0,
                attempts: 0,
                last_error: String::new(),
            },
        ];
        let restored = enqueue_restored_requests(&state, records);
        assert_eq!(restored, 2);
        let snapshot = state.snapshot().unwrap();
        assert_eq!(snapshot.queue.len(), 2);
        assert_eq!(snapshot.queue[0].run_id, "run-2");
        assert_eq!(snapshot.queue[0].position, 1);
        assert_eq!(snapshot.queue[0].priority, 1);
        assert_eq!(snapshot.queue[0].attempts, 1);
        assert_eq!(snapshot.queue[0].last_error, "boom");
        assert_eq!(snapshot.queue[1].run_id, "run-1");
        assert_eq!(snapshot.queue[1].position, 2);
        assert_eq!(snapshot.queue[1].priority, 0);
    }

    #[test]
    fn vault_index_queue_prioritizes_high_priority() {
        let state = VaultIndexState::default();
        let request = |run_id: &str, path: &str, priority: usize| VaultIndexRequest {
            run_id: run_id.to_string(),
            path: path.to_string(),
            ignore_patterns: Vec::new(),
            concurrency: 4,
            priority,
            attempts: 0,
            last_error: String::new(),
        };
        state.enqueue(request("run-low", "C:/a", 0)).unwrap();
        state.enqueue(request("run-high", "C:/b", 1)).unwrap();
        let snapshot = state.snapshot().unwrap();
        assert_eq!(snapshot.queue[0].run_id, "run-high");
        assert_eq!(snapshot.queue[0].priority, 1);
        assert_eq!(snapshot.queue[0].position, 1);
        assert_eq!(snapshot.queue[1].run_id, "run-low");
        let first = state.claim_next().unwrap().expect("high priority first");
        assert_eq!(first.run_id, "run-high");
        state.finish_active("run-high").unwrap();
        let second = state.claim_next().unwrap().expect("low priority second");
        assert_eq!(second.run_id, "run-low");
    }

    #[test]
    fn vault_index_queue_retries_failed_then_gives_up() {
        let state = VaultIndexState::default();
        state
            .enqueue(VaultIndexRequest {
                run_id: "run-1".to_string(),
                path: "C:/failing".to_string(),
                ignore_patterns: Vec::new(),
                concurrency: 4,
                priority: 1,
                attempts: 0,
                last_error: String::new(),
            })
            .unwrap();
        let first = state.claim_next().unwrap().expect("first attempt");
        assert_eq!(first.attempts, 0);
        let retry_one = state
            .retry_failed("run-1", "boom")
            .unwrap()
            .expect("retry once");
        assert_eq!(retry_one.attempts, 1);
        assert_eq!(retry_one.last_error, "boom");
        assert!(state.snapshot().unwrap().active.is_none());
        assert_eq!(state.snapshot().unwrap().queue.len(), 1);
        assert_eq!(state.snapshot().unwrap().queue[0].retry_delay_ms, 500);

        let second = state.claim_next().unwrap().expect("second attempt");
        assert_eq!(second.attempts, 1);
        let retry_two = state
            .retry_failed("run-1", "boom again")
            .unwrap()
            .expect("retry twice");
        assert_eq!(retry_two.attempts, 2);
        assert_eq!(retry_two.last_error, "boom again");
        assert_eq!(state.snapshot().unwrap().queue[0].retry_delay_ms, 1000);

        let third = state.claim_next().unwrap().expect("third attempt");
        assert_eq!(third.attempts, 2);
        assert!(state.retry_failed("run-1", "boom final").unwrap().is_none());
        assert!(state.snapshot().unwrap().active.is_none());
        assert!(state.snapshot().unwrap().queue.is_empty());
    }

    #[test]
    fn vault_index_retry_delay_grows_exponentially_and_caps() {
        assert_eq!(vault_index_retry_delay_ms(0), 0);
        assert_eq!(vault_index_retry_delay_ms(1), 500);
        assert_eq!(vault_index_retry_delay_ms(2), 1000);
        assert_eq!(vault_index_retry_delay_ms(3), 2000);
        assert_eq!(vault_index_retry_delay_ms(8), 4000);
    }

    #[test]
    fn recommended_index_concurrency_bounds_and_matches_cores() {
        let info = recommend_index_concurrency();
        assert!((1..=16).contains(&info.recommended));
        assert!(info.recommended <= info.cores.max(1));
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
        index_vault_files(&conn.lock().unwrap(), vault.to_str().unwrap(), &[], 4).unwrap();
        let db_for_event = conn.clone();
        let vault_str = vault.to_string_lossy().to_string();
        let on_event = move |event: &Event| {
            for path in &event.paths {
                let _ = sync_vault_path(&db_for_event.lock().unwrap(), path, &vault_str);
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

    #[test]
    fn vault_watch_parallel_tracks_two_vaults() {
        let temp =
            std::env::temp_dir().join(format!("aiwb-vault-parallel-test-{}", uuid::Uuid::new_v4()));
        let vault_a = temp.join("vault-a");
        let vault_b = temp.join("vault-b");
        std::fs::create_dir_all(&vault_a).unwrap();
        std::fs::create_dir_all(&vault_b).unwrap();
        std::fs::write(vault_a.join("a-seed.md"), "# A\n\nseed a").unwrap();
        std::fs::write(vault_b.join("b-seed.md"), "# B\n\nseed b").unwrap();
        let conn = std::sync::Arc::new(std::sync::Mutex::new(
            db::init_connection(&temp.join("workbench.db")).unwrap(),
        ));
        index_vault_files(&conn.lock().unwrap(), vault_a.to_str().unwrap(), &[], 4).unwrap();
        index_vault_files(&conn.lock().unwrap(), vault_b.to_str().unwrap(), &[], 4).unwrap();

        let db_a = conn.clone();
        let vault_a_str = vault_a.to_string_lossy().to_string();
        let handle_a = start_vault_watcher(
            vault_a.to_string_lossy().to_string(),
            move |event: &Event| {
                for path in &event.paths {
                    let _ = sync_vault_path(&db_a.lock().unwrap(), path, &vault_a_str);
                }
            },
        )
        .unwrap();
        let db_b = conn.clone();
        let vault_b_str = vault_b.to_string_lossy().to_string();
        let handle_b = start_vault_watcher(
            vault_b.to_string_lossy().to_string(),
            move |event: &Event| {
                for path in &event.paths {
                    let _ = sync_vault_path(&db_b.lock().unwrap(), path, &vault_b_str);
                }
            },
        )
        .unwrap();

        std::fs::write(vault_a.join("a-new.md"), "# A new\n\nfresh a").unwrap();
        std::fs::write(vault_b.join("b-new.md"), "# B new\n\nfresh b").unwrap();
        let both = wait_until(
            || {
                db::knowledge_index_status(&conn.lock().unwrap())
                    .map(|status| status.files)
                    .unwrap_or(0)
                    == 4
            },
            Duration::from_secs(8),
        );
        assert!(both, "parallel watchers did not index both vaults");

        handle_a.stop();
        handle_b.stop();
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn vault_watch_event_respects_ignore_patterns() {
        let temp = std::env::temp_dir().join(format!(
            "aiwb-vault-watch-ignore-test-{}",
            uuid::Uuid::new_v4()
        ));
        let vault = temp.join("vault");
        std::fs::create_dir_all(vault.join("node_modules")).unwrap();
        std::fs::create_dir_all(vault.join("notes")).unwrap();
        std::fs::write(vault.join("seed.md"), "# Seed\n\ninitial note").unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let patterns = vec!["node_modules".to_string()];
        let result = index_vault_files(&conn, vault.to_str().unwrap(), &patterns, 4).unwrap();
        assert_eq!(result.files, 1);
        assert_eq!(result.ignored, 1);
        let ignored_path = vault.join("node_modules").join("dep.md");
        let indexed_path = vault.join("notes").join("new.md");
        std::fs::write(&ignored_path, "# Dep\n\nignored").unwrap();
        std::fs::write(&indexed_path, "# New\n\nindexed").unwrap();
        let changed_paths = sync_vault_event(
            &conn,
            &[ignored_path.clone(), indexed_path.clone()],
            &vault,
            &patterns,
        );
        assert_eq!(
            changed_paths,
            vec![indexed_path.to_string_lossy().to_string()]
        );
        let status = db::knowledge_index_status(&conn).unwrap();
        assert_eq!(status.files, 2);
        let ignored_search = db::search_thoughts(&conn, "ignored", 5).unwrap();
        assert!(!ignored_search.iter().any(|r| r.content.contains("ignored")));
        let indexed_search = db::search_thoughts(&conn, "indexed", 5).unwrap();
        assert!(indexed_search.iter().any(|r| r.content.contains("indexed")));
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
    fn webhook_signature_matches_hmac_sha256_known_answer() {
        let key = "\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\
                   \u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}\u{b}"
            .to_string();
        let signature = webhook_signature(&key, "Hi There");
        assert_eq!(
            signature,
            "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
        );
    }

    #[test]
    fn webhook_delivery_posts_json_with_auth() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let payload = r#"{"event":"daily.summary","ok":true}"#.to_string();
        let payload_clone = payload.clone();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_http_request_until(&mut stream, "daily.summary");
            let has_post = request.starts_with("POST /hooks/ai-workbench HTTP/1.1");
            let has_json = request
                .to_lowercase()
                .contains("content-type: application/json");
            let has_auth = request
                .to_lowercase()
                .contains("authorization: bearer wh-token-123");
            let has_body = request.contains(&payload_clone);
            let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"received\":true}";
            let _ = stream.write_all(response.as_bytes());
            (request, has_post, has_json, has_auth, has_body)
        });
        let result = deliver_webhook_http(
            &format!("http://{}/hooks/ai-workbench", addr),
            &payload,
            "POST",
            Some("wh-token-123"),
            None,
            0,
        )
        .unwrap();
        let (request, has_post, has_json, has_auth, has_body) = server.join().unwrap();
        assert!(result.ok, "{}", result.message);
        assert_eq!(result.status, 200);
        assert!(result.message.contains("HTTP 200"), "{}", result.message);
        assert!(has_post, "expected POST request line, got:\n{}", request);
        assert!(has_json, "expected JSON content type, got:\n{}", request);
        assert!(has_auth, "expected Authorization header, got:\n{}", request);
        assert!(has_body, "expected JSON body, got:\n{}", request);
    }

    #[test]
    fn webhook_delivery_reports_http_error_status() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let _request = read_http_request_until(&mut stream, "daily.summary");
            let response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 11\r\nConnection: close\r\n\r\nbad request";
            let _ = stream.write_all(response.as_bytes());
        });
        let result = deliver_webhook_http(
            &format!("http://{}", addr),
            r#"{"event":"daily.summary","ok":true}"#,
            "POST",
            None,
            None,
            0,
        )
        .unwrap();
        server.join().unwrap();
        assert!(!result.ok);
        assert_eq!(result.status, 400);
        assert!(result.message.contains("HTTP 400"), "{}", result.message);
        assert!(result.message.contains("bad request"), "{}", result.message);
    }

    #[test]
    fn webhook_delivery_sends_hmac_signature() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let payload = r#"{"event":"signed"}"#;
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_http_request_until(&mut stream, "signed");
            let has_signature = request
                .to_lowercase()
                .contains("x-webhook-signature: sha256=");
            let has_timestamp = request.to_lowercase().contains("x-webhook-timestamp:");
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let _ = stream.write_all(response.as_bytes());
            (request, has_signature, has_timestamp)
        });
        let result = deliver_webhook_http(
            &format!("http://{}", addr),
            payload,
            "POST",
            None,
            Some("test-secret"),
            0,
        )
        .unwrap();
        let (request, has_signature, has_timestamp) = server.join().unwrap();
        assert!(result.ok, "{}", result.message);
        assert!(result.signed);
        assert_eq!(result.attempts, 1);
        assert!(
            has_signature,
            "expected signature header, got:\n{}",
            request
        );
        assert!(
            has_timestamp,
            "expected timestamp header, got:\n{}",
            request
        );
    }

    #[test]
    fn webhook_delivery_retries_on_server_error() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let responses = [
            "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
        ];
        let server = thread::spawn(move || {
            for response in responses {
                let (mut stream, _) = listener.accept().unwrap();
                let _request = read_http_request_until(&mut stream, "retry");
                let _ = stream.write_all(response.as_bytes());
            }
        });
        let result = deliver_webhook_http(
            &format!("http://{}", addr),
            r#"{"event":"retry"}"#,
            "POST",
            None,
            None,
            2,
        )
        .unwrap();
        server.join().unwrap();
        assert!(result.ok, "{}", result.message);
        assert_eq!(result.status, 200);
        assert_eq!(result.attempts, 3);
    }

    #[test]
    fn run_webhook_rule_delivers_and_records_status() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let _request = read_http_request_until(&mut stream, "scheduled");
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let _ = stream.write_all(response.as_bytes());
        });
        let temp =
            std::env::temp_dir().join(format!("aiwb-webhook-rule-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let conn = db::init_connection(&temp.join("workbench.db")).unwrap();
        let rule = db::create_webhook_rule(
            &conn,
            &db::WebhookRuleInput {
                name: "Scheduled",
                url: &format!("http://{}", addr),
                payload: r#"{"event":"scheduled"}"#,
                method: "POST",
                token: "rule-token",
                secret: "rule-secret",
                retries: 2,
                interval_seconds: 60,
                trigger_event: "",
            },
        )
        .unwrap();
        let result = run_webhook_rule_inner(&conn, &rule.id).unwrap();
        server.join().unwrap();
        assert!(result.ok);
        assert_eq!(result.status, 200);
        assert!(result.signed);
        let after = db::get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after.last_status, 200);
        assert_eq!(after.secret, "rule-secret");
        assert_eq!(after.retries, 2);
        assert!(
            after.last_message.contains("HTTP 200"),
            "{}",
            after.last_message
        );
        drop(conn);
        std::fs::remove_dir_all(&temp).unwrap();
    }
}
