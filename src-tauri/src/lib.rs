use keyring::Entry;
use serde_json::Value;
use std::process::Command;
use std::fs;
use std::path::Path;

// ─ helpers ──────────────────────────────────

fn get_api_key(name: &str) -> Result<String, String> {
    let entry = Entry::new("ai-workbench", name).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

/// Ask OpenAI-compatible chat API. Expects key named "OPENAI_API_KEY".
fn chat_openai(messages_json: &str) -> Result<String, String> {
    let api_key = get_api_key("OPENAI_API_KEY")?;
    let body: Value = serde_json::from_str(messages_json).map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": body
        }))
        .send()
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().unwrap_or_default();
        return Err(format!("OpenAI {} : {}", status, err_body));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI returned empty content".into())
}

/// Ask local Ollama. Uses model "qwen2.5:3b" by default.
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
        return Err(format!("Ollama {} : {}", resp.status(), resp.text().unwrap_or_default()));
    }

    let json: Value = resp.json().map_err(|e| e.to_string())?;
    json["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Ollama returned empty content".into())
}

/// Spawn `codex` CLI and capture stdout.
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


// ─ Automation fetch commands ─────────────────

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let resp = client.get(&url).send().map_err(|e| format!("Fetch failed: {}", e))?;
    resp.text().map_err(|e| format!("Read failed: {}", e))
}

#[tauri::command]
fn fetch_rss(url: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let body = client.get(&url).send().map_err(|e| format!("Fetch failed: {}", e))?
        .text().map_err(|e| format!("Read failed: {}", e))?;
    let mut items = Vec::new();
    let mut rest = body.as_str();
    while let Some(start) = rest.find("<item") {
        rest = &rest[start..];
        let Some(end) = rest.find("</item>") else { break };
        let item = &rest[..end + 7];
        let title = extract_tag(item, "title");
        let link = extract_tag(item, "link");
        if !title.is_empty() {
            items.push(format!("- {} | {}", title, link));
        }
        rest = &rest[end + 7..];
    }
    Ok(if items.is_empty() { body.chars().take(500).collect() } else { items.join("\n") })
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

// ─ Knowledge Hub commands ───────────────────

#[tauri::command]
fn write_note(vault_path: String, file_name: String, content: String) -> Result<String, String> {
    // Canonicalize vault path for prefix check
    let vault = Path::new(&vault_path);
    let vault_canon = fs::canonicalize(vault)
        .map_err(|e| format!("Vault path not accessible: {}", e))?;

    // Reject file names that try to escape the vault directory
    let name = Path::new(&file_name);
    if name.components().any(|c| c == std::path::Component::ParentDir || c == std::path::Component::RootDir) {
        return Err("Invalid file name: path traversal not allowed".into());
    }

    // Construct and canonicalize the output path, verify it stays inside vault
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
    let mut notes: Vec<serde_json::Value> = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Read dir failed: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let p = entry.path();
        if p.extension().map_or(false, |e| e == "md") {
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
    serde_json::to_string(&notes).map_err(|e| format!("Serialize error: {}", e))
}

fn parse_frontmatter(content: &str) -> (serde_json::Map<String, serde_json::Value>, String) {
    let mut map = serde_json::Map::new();
    if !content.starts_with("---") {
        return (map, content.to_string());
    }
    if let Some(rest) = content.strip_prefix("---") {
        if let Some(end) = rest.find("---") {
            let fm = &rest[..end];
            for line in fm.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    map.insert(k.trim().to_string(), serde_json::Value::String(v.trim().to_string()));
                }
            }
            let body = rest[end + 3..].trim_start().to_string();
            return (map, body);
        }
    }
    (map, content.to_string())
}

// - Tauri commands ─────────────────────────────

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

/// Unified chat endpoint — model routes to the right backend.
#[tauri::command]
fn send_chat_message(model: String, messages_json: String, ollama_model: String) -> Result<String, String> {
    let model = model.to_lowercase();

    match model.as_str() {
        "cloud" => chat_openai(&messages_json),
        "ollama" => chat_ollama(&messages_json, &ollama_model),
        "codex" => {
            let msgs: Value = serde_json::from_str(&messages_json).map_err(|e| e.to_string())?;
            let last = msgs.as_array()
                .and_then(|a| a.last())
                .and_then(|m| m["content"].as_str())
                .unwrap_or("");
            chat_codex(last)
        }
        "auto" => {
            chat_openai(&messages_json)
                .or_else(|_| chat_ollama(&messages_json, &ollama_model))
        }
        _ => Err(format!("Unknown model: {}", model)),
    }
}

/// Spawn codex CLI for vibe-coding pipeline.
#[tauri::command]
fn run_codex(idea: String, clarifications_json: String) -> Result<String, String> {
    let clarifications: Value = serde_json::from_str(&clarifications_json)
        .map_err(|e| e.to_string())?;

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

// ─ Entry point ───────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            read_vault_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
