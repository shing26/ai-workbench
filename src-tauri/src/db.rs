use pinyin::ToPinyin;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT,
    revenue REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS project_revenue_history (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    revenue REAL NOT NULL,
    recorded_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    is_today INTEGER DEFAULT 0,
    due_date TEXT,
    created_at INTEGER,
    completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS thoughts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    tags TEXT,
    type TEXT DEFAULT 'inbox',
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    model TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    model TEXT DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'emerald',
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    model TEXT DEFAULT 'openai',
    provider_id TEXT,
    system_prompt TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agents_department ON agents(department_id, is_active);
CREATE TABLE IF NOT EXISTS agent_prompt_versions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    content TEXT,
    created_at INTEGER,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_agent ON agent_prompt_versions(agent_id, created_at);
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    week_goal INTEGER DEFAULT 5,
    current_streak INTEGER DEFAULT 0,
    color TEXT DEFAULT 'emerald',
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    date TEXT NOT NULL,
    checked_at INTEGER,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS schedule_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    done INTEGER DEFAULT 0,
    tag TEXT DEFAULT 'general',
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS clipboard_history (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT DEFAULT 'system',
    timestamp INTEGER,
    updated_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    severity TEXT DEFAULT 'error',
    timestamp INTEGER,
    updated_at INTEGER DEFAULT 0,
    device_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tasks_today ON tasks(is_today, status);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_events_time ON schedule_events(start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_events_date_time ON schedule_events(date, start_time);
CREATE INDEX IF NOT EXISTS idx_clipboard_timestamp ON clipboard_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE TABLE IF NOT EXISTS knowledge_files (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT,
    tags TEXT,
    content TEXT NOT NULL,
    vault_path TEXT NOT NULL DEFAULT '',
    indexed_at INTEGER,
    embedding TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_path ON knowledge_files(path);
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE TABLE IF NOT EXISTS message_versions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER,
    parent_version_id TEXT,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_versions_message ON message_versions(message_id, created_at);
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    local_content TEXT NOT NULL,
    remote_content TEXT NOT NULL,
    local_updated_at INTEGER NOT NULL,
    remote_updated_at INTEGER NOT NULL,
    resolved_to TEXT NOT NULL,
    preview TEXT NOT NULL,
    resolved_choice TEXT,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (id, kind, created_at)
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved_at, created_at);
CREATE TABLE IF NOT EXISTS vault_watch_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    path TEXT NOT NULL DEFAULT '',
    ignore_patterns TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vault_watch_targets (
    path TEXT PRIMARY KEY,
    ignore_patterns TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    last_event_at INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    created_events INTEGER NOT NULL DEFAULT 0,
    modified_events INTEGER NOT NULL DEFAULT 0,
    removed_events INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vault_watch_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vault_watch_events_vault_created
    ON vault_watch_events(vault_path, created_at DESC);
CREATE TABLE IF NOT EXISTS vault_index_queue (
    run_id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    ignore_patterns TEXT NOT NULL DEFAULT '[]',
    concurrency INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'queued',
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    device_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit_log(created_at DESC);
CREATE TABLE IF NOT EXISTS webhook_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    method TEXT NOT NULL DEFAULT 'POST',
    token TEXT NOT NULL DEFAULT '',
    secret TEXT NOT NULL DEFAULT '',
    retries INTEGER NOT NULL DEFAULT 1,
    cooldown_seconds INTEGER NOT NULL DEFAULT 0,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    trigger_event TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run_at INTEGER NOT NULL DEFAULT 0,
    last_status INTEGER NOT NULL DEFAULT 0,
    last_message TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    auto_disable_after INTEGER NOT NULL DEFAULT 3
);
CREATE INDEX IF NOT EXISTS idx_webhook_rules_enabled ON webhook_rules(enabled, interval_seconds);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL DEFAULT '',
    event TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL DEFAULT '{}',
    method TEXT NOT NULL DEFAULT 'POST',
    url TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL DEFAULT '',
    secret TEXT NOT NULL DEFAULT '',
    retries INTEGER NOT NULL DEFAULT 1,
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued',
    last_status INTEGER NOT NULL DEFAULT 0,
    last_message TEXT NOT NULL DEFAULT '',
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_rule ON webhook_deliveries(rule_id);
CREATE TABLE IF NOT EXISTS webhook_rule_runs (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'success',
    http_status INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 1,
    message TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_rule_runs_rule_created
    ON webhook_rule_runs(rule_id, created_at DESC);
CREATE TABLE IF NOT EXISTS webhook_retention_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    retention_days INTEGER NOT NULL DEFAULT 30,
    max_records INTEGER NOT NULL DEFAULT 200,
    auto_cleanup INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quick_prompts (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    text TEXT NOT NULL,
    custom INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quick_prompt_usage (
    id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
"#;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub is_today: bool,
    pub due_date: Option<String>,
    pub completed_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub revenue: f64,
    pub status: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRevenuePoint {
    pub id: String,
    pub project_id: String,
    pub revenue: f64,
    pub recorded_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Thought {
    pub id: String,
    pub content: String,
    pub tags: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickPrompt {
    pub id: String,
    pub label: String,
    pub category: String,
    pub text: String,
    #[serde(default)]
    pub custom: bool,
    #[serde(rename = "order", default)]
    pub sort_order: i64,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default)]
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickPromptUsageEntry {
    pub id: String,
    pub count: i64,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub model: String,
    pub pinned: bool,
    pub archived: bool,
    pub message_count: i64,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSearchHit {
    pub session: Session,
    pub match_type: String,
    pub snippet: String,
    pub score: i64,
    pub message_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageVersion {
    pub id: String,
    pub message_id: String,
    pub content: String,
    pub created_at: i64,
    pub parent_version_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDiff {
    pub added: Vec<String>,
    pub removed: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub priority: i64,
    pub is_active: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Department {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub agent_count: i64,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub department_id: String,
    pub department_name: String,
    pub name: String,
    pub role: String,
    pub model: String,
    pub provider_id: Option<String>,
    pub system_prompt: String,
    pub is_active: bool,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPromptVersion {
    pub id: String,
    pub agent_id: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub week_goal: i64,
    pub current_streak: i64,
    pub color: String,
    pub done_today: bool,
    pub created_at: i64,
    pub recent_logs: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleEvent {
    pub id: String,
    pub title: String,
    pub start_time: String,
    pub date: String,
    pub done: bool,
    pub tag: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: String,
    pub content: String,
    pub source: String,
    pub timestamp: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLog {
    pub id: String,
    pub source: String,
    pub message: String,
    pub stack: Option<String>,
    pub severity: String,
    pub timestamp: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub device_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshot {
    pub device_id: String,
    pub exported_at: i64,
    #[serde(default)]
    pub clipboard: Vec<ClipboardItem>,
    #[serde(default)]
    pub logs: Vec<ErrorLog>,
    #[serde(default)]
    pub quick_prompts: Vec<QuickPrompt>,
    #[serde(default)]
    pub quick_prompt_usage: Vec<QuickPromptUsageEntry>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub device_id: String,
    pub synced_at: i64,
    pub clipboard_added: usize,
    pub clipboard_updated: usize,
    pub logs_added: usize,
    pub logs_updated: usize,
    pub quick_prompts_added: usize,
    pub quick_prompts_updated: usize,
    pub quick_prompt_usage_updated: usize,
    pub conflicts: Vec<SyncConflictItem>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflictItem {
    pub id: String,
    pub kind: String,
    pub local_updated_at: i64,
    pub remote_updated_at: i64,
    pub resolved_to: String,
    pub preview: String,
    pub local_content: String,
    pub remote_content: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflictRecord {
    pub id: String,
    pub kind: String,
    pub local_updated_at: i64,
    pub remote_updated_at: i64,
    pub resolved_to: String,
    pub preview: String,
    pub local_content: String,
    pub remote_content: String,
    pub resolved_choice: Option<String>,
    pub resolved_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchConfig {
    pub path: String,
    pub ignore_patterns: Vec<String>,
    pub enabled: bool,
    pub updated_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchTarget {
    pub path: String,
    pub ignore_patterns: Vec<String>,
    pub enabled: bool,
    pub updated_at: i64,
    pub last_event_at: i64,
    pub event_count: i64,
    pub created_events: i64,
    pub modified_events: i64,
    pub removed_events: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchEvent {
    pub id: i64,
    pub vault_path: String,
    pub file_path: String,
    pub event_kind: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAuditEntry {
    pub id: i64,
    pub event: String,
    pub detail: String,
    pub device_id: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAuditBucket {
    pub bucket: String,
    pub start_at: i64,
    pub count: i64,
    pub merge: i64,
    pub resolve: i64,
    pub other: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAuditSummary {
    pub granularity: String,
    pub total: i64,
    pub buckets: Vec<SyncAuditBucket>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLogBucket {
    pub bucket: String,
    pub start_at: i64,
    pub count: i64,
    pub error: i64,
    pub warning: i64,
    pub info: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLogSummary {
    pub granularity: String,
    pub total: i64,
    pub buckets: Vec<ErrorLogBucket>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagSearchResult {
    pub id: String,
    pub content: String,
    pub tags: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub score: f64,
    pub vector_score: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagIndexStatus {
    pub documents: i64,
    pub indexed: bool,
    pub last_indexed_at: i64,
    pub vector_indexed: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeIndexStatus {
    pub files: i64,
    pub indexed_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexResult {
    pub files: i64,
    pub ignored: i64,
    pub concurrency_used: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultTargetStats {
    pub path: String,
    pub files: i64,
    pub last_indexed_at: i64,
    pub last_event_at: i64,
    pub event_count: i64,
    pub created_events: i64,
    pub modified_events: i64,
    pub removed_events: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeFileRecord {
    pub id: String,
    pub path: String,
    pub title: String,
    pub tags: String,
    pub vault_path: String,
    pub indexed_at: i64,
    pub exists: bool,
    pub stale: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeCleanupResult {
    pub removed: i64,
    pub reindexed: i64,
    pub failed: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultIndexQueueRecord {
    pub run_id: String,
    pub path: String,
    pub ignore_patterns: Vec<String>,
    pub concurrency: usize,
    pub status: String,
    pub priority: usize,
    pub attempts: usize,
    pub last_error: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRule {
    pub id: String,
    pub name: String,
    pub url: String,
    pub payload: String,
    pub method: String,
    pub token: String,
    pub secret: String,
    pub retries: i64,
    pub cooldown_seconds: i64,
    pub interval_seconds: i64,
    pub trigger_event: String,
    pub enabled: bool,
    pub last_run_at: i64,
    pub last_status: i64,
    pub last_message: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub consecutive_failures: i64,
    pub auto_disable_after: i64,
}

pub struct WebhookRuleInput<'a> {
    pub name: &'a str,
    pub url: &'a str,
    pub payload: &'a str,
    pub method: &'a str,
    pub token: &'a str,
    pub secret: &'a str,
    pub retries: i64,
    pub cooldown_seconds: i64,
    pub interval_seconds: i64,
    pub trigger_event: &'a str,
    pub auto_disable_after: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRuleRun {
    pub id: String,
    pub rule_id: String,
    pub kind: String,
    pub status: String,
    pub http_status: i64,
    pub attempts: i64,
    pub message: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookDelivery {
    pub id: String,
    pub rule_id: String,
    pub event: String,
    pub payload: String,
    pub method: String,
    pub url: String,
    pub token: String,
    pub secret: String,
    pub retries: i64,
    pub attempts: i64,
    pub status: String,
    pub last_status: i64,
    pub last_message: String,
    pub next_attempt_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRetentionConfig {
    pub retention_days: i64,
    pub max_records: i64,
    pub auto_cleanup: bool,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookPruneResult {
    pub removed_by_age: i64,
    pub removed_by_count: i64,
    pub total_removed: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookDeliveryStats {
    pub total: i64,
    pub queued: i64,
    pub delivering: i64,
    pub success: i64,
    pub dead: i64,
    pub failed: i64,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn today_local() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn date_key_to_days(key: &str) -> Option<i64> {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i64 = parts[0].parse().ok()?;
    let month: i64 = parts[1].parse().ok()?;
    let day: i64 = parts[2].parse().ok()?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

fn compute_habit_streak(log_dates: &[String], today: &str) -> i64 {
    let Some(today_days) = date_key_to_days(today) else {
        return 0;
    };
    let mut checked: std::collections::HashSet<i64> = std::collections::HashSet::new();
    for date in log_dates {
        if let Some(days) = date_key_to_days(date) {
            checked.insert(days);
        }
    }
    let mut cursor = if checked.contains(&today_days) {
        today_days
    } else {
        today_days - 1
    };
    let mut streak = 0;
    while checked.contains(&cursor) {
        streak += 1;
        cursor -= 1;
    }
    streak
}

fn recent_habit_logs(log_dates: &[String], today: &str, window: i64) -> Vec<String> {
    let Some(today_days) = date_key_to_days(today) else {
        return Vec::new();
    };
    let min = today_days - window + 1;
    let mut dates: Vec<String> = log_dates
        .iter()
        .filter_map(|date| {
            let days = date_key_to_days(date)?;
            if days >= min {
                Some(date.clone())
            } else {
                None
            }
        })
        .collect();
    dates.sort();
    dates.dedup();
    dates
}

fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

const WEBHOOK_RULE_COLUMNS: &str =
    "id, name, url, payload, method, token, secret, retries, cooldown_seconds, interval_seconds, enabled, \
     last_run_at, last_status, last_message, created_at, updated_at, trigger_event, \
     consecutive_failures, auto_disable_after";

fn map_webhook_rule(row: &rusqlite::Row<'_>) -> rusqlite::Result<WebhookRule> {
    Ok(WebhookRule {
        id: row.get(0)?,
        name: row.get(1)?,
        url: row.get(2)?,
        payload: row.get(3)?,
        method: row.get(4)?,
        token: row.get(5)?,
        secret: row.get(6)?,
        retries: row.get(7)?,
        cooldown_seconds: row.get(8)?,
        interval_seconds: row.get(9)?,
        enabled: row.get::<_, i64>(10)? != 0,
        last_run_at: row.get(11)?,
        last_status: row.get(12)?,
        last_message: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        trigger_event: row.get(16)?,
        consecutive_failures: row.get(17)?,
        auto_disable_after: row.get(18)?,
    })
}

pub fn get_webhook_rule(conn: &Connection, id: &str) -> Result<Option<WebhookRule>> {
    conn.query_row(
        &format!(
            "SELECT {} FROM webhook_rules WHERE id = ?1",
            WEBHOOK_RULE_COLUMNS
        ),
        params![id],
        map_webhook_rule,
    )
    .optional()
}

pub fn list_webhook_rules(conn: &Connection) -> Result<Vec<WebhookRule>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM webhook_rules ORDER BY created_at ASC",
        WEBHOOK_RULE_COLUMNS
    ))?;
    let rows = stmt.query_map([], map_webhook_rule)?;
    rows.collect()
}

pub fn create_webhook_rule(conn: &Connection, input: &WebhookRuleInput<'_>) -> Result<WebhookRule> {
    let now = now_millis();
    let id = uid();
    let method = if input.method.trim().is_empty() {
        "POST".to_string()
    } else {
        input.method.trim().to_uppercase()
    };
    let payload = if input.payload.trim().is_empty() {
        "{}".to_string()
    } else {
        input.payload.trim().to_string()
    };
    let interval = input.interval_seconds.max(5);
    let cooldown = input.cooldown_seconds.max(0);
    conn.execute(
        "INSERT INTO webhook_rules (id, name, url, payload, method, token, secret, retries, cooldown_seconds, interval_seconds, trigger_event, enabled, last_run_at, last_status, last_message, created_at, updated_at, consecutive_failures, auto_disable_after)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, 0, 0, '', ?12, ?12, 0, ?13)",
        params![
            id,
            input.name,
            input.url,
            payload,
            method,
            input.token,
            input.secret,
            input.retries,
            cooldown,
            interval,
            input.trigger_event,
            now,
            input.auto_disable_after.max(0),
        ],
    )?;
    get_webhook_rule(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn set_webhook_rule_enabled(conn: &Connection, id: &str, enabled: bool) -> Result<WebhookRule> {
    let updated = conn.execute(
        "UPDATE webhook_rules
         SET enabled = ?1,
             consecutive_failures = CASE WHEN ?1 = 1 THEN 0 ELSE consecutive_failures END,
             updated_at = ?2
         WHERE id = ?3",
        params![enabled as i64, now_millis(), id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    get_webhook_rule(conn, id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_webhook_rule(conn: &Connection, id: &str) -> Result<()> {
    let _ = conn.execute(
        "DELETE FROM webhook_deliveries WHERE rule_id = ?1",
        params![id],
    )?;
    let removed = conn.execute("DELETE FROM webhook_rules WHERE id = ?1", params![id])?;
    if removed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn list_due_webhook_rules(conn: &Connection, now_ms: i64) -> Result<Vec<WebhookRule>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM webhook_rules
         WHERE enabled = 1 AND trigger_event = ''
           AND (last_run_at = 0 OR ?1 - last_run_at >= interval_seconds * 1000)
         ORDER BY last_run_at ASC",
        WEBHOOK_RULE_COLUMNS
    ))?;
    let rows = stmt.query_map(params![now_ms], map_webhook_rule)?;
    rows.collect()
}

pub fn list_event_webhook_rules(
    conn: &Connection,
    event: &str,
    now_ms: i64,
) -> Result<Vec<WebhookRule>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM webhook_rules
         WHERE enabled = 1 AND trigger_event = ?1
           AND (last_run_at = 0 OR ?2 - last_run_at >= cooldown_seconds * 1000)
         ORDER BY created_at ASC",
        WEBHOOK_RULE_COLUMNS
    ))?;
    let rows = stmt.query_map(params![event, now_ms], map_webhook_rule)?;
    rows.collect()
}

pub fn mark_webhook_rule_run(
    conn: &Connection,
    id: &str,
    status: i64,
    message: &str,
) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "UPDATE webhook_rules SET last_run_at = ?1, last_status = ?2, last_message = ?3, updated_at = ?1 WHERE id = ?4",
        params![now, status, message, id],
    )?;
    Ok(())
}

pub fn record_webhook_rule_outcome(
    conn: &Connection,
    id: &str,
    status: i64,
    message: &str,
) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "UPDATE webhook_rules
         SET last_run_at = ?1,
             last_status = ?2,
             consecutive_failures = CASE
                 WHEN ?2 >= 200 AND ?2 < 300 THEN 0
                 ELSE consecutive_failures + 1
             END,
             last_message = CASE
                 WHEN ?2 >= 200 AND ?2 < 300 THEN ?3
                 WHEN auto_disable_after > 0 AND consecutive_failures + 1 >= auto_disable_after
                     THEN 'Auto-disabled after ' || (consecutive_failures + 1) || ' consecutive failures'
                 ELSE ?3
             END,
             enabled = CASE
                 WHEN auto_disable_after > 0 AND consecutive_failures + 1 >= auto_disable_after THEN 0
                 ELSE enabled
             END,
             updated_at = ?1
         WHERE id = ?4",
        params![now, status, message, id],
    )?;
    Ok(())
}

const WEBHOOK_RULE_RUN_COLUMNS: &str =
    "id, rule_id, kind, status, http_status, attempts, message, created_at";

fn map_webhook_rule_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<WebhookRuleRun> {
    Ok(WebhookRuleRun {
        id: row.get(0)?,
        rule_id: row.get(1)?,
        kind: row.get(2)?,
        status: row.get(3)?,
        http_status: row.get(4)?,
        attempts: row.get(5)?,
        message: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub fn get_webhook_rule_run(conn: &Connection, id: &str) -> Result<Option<WebhookRuleRun>> {
    conn.query_row(
        &format!(
            "SELECT {} FROM webhook_rule_runs WHERE id = ?1",
            WEBHOOK_RULE_RUN_COLUMNS
        ),
        params![id],
        map_webhook_rule_run,
    )
    .optional()
}

pub fn record_webhook_rule_run(
    conn: &Connection,
    rule_id: &str,
    kind: &str,
    status: &str,
    http_status: i64,
    attempts: i64,
    message: &str,
) -> Result<WebhookRuleRun> {
    let now = now_millis();
    let id = uid();
    conn.execute(
        "INSERT INTO webhook_rule_runs (id, rule_id, kind, status, http_status, attempts, message, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            rule_id,
            kind,
            status,
            http_status,
            attempts.max(1),
            message,
            now,
        ],
    )?;
    conn.execute(
        "DELETE FROM webhook_rule_runs
         WHERE rule_id = ?1 AND id NOT IN (
             SELECT id FROM webhook_rule_runs
             WHERE rule_id = ?1
             ORDER BY created_at DESC, rowid DESC
             LIMIT 50
         )",
        params![rule_id],
    )?;
    get_webhook_rule_run(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_webhook_rule_runs(
    conn: &Connection,
    rule_id: Option<&str>,
    limit: i64,
) -> Result<Vec<WebhookRuleRun>> {
    let limit = limit.clamp(1, 200);
    let rule_id = rule_id.filter(|id| !id.trim().is_empty());
    let mut stmt = if rule_id.is_some() {
        conn.prepare(&format!(
            "SELECT {} FROM webhook_rule_runs
             WHERE rule_id = ?1
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?2",
            WEBHOOK_RULE_RUN_COLUMNS
        ))?
    } else {
        conn.prepare(&format!(
            "SELECT {} FROM webhook_rule_runs
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?1",
            WEBHOOK_RULE_RUN_COLUMNS
        ))?
    };
    let rows = if let Some(rule_id) = rule_id {
        stmt.query_map(params![rule_id, limit], map_webhook_rule_run)?
    } else {
        stmt.query_map(params![limit], map_webhook_rule_run)?
    };
    rows.collect()
}

const WEBHOOK_DELIVERY_COLUMNS: &str =
    "id, rule_id, event, payload, method, url, token, secret, retries, attempts, status, \
     last_status, last_message, next_attempt_at, created_at, updated_at";

fn map_webhook_delivery(row: &rusqlite::Row<'_>) -> rusqlite::Result<WebhookDelivery> {
    Ok(WebhookDelivery {
        id: row.get(0)?,
        rule_id: row.get(1)?,
        event: row.get(2)?,
        payload: row.get(3)?,
        method: row.get(4)?,
        url: row.get(5)?,
        token: row.get(6)?,
        secret: row.get(7)?,
        retries: row.get(8)?,
        attempts: row.get(9)?,
        status: row.get(10)?,
        last_status: row.get(11)?,
        last_message: row.get(12)?,
        next_attempt_at: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

pub fn get_webhook_delivery(conn: &Connection, id: &str) -> Result<Option<WebhookDelivery>> {
    conn.query_row(
        &format!(
            "SELECT {} FROM webhook_deliveries WHERE id = ?1",
            WEBHOOK_DELIVERY_COLUMNS
        ),
        params![id],
        map_webhook_delivery,
    )
    .optional()
}

pub fn enqueue_webhook_delivery(
    conn: &Connection,
    rule: &WebhookRule,
    event: &str,
    payload: &str,
) -> Result<WebhookDelivery> {
    let now = now_millis();
    let id = uid();
    conn.execute(
        "INSERT INTO webhook_deliveries (id, rule_id, event, payload, method, url, token, secret, retries, attempts, status, last_status, last_message, next_attempt_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 'queued', 0, '', ?10, ?10, ?10)",
        params![
            id, rule.id, event, payload, rule.method, rule.url, rule.token, rule.secret,
            rule.retries.max(0), now,
        ],
    )?;
    get_webhook_delivery(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_webhook_deliveries(
    conn: &Connection,
    limit: i64,
    status_filter: &str,
) -> Result<Vec<WebhookDelivery>> {
    let mut stmt = if status_filter.trim().is_empty() {
        conn.prepare(&format!(
            "SELECT {} FROM webhook_deliveries ORDER BY created_at DESC LIMIT ?1",
            WEBHOOK_DELIVERY_COLUMNS
        ))?
    } else {
        conn.prepare(&format!(
            "SELECT {} FROM webhook_deliveries WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2",
            WEBHOOK_DELIVERY_COLUMNS
        ))?
    };
    let rows = if status_filter.trim().is_empty() {
        stmt.query_map(params![limit], map_webhook_delivery)?
    } else {
        stmt.query_map(params![status_filter, limit], map_webhook_delivery)?
    };
    rows.collect()
}

pub fn claim_due_webhook_deliveries(
    conn: &Connection,
    now_ms: i64,
    limit: i64,
) -> Result<Vec<WebhookDelivery>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM webhook_deliveries
         WHERE status = 'queued' AND next_attempt_at <= ?1
         ORDER BY next_attempt_at ASC, created_at ASC
         LIMIT ?2",
        WEBHOOK_DELIVERY_COLUMNS
    ))?;
    let rows = stmt.query_map(params![now_ms, limit], map_webhook_delivery)?;
    let ids: Vec<String> = rows.filter_map(Result::ok).map(|d| d.id).collect();
    for id in &ids {
        conn.execute(
            "UPDATE webhook_deliveries SET status = 'delivering', updated_at = ?1 WHERE id = ?2",
            params![now_millis(), id],
        )?;
    }
    Ok(ids
        .into_iter()
        .filter_map(|id| get_webhook_delivery(conn, &id).ok().flatten())
        .collect::<Vec<_>>())
}

pub fn complete_webhook_delivery(
    conn: &Connection,
    id: &str,
    status: &str,
    last_status: i64,
    message: &str,
    attempts: i64,
    next_attempt_at: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE webhook_deliveries
         SET attempts = ?1, status = ?2, last_status = ?3, last_message = ?4,
             next_attempt_at = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            attempts,
            status,
            last_status,
            message,
            next_attempt_at,
            now_millis(),
            id
        ],
    )?;
    Ok(())
}

pub fn retry_webhook_delivery(conn: &Connection, id: &str) -> Result<WebhookDelivery> {
    let updated = conn.execute(
        "UPDATE webhook_deliveries
         SET attempts = 0, status = 'queued', last_message = '', next_attempt_at = ?1, updated_at = ?1
         WHERE id = ?2",
        params![now_millis(), id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    get_webhook_delivery(conn, id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_webhook_delivery(conn: &Connection, id: &str) -> Result<()> {
    let removed = conn.execute("DELETE FROM webhook_deliveries WHERE id = ?1", params![id])?;
    if removed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn clear_webhook_deliveries(conn: &Connection, status_filter: &str) -> Result<i64> {
    let removed = if status_filter.trim().is_empty() {
        conn.execute("DELETE FROM webhook_deliveries", [])?
    } else {
        conn.execute(
            "DELETE FROM webhook_deliveries WHERE status = ?1",
            params![status_filter],
        )?
    };
    Ok(removed as i64)
}

pub fn get_webhook_retention_config(conn: &Connection) -> Result<WebhookRetentionConfig> {
    let row = conn.query_row(
        "SELECT retention_days, max_records, auto_cleanup, updated_at
         FROM webhook_retention_config WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        },
    );
    match row {
        Ok((retention_days, max_records, auto_cleanup, updated_at)) => Ok(WebhookRetentionConfig {
            retention_days,
            max_records,
            auto_cleanup: auto_cleanup != 0,
            updated_at,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(WebhookRetentionConfig {
            retention_days: 30,
            max_records: 200,
            auto_cleanup: true,
            updated_at: 0,
        }),
        Err(e) => Err(e),
    }
}

pub fn set_webhook_retention_config(
    conn: &Connection,
    retention_days: i64,
    max_records: i64,
    auto_cleanup: bool,
) -> Result<WebhookRetentionConfig> {
    let days = retention_days.clamp(1, 3650);
    let max_records = max_records.clamp(1, 100_000);
    conn.execute(
        "INSERT INTO webhook_retention_config
           (id, retention_days, max_records, auto_cleanup, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           retention_days = excluded.retention_days,
           max_records = excluded.max_records,
           auto_cleanup = excluded.auto_cleanup,
           updated_at = excluded.updated_at",
        params![days, max_records, auto_cleanup as i64, now_millis()],
    )?;
    get_webhook_retention_config(conn)
}

pub fn get_webhook_delivery_stats(conn: &Connection) -> Result<WebhookDeliveryStats> {
    let mut stmt =
        conn.prepare("SELECT status, COUNT(*) FROM webhook_deliveries GROUP BY status")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    let mut stats = WebhookDeliveryStats {
        total: 0,
        queued: 0,
        delivering: 0,
        success: 0,
        dead: 0,
        failed: 0,
    };
    for row in rows {
        let (status, count) = row?;
        stats.total += count;
        match status.as_str() {
            "queued" => stats.queued = count,
            "delivering" => stats.delivering = count,
            "success" => stats.success = count,
            "dead" => stats.dead = count,
            _ => stats.failed += count,
        }
    }
    Ok(stats)
}

pub fn prune_webhook_deliveries(
    conn: &Connection,
    retention_days: i64,
    max_records: i64,
) -> Result<WebhookPruneResult> {
    let now = now_millis();
    let mut removed_by_age = 0_i64;
    if retention_days > 0 {
        let cutoff = now.saturating_sub(retention_days.saturating_mul(86_400_000));
        removed_by_age = conn.execute(
            "DELETE FROM webhook_deliveries
             WHERE status IN ('success', 'dead') AND created_at < ?1",
            params![cutoff],
        )? as i64;
    }

    let terminal: i64 = conn.query_row(
        "SELECT COUNT(*) FROM webhook_deliveries WHERE status IN ('success', 'dead')",
        [],
        |row| row.get(0),
    )?;
    let excess = terminal.saturating_sub(max_records.max(0));
    let mut removed_by_count = 0_i64;
    if excess > 0 {
        let mut stmt = conn.prepare(
            "SELECT id FROM webhook_deliveries
             WHERE status IN ('success', 'dead')
             ORDER BY created_at ASC, rowid ASC
             LIMIT ?1",
        )?;
        let ids: Vec<String> = stmt
            .query_map(params![excess], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for id in ids {
            removed_by_count +=
                conn.execute("DELETE FROM webhook_deliveries WHERE id = ?1", params![id])? as i64;
        }
    }

    Ok(WebhookPruneResult {
        removed_by_age,
        removed_by_count,
        total_removed: removed_by_age + removed_by_count,
    })
}

pub fn init_connection(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    migrate_updated_at(&conn)?;
    migrate_error_log_device(&conn)?;
    migrate_version_parent(&conn)?;
    migrate_vault_watch_targets(&conn)?;
    migrate_vault_watch_event_stats(&conn)?;
    migrate_knowledge_vault_path(&conn)?;
    migrate_knowledge_embedding(&conn)?;
    migrate_provider_model(&conn)?;
    migrate_provider_priority(&conn)?;
    migrate_vault_index_queue_priority(&conn)?;
    migrate_quick_prompt_order(&conn)?;
    migrate_webhook_secret_retries(&conn)?;
    migrate_webhook_trigger_event(&conn)?;
    migrate_webhook_cooldown(&conn)?;
    migrate_webhook_circuit_breaker(&conn)?;
    migrate_session_pinned(&conn)?;
    migrate_session_archived(&conn)?;
    migrate_task_completed_at(&conn)?;
    migrate_schedule_event_date(&conn)?;
    seed_if_empty(&conn)?;
    Ok(conn)
}

fn migrate_vault_watch_targets(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "INSERT OR IGNORE INTO vault_watch_targets (path, ignore_patterns, enabled, updated_at)
         SELECT path, ignore_patterns, enabled, updated_at
         FROM vault_watch_config
         WHERE id = 1 AND path <> '';",
    )?;
    Ok(())
}

fn migrate_vault_watch_event_stats(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "vault_watch_targets", "last_event_at")? {
        conn.execute_batch(
            "ALTER TABLE vault_watch_targets ADD COLUMN last_event_at INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_watch_targets", "event_count")? {
        conn.execute_batch(
            "ALTER TABLE vault_watch_targets ADD COLUMN event_count INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_watch_targets", "created_events")? {
        conn.execute_batch(
            "ALTER TABLE vault_watch_targets ADD COLUMN created_events INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_watch_targets", "modified_events")? {
        conn.execute_batch(
            "ALTER TABLE vault_watch_targets ADD COLUMN modified_events INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_watch_targets", "removed_events")? {
        conn.execute_batch(
            "ALTER TABLE vault_watch_targets ADD COLUMN removed_events INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    Ok(())
}

fn migrate_knowledge_vault_path(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "knowledge_files", "vault_path")? {
        conn.execute_batch(
            "ALTER TABLE knowledge_files ADD COLUMN vault_path TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn migrate_knowledge_embedding(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "knowledge_files", "embedding")? {
        conn.execute_batch("ALTER TABLE knowledge_files ADD COLUMN embedding TEXT DEFAULT '';")?;
    }
    conn.execute(
        "UPDATE knowledge_files SET embedding = '' WHERE embedding IS NULL",
        [],
    )?;
    Ok(())
}

fn migrate_provider_model(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "providers", "model")? {
        conn.execute_batch("ALTER TABLE providers ADD COLUMN model TEXT DEFAULT '';")?;
    }
    conn.execute("UPDATE providers SET model = '' WHERE model IS NULL", [])?;
    Ok(())
}

fn migrate_provider_priority(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "providers", "priority")? {
        conn.execute_batch(
            "ALTER TABLE providers ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    conn.execute(
        "UPDATE providers SET priority = 0 WHERE priority IS NULL",
        [],
    )?;
    Ok(())
}

fn migrate_vault_index_queue_priority(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "vault_index_queue", "priority")? {
        conn.execute_batch(
            "ALTER TABLE vault_index_queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_index_queue", "attempts")? {
        conn.execute_batch(
            "ALTER TABLE vault_index_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "vault_index_queue", "last_error")? {
        conn.execute_batch(
            "ALTER TABLE vault_index_queue ADD COLUMN last_error TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn migrate_quick_prompt_order(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "quick_prompts", "sort_order")? {
        conn.execute_batch(
            "ALTER TABLE quick_prompts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;",
        )?;
        conn.execute_batch("UPDATE quick_prompts SET sort_order = rowid WHERE sort_order = 0;")?;
    }
    Ok(())
}

fn migrate_webhook_secret_retries(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "secret")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN secret TEXT NOT NULL DEFAULT '';",
        )?;
    }
    if !column_exists(conn, "webhook_rules", "retries")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN retries INTEGER NOT NULL DEFAULT 1;",
        )?;
    }
    Ok(())
}

fn migrate_webhook_trigger_event(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "trigger_event")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN trigger_event TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn migrate_webhook_cooldown(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "cooldown_seconds")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN cooldown_seconds INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    Ok(())
}

fn migrate_webhook_circuit_breaker(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "consecutive_failures")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "webhook_rules", "auto_disable_after")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN auto_disable_after INTEGER NOT NULL DEFAULT 3;",
        )?;
    }
    Ok(())
}

fn migrate_session_pinned(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "sessions", "pinned")? {
        conn.execute_batch("ALTER TABLE sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;")?;
    }
    Ok(())
}

fn migrate_session_archived(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "sessions", "archived")? {
        conn.execute_batch("ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;")?;
    }
    Ok(())
}

fn migrate_updated_at(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "clipboard_history", "updated_at")? {
        conn.execute_batch(
            "ALTER TABLE clipboard_history ADD COLUMN updated_at INTEGER DEFAULT 0;
             UPDATE clipboard_history SET updated_at = timestamp WHERE updated_at = 0;",
        )?;
    }
    if !column_exists(conn, "error_logs", "updated_at")? {
        conn.execute_batch(
            "ALTER TABLE error_logs ADD COLUMN updated_at INTEGER DEFAULT 0;
             UPDATE error_logs SET updated_at = timestamp WHERE updated_at = 0;",
        )?;
    }
    Ok(())
}

fn migrate_error_log_device(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "error_logs", "device_id")? {
        conn.execute_batch(
            "ALTER TABLE error_logs ADD COLUMN device_id TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn migrate_version_parent(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "message_versions", "parent_version_id")? {
        conn.execute_batch("ALTER TABLE message_versions ADD COLUMN parent_version_id TEXT;")?;
    }
    Ok(())
}

fn migrate_task_completed_at(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "tasks", "completed_at")? {
        conn.execute_batch("ALTER TABLE tasks ADD COLUMN completed_at INTEGER;")?;
    }
    Ok(())
}

fn migrate_schedule_event_date(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "schedule_events", "date")? {
        conn.execute_batch(
            "ALTER TABLE schedule_events ADD COLUMN date TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info(?1) WHERE name = ?2",
        params![table, column],
        |row| row.get(0),
    )?;
    Ok(exists)
}

fn seed_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
    if count > 0 {
        seed_habits_if_empty(conn)?;
        seed_events_if_empty(conn)?;
        seed_system_if_empty(conn)?;
        seed_agents_if_empty(conn)?;
        return Ok(());
    }
    let now = now_millis();
    conn.execute(
        "INSERT INTO projects (id, name, path, revenue, status, created_at) VALUES (?1, ?2, ?3, 0.0, 'active', ?4)",
        params![uid(), "AI Workbench", "D:\\ai-workbench", now],
    )?;
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at, completed_at) VALUES (?1, ?2, 'in_progress', 1, NULL, ?3, NULL)",
        params![uid(), "Ship App Shell", now],
    )?;
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at, completed_at) VALUES (?1, ?2, 'todo', 1, NULL, ?3, NULL)",
        params![uid(), "Review design tokens", now],
    )?;
    conn.execute(
        "INSERT INTO thoughts (id, content, tags, type, created_at) VALUES (?1, ?2, '#work', 'inbox', ?3)",
        params![uid(), "Keep the dock at exactly 5 views.", now],
    )?;
    conn.execute(
        "INSERT INTO thoughts (id, content, tags, type, created_at) VALUES (?1, ?2, '#work,#life', 'note', ?3)",
        params![uid(), "# Sprint 3 笔记\n\n## 本周节奏\n\n- 早间：阅读 30 分钟\n- 下午：Sprint 验收\n\n```ts\nconst focus = tasks.filter(t => t.isToday);\n```\n\n> 先冻结范围，再写代码。", now],
    )?;
    conn.execute(
        "INSERT INTO providers (id, name, base_url, api_key, is_active) VALUES (?1, 'OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY', 1)",
        params![uid()],
    )?;
    conn.execute(
        "INSERT INTO providers (id, name, base_url, api_key, is_active) VALUES (?1, 'Ollama', 'http://localhost:11434', '', 1)",
        params![uid()],
    )?;
    conn.execute(
        "INSERT INTO sessions (id, project_id, title, model, created_at) VALUES (?1, NULL, 'Workbench planning', 'openai', ?2)",
        params![uid(), now],
    )?;
    seed_habits_if_empty(conn)?;
    seed_events_if_empty(conn)?;
    seed_system_if_empty(conn)?;
    seed_agents_if_empty(conn)?;
    Ok(())
}

fn seed_habits_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM habits", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let now = now_millis();
    let reading_id = uid();
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '晨间阅读', 5, 0, 'emerald', ?2)",
        params![reading_id, now],
    )?;
    for days_ago in [1i64, 2, 3] {
        seed_habit_log(conn, &reading_id, days_ago, now)?;
    }
    let deep_work_id = uid();
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '深水工作', 4, 0, 'blue', ?2)",
        params![deep_work_id, now],
    )?;
    for days_ago in [1i64, 2] {
        seed_habit_log(conn, &deep_work_id, days_ago, now)?;
    }
    let exercise_id = uid();
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '运动 30 分钟', 3, 0, 'amber', ?2)",
        params![exercise_id, now],
    )?;
    for days_ago in [1i64, 2, 3, 4, 5] {
        seed_habit_log(conn, &exercise_id, days_ago, now)?;
    }
    Ok(())
}

fn seed_habit_log(conn: &Connection, habit_id: &str, days_ago: i64, now: i64) -> Result<()> {
    let offset = format!("-{} days", days_ago);
    let date: String = conn.query_row(
        "SELECT date('now', 'localtime', ?1)",
        params![offset],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO habit_logs (id, habit_id, date, checked_at) VALUES (?1, ?2, ?3, ?4)",
        params![uid(), habit_id, date, now - days_ago * 86_400_000],
    )?;
    Ok(())
}

fn seed_events_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM schedule_events", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let now = now_millis();
    conn.execute(
        "INSERT INTO schedule_events (id, title, start_time, date, done, tag, created_at) VALUES (?1, '每日复盘', '09:30', date('now','localtime'), 0, 'routine', ?2)",
        params![uid(), now],
    )?;
    conn.execute(
        "INSERT INTO schedule_events (id, title, start_time, date, done, tag, created_at) VALUES (?1, 'Sprint 3 验收', '14:00', date('now','localtime'), 0, 'work', ?2)",
        params![uid(), now],
    )?;
    Ok(())
}

fn seed_system_if_empty(conn: &Connection) -> Result<()> {
    seed_clipboard_if_empty(conn)?;
    seed_logs_if_empty(conn)?;
    Ok(())
}

fn seed_clipboard_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM clipboard_history", [], |row| {
        row.get(0)
    })?;
    if count > 0 {
        return Ok(());
    }
    let now = now_millis();
    conn.execute(
        "INSERT INTO clipboard_history (id, content, source, timestamp, updated_at) VALUES (?1, ?2, 'terminal', ?3, ?4)",
        params![uid(), "pnpm run dev", now - 5000, now - 5000],
    )?;
    conn.execute(
        "INSERT INTO clipboard_history (id, content, source, timestamp, updated_at) VALUES (?1, ?2, 'editor', ?3, ?4)",
        params![uid(), "bg-[#18181C] border-white/10 rounded-2xl", now - 4000, now - 4000],
    )?;
    Ok(())
}

fn seed_logs_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM error_logs", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id) VALUES (?1, 'tauri', 'DB initialized', NULL, 'info', ?2, ?3, '')",
        params![uid(), now_millis() - 7000, now_millis() - 7000],
    )?;
    Ok(())
}

fn seed_agents_if_empty(conn: &Connection) -> Result<()> {
    let now = now_millis();
    let department_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM departments", [], |row| row.get(0))?;
    if department_count == 0 {
        let design_id = uid();
        let product_id = uid();
        let backend_id = uid();
        let ai_id = uid();
        let quality_id = uid();
        conn.execute(
            "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, '设计部', '界面、交互与视觉动效', 'iris', ?2)",
            params![&design_id, now],
        )?;
        conn.execute(
            "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, '产品与体验部', '需求、用户路径与优先级', 'ocean', ?2)",
            params![&product_id, now],
        )?;
        conn.execute(
            "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, '后端与系统部', '数据层、Tauri 命令与运维', 'emerald', ?2)",
            params![&backend_id, now],
        )?;
        conn.execute(
            "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, 'AI 策略与引擎部', '模型路由、Prompt 与多 Agent 编排', 'amber', ?2)",
            params![&ai_id, now],
        )?;
        conn.execute(
            "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, '质量与工程效率部', '测试、DoD 与自动化验收', 'sakura', ?2)",
            params![&quality_id, now],
        )?;
        let design_agents = [
            ("UI Designer", "设计系统与动效", "你是 AI Workbench 的 UI Designer，负责设计系统、动效与视觉验收。输出需遵循 Design Token，并服务于 5 大主视图。"),
            ("Frontend Developer", "React/Tailwind 实现", "你是 AI Workbench 的 Frontend Developer，负责 React/Tailwind 实现。输出需可运行、可验证，并保持布局稳定。"),
            ("UI Finish-Gate Reviewer", "视觉验收", "你是 AI Workbench 的 UI Finish-Gate Reviewer，负责视觉验收。输出必须给出可测量的验收项与风险。"),
        ];
        let product_agents = [
            ("Product Manager", "范围冻结与验收标准", "你是 AI Workbench 的 Product Manager，负责范围冻结与验收标准。每个需求必须给出明确的 AC。"),
            ("UX Architect", "交互与信息架构", "你是 AI Workbench 的 UX Architect，负责交互与信息架构。输出需考虑工作台高频路径与 5 大主视图。"),
        ];
        let backend_agents = [
            ("Backend Architect", "Tauri 命令与分层设计", "你是 AI Workbench 的 Backend Architect，负责 Tauri 命令与分层设计。输出需保持模块边界清晰并考虑错误路径。"),
            ("Data Engineer", "SQLite 表结构与迁移", "你是 AI Workbench 的 Data Engineer，负责 SQLite 表结构与迁移。输出需包含索引、外键与迁移脚本。"),
        ];
        let ai_agents = [
            ("AI Engineer", "模型路由与流式链路", "你是 AI Workbench 的 AI Engineer，负责模型路由与流式链路。输出需兼容 Tauri 与浏览器 fallback。"),
            ("Prompt Engineer", "Prompt 版本与测试用例", "你是 AI Workbench 的 Prompt Engineer，负责 Prompt 版本与测试用例。输出需给出可复现的用例。"),
            ("Multi-Agent Systems Architect", "部门与 Agent 编排", "你是 AI Workbench 的 Multi-Agent Systems Architect，负责部门与 Agent 编排。输出需明确分工、并行度与汇总结论。"),
        ];
        let quality_agents = [
            ("Test Automation Engineer", "自动化验收与回归", "你是 AI Workbench 的 Test Automation Engineer，负责自动化验收与回归。输出需覆盖 verify:ui 与 Rust 单测。"),
            ("Reality Checker", "证据驱动的发布门禁", "你是 AI Workbench 的 Reality Checker，负责证据驱动的发布门禁。输出必须引用实际文件与命令结果。"),
        ];
        for (name, role, prompt) in design_agents {
            conn.execute(
                "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 'openai', NULL, ?5, 1, ?6)",
                params![uid(), &design_id, name, role, prompt, now],
            )?;
        }
        for (name, role, prompt) in product_agents {
            conn.execute(
                "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 'openai', NULL, ?5, 1, ?6)",
                params![uid(), &product_id, name, role, prompt, now],
            )?;
        }
        for (name, role, prompt) in backend_agents {
            conn.execute(
                "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 'openai', NULL, ?5, 1, ?6)",
                params![uid(), &backend_id, name, role, prompt, now],
            )?;
        }
        for (name, role, prompt) in ai_agents {
            conn.execute(
                "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 'openai', NULL, ?5, 1, ?6)",
                params![uid(), &ai_id, name, role, prompt, now],
            )?;
        }
        for (name, role, prompt) in quality_agents {
            conn.execute(
                "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 'openai', NULL, ?5, 1, ?6)",
                params![uid(), &quality_id, name, role, prompt, now],
            )?;
        }
    }
    Ok(())
}

pub fn list_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, status, is_today, due_date, completed_at, created_at FROM tasks ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            status: row.get(2)?,
            is_today: row.get::<_, i64>(3)? != 0,
            due_date: row.get(4)?,
            completed_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn create_task(conn: &Connection, title: &str, is_today: bool) -> Result<Task> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at, completed_at) VALUES (?1, ?2, 'todo', ?3, NULL, ?4, NULL)",
        params![id, title, is_today as i64, now],
    )?;
    Ok(Task {
        id,
        title: title.to_string(),
        status: "todo".to_string(),
        is_today,
        due_date: None,
        completed_at: None,
        created_at: now,
    })
}

pub fn update_task_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "UPDATE tasks SET status = ?1, completed_at = CASE WHEN ?1 = 'done' THEN ?3 ELSE NULL END WHERE id = ?2",
        params![status, id, now],
    )?;
    Ok(())
}

pub fn set_task_today(conn: &Connection, id: &str, is_today: bool) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET is_today = ?1 WHERE id = ?2",
        params![is_today as i64, id],
    )?;
    Ok(())
}

pub fn set_task_due_date(conn: &Connection, id: &str, due_date: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET due_date = ?1 WHERE id = ?2",
        params![due_date, id],
    )?;
    Ok(())
}

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, revenue, status, created_at FROM projects ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            revenue: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn create_project(conn: &Connection, name: &str, path: &str) -> Result<Project> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO projects (id, name, path, revenue, status, created_at) VALUES (?1, ?2, ?3, 0.0, 'active', ?4)",
        params![id, name, if path.is_empty() { None } else { Some(path) }, now],
    )?;
    conn.execute(
        "INSERT INTO project_revenue_history (id, project_id, revenue, recorded_at) VALUES (?1, ?2, ?3, ?4)",
        params![uid(), id, 0.0, now],
    )?;
    Ok(Project {
        id,
        name: name.to_string(),
        path: if path.is_empty() {
            None
        } else {
            Some(path.to_string())
        },
        revenue: 0.0,
        status: "active".to_string(),
        created_at: now,
    })
}

pub fn update_project(conn: &Connection, id: &str, status: &str, revenue: f64) -> Result<Project> {
    let status = if status == "paused" {
        "paused"
    } else {
        "active"
    };
    let revenue = if revenue.is_finite() && revenue >= 0.0 {
        revenue
    } else {
        0.0
    };
    conn.execute(
        "UPDATE projects SET status = ?1, revenue = ?2 WHERE id = ?3",
        params![status, revenue, id],
    )?;
    conn.execute(
        "INSERT INTO project_revenue_history (id, project_id, revenue, recorded_at) VALUES (?1, ?2, ?3, ?4)",
        params![uid(), id, revenue, now_millis()],
    )?;
    list_projects(conn)?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_project(conn: &Connection, id: &str) -> Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )?;
    if exists == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    conn.execute(
        "UPDATE sessions SET project_id = NULL WHERE project_id = ?1",
        params![id],
    )?;
    conn.execute(
        "DELETE FROM project_revenue_history WHERE project_id = ?1",
        params![id],
    )?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_project_revenue_history(
    conn: &Connection,
    project_id: &str,
    limit: i64,
) -> Result<Vec<ProjectRevenuePoint>> {
    let limit = limit.clamp(1, 100);
    let mut stmt = conn.prepare(
        "SELECT id, project_id, revenue, recorded_at FROM project_revenue_history WHERE project_id = ?1 ORDER BY recorded_at DESC, rowid DESC LIMIT ?2",
    )?;
    let mut points = stmt
        .query_map(params![project_id, limit], |row| {
            Ok(ProjectRevenuePoint {
                id: row.get(0)?,
                project_id: row.get(1)?,
                revenue: row.get(2)?,
                recorded_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    points.reverse();
    Ok(points)
}

pub fn list_thoughts(conn: &Connection) -> Result<Vec<Thought>> {
    let mut stmt = conn.prepare(
        "SELECT id, content, tags, type, created_at FROM thoughts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Thought {
            id: row.get(0)?,
            content: row.get(1)?,
            tags: row.get(2)?,
            kind: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn create_thought(conn: &Connection, content: &str, tags: &str, kind: &str) -> Result<Thought> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO thoughts (id, content, tags, type, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, content, tags, kind, now],
    )?;
    Ok(Thought {
        id,
        content: content.to_string(),
        tags: tags.to_string(),
        kind: kind.to_string(),
        created_at: now,
    })
}

pub fn update_thought_tags(conn: &Connection, id: &str, tags: &str) -> Result<Thought> {
    conn.execute(
        "UPDATE thoughts SET tags = ?1 WHERE id = ?2",
        params![tags, id],
    )?;
    list_thoughts(conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_thought_content(conn: &Connection, id: &str, content: &str) -> Result<Thought> {
    conn.execute(
        "UPDATE thoughts SET content = ?1 WHERE id = ?2",
        params![content, id],
    )?;
    list_thoughts(conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_thought_type(conn: &Connection, id: &str, kind: &str) -> Result<Thought> {
    conn.execute(
        "UPDATE thoughts SET type = ?1 WHERE id = ?2",
        params![kind, id],
    )?;
    list_thoughts(conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_thought(conn: &Connection, id: &str) -> Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM thoughts WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )?;
    if exists == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    conn.execute("DELETE FROM thoughts WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_quick_prompts(conn: &Connection) -> Result<Vec<QuickPrompt>> {
    let mut stmt = conn.prepare(
        "SELECT id, label, category, text, custom, sort_order, updated_at, created_at FROM quick_prompts ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(QuickPrompt {
            id: row.get(0)?,
            label: row.get(1)?,
            category: row.get(2)?,
            text: row.get(3)?,
            custom: row.get::<_, i64>(4)? != 0,
            sort_order: row.get(5)?,
            updated_at: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_quick_prompt(conn: &Connection, prompt: &QuickPrompt) -> Result<()> {
    conn.execute(
        "INSERT INTO quick_prompts (id, label, category, text, custom, sort_order, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET label = ?2, category = ?3, text = ?4, custom = ?5, sort_order = ?6, updated_at = ?7",
        params![
            prompt.id,
            prompt.label,
            prompt.category,
            prompt.text,
            prompt.custom as i64,
            prompt.sort_order,
            prompt.updated_at,
            prompt.created_at,
        ],
    )?;
    Ok(())
}

pub fn next_quick_prompt_order(conn: &Connection) -> Result<i64> {
    let max: Option<i64> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM quick_prompts WHERE custom = 1",
            [],
            |row| row.get(0),
        )
        .optional()?;
    Ok(max.unwrap_or(0) + 1)
}

pub fn update_custom_quick_prompt(
    conn: &Connection,
    id: &str,
    label: &str,
    category: &str,
    text: &str,
) -> Result<QuickPrompt, String> {
    let existing = conn
        .query_row(
            "SELECT id, label, category, text, custom, sort_order, updated_at, created_at
             FROM quick_prompts WHERE id = ?1",
            params![id],
            |row| {
                Ok(QuickPrompt {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    category: row.get(2)?,
                    text: row.get(3)?,
                    custom: row.get::<_, i64>(4)? != 0,
                    sort_order: row.get(5)?,
                    updated_at: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("quick prompt not found: {id}"))?;
    if !existing.custom {
        return Err(format!("quick prompt is not custom: {id}"));
    }
    let prompt = QuickPrompt {
        label: label.to_string(),
        category: category.to_string(),
        text: text.to_string(),
        updated_at: now_millis(),
        ..existing
    };
    upsert_quick_prompt(conn, &prompt).map_err(|e| e.to_string())?;
    Ok(prompt)
}

pub fn reorder_custom_quick_prompts(conn: &Connection, ids: &[String]) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE quick_prompts SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND custom = 1",
            params![index as i64, now_millis(), id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn delete_quick_prompt(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM quick_prompts WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_quick_prompt_usage(conn: &Connection) -> Result<Vec<QuickPromptUsageEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, count, updated_at FROM quick_prompt_usage WHERE count > 0 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(QuickPromptUsageEntry {
            id: row.get(0)?,
            count: row.get(1)?,
            updated_at: row.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_quick_prompt_usage(
    conn: &Connection,
    id: &str,
    count: i64,
    updated_at: i64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO quick_prompt_usage (id, count, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET count = ?2, updated_at = ?3",
        params![id, count, updated_at],
    )?;
    Ok(())
}

pub fn record_quick_prompt_usage(conn: &Connection, id: &str) -> Result<i64> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO quick_prompt_usage (id, count, updated_at) VALUES (?1, 1, ?2)
         ON CONFLICT(id) DO UPDATE SET count = count + 1, updated_at = ?2",
        params![id, now],
    )?;
    conn.query_row(
        "SELECT count FROM quick_prompt_usage WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
}

pub fn list_providers(conn: &Connection) -> Result<Vec<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, base_url, api_key, model, priority, is_active
         FROM providers ORDER BY priority DESC, rowid ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Provider {
            id: row.get(0)?,
            name: row.get(1)?,
            base_url: row.get(2)?,
            api_key: row.get(3)?,
            model: row.get(4)?,
            priority: row.get(5)?,
            is_active: row.get::<_, i64>(6)? != 0,
        })
    })?;
    rows.collect()
}

pub fn get_provider(conn: &Connection, id: &str) -> Result<Option<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, base_url, api_key, model, priority, is_active
         FROM providers WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Provider {
            id: row.get(0)?,
            name: row.get(1)?,
            base_url: row.get(2)?,
            api_key: row.get(3)?,
            model: row.get(4)?,
            priority: row.get(5)?,
            is_active: row.get::<_, i64>(6)? != 0,
        })
    })?;
    rows.next().transpose()
}

pub fn create_provider(
    conn: &Connection,
    name: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
) -> Result<Provider> {
    let id = uid();
    conn.execute(
        "INSERT INTO providers (id, name, base_url, api_key, model, is_active) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        params![id, name, base_url, api_key, model],
    )?;
    Ok(Provider {
        id,
        name: name.to_string(),
        base_url: base_url.to_string(),
        api_key: api_key.to_string(),
        model: model.to_string(),
        priority: 0,
        is_active: false,
    })
}

pub fn set_provider_active(conn: &Connection, id: &str, is_active: bool) -> Result<()> {
    conn.execute(
        "UPDATE providers SET is_active = ?1 WHERE id = ?2",
        params![is_active as i64, id],
    )?;
    Ok(())
}

pub fn set_provider_priority(conn: &Connection, id: &str, priority: i64) -> Result<()> {
    conn.execute(
        "UPDATE providers SET priority = ?1 WHERE id = ?2",
        params![priority.max(0), id],
    )?;
    Ok(())
}

pub fn update_provider_model(conn: &Connection, id: &str, model: &str) -> Result<()> {
    conn.execute(
        "UPDATE providers SET model = ?1 WHERE id = ?2",
        params![model, id],
    )?;
    Ok(())
}

pub fn list_departments(conn: &Connection) -> Result<Vec<Department>> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.name, COALESCE(d.description, ''), COALESCE(d.color, 'emerald'), d.created_at,
                (SELECT COUNT(*) FROM agents a WHERE a.department_id = d.id)
         FROM departments d
         ORDER BY d.created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Department {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            agent_count: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn list_agents(conn: &Connection) -> Result<Vec<Agent>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.department_id, COALESCE(d.name, ''), a.name, COALESCE(a.role, ''),
                COALESCE(a.model, 'openai'), a.provider_id, COALESCE(a.system_prompt, ''), a.is_active, a.created_at
         FROM agents a
         LEFT JOIN departments d ON d.id = a.department_id
         ORDER BY d.created_at ASC, a.created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Agent {
            id: row.get(0)?,
            department_id: row.get(1)?,
            department_name: row.get(2)?,
            name: row.get(3)?,
            role: row.get(4)?,
            model: row.get(5)?,
            provider_id: row.get(6)?,
            system_prompt: row.get(7)?,
            is_active: row.get::<_, i64>(8)? != 0,
            created_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

fn get_agent(conn: &Connection, id: &str) -> Result<Option<Agent>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.department_id, COALESCE(d.name, ''), a.name, COALESCE(a.role, ''),
                COALESCE(a.model, 'openai'), a.provider_id, COALESCE(a.system_prompt, ''), a.is_active, a.created_at
         FROM agents a
         LEFT JOIN departments d ON d.id = a.department_id
         WHERE a.id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Agent {
            id: row.get(0)?,
            department_id: row.get(1)?,
            department_name: row.get(2)?,
            name: row.get(3)?,
            role: row.get(4)?,
            model: row.get(5)?,
            provider_id: row.get(6)?,
            system_prompt: row.get(7)?,
            is_active: row.get::<_, i64>(8)? != 0,
            created_at: row.get(9)?,
        })
    })?;
    rows.next().transpose()
}

pub fn create_department(
    conn: &Connection,
    name: &str,
    description: &str,
    color: &str,
) -> Result<Department> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO departments (id, name, description, color, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, description, color, now],
    )?;
    Ok(Department {
        id,
        name: name.to_string(),
        description: description.to_string(),
        color: color.to_string(),
        agent_count: 0,
        created_at: now,
    })
}

pub fn create_agent(
    conn: &Connection,
    department_id: &str,
    name: &str,
    role: &str,
    model: &str,
    provider_id: Option<String>,
    system_prompt: &str,
) -> Result<Agent> {
    let id = uid();
    conn.execute(
        "INSERT INTO agents (id, department_id, name, role, model, provider_id, system_prompt, is_active, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)",
        params![id, department_id, name, role, model, provider_id, system_prompt, now_millis()],
    )?;
    get_agent(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_agent_system_prompt(
    conn: &Connection,
    id: &str,
    system_prompt: &str,
) -> Result<Agent> {
    let current = get_agent(conn, id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    if current.system_prompt != system_prompt {
        save_agent_prompt_version(conn, id, &current.system_prompt)?;
        conn.execute(
            "UPDATE agents SET system_prompt = ?1 WHERE id = ?2",
            params![system_prompt, id],
        )?;
    }
    get_agent(conn, id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn save_agent_prompt_version(
    conn: &Connection,
    agent_id: &str,
    content: &str,
) -> Result<AgentPromptVersion> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO agent_prompt_versions (id, agent_id, content, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, agent_id, content, now],
    )?;
    Ok(AgentPromptVersion {
        id,
        agent_id: agent_id.to_string(),
        content: content.to_string(),
        created_at: now,
    })
}

pub fn list_agent_prompt_versions(
    conn: &Connection,
    agent_id: &str,
) -> Result<Vec<AgentPromptVersion>> {
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, content, created_at FROM agent_prompt_versions
         WHERE agent_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![agent_id], |row| {
        Ok(AgentPromptVersion {
            id: row.get(0)?,
            agent_id: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn restore_agent_prompt(conn: &Connection, agent_id: &str, version_id: &str) -> Result<Agent> {
    let version = conn
        .query_row(
            "SELECT id, agent_id, content, created_at FROM agent_prompt_versions
             WHERE id = ?1 AND agent_id = ?2",
            params![version_id, agent_id],
            |row| {
                Ok(AgentPromptVersion {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    let current = get_agent(conn, agent_id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    if current.system_prompt != version.content {
        save_agent_prompt_version(conn, agent_id, &current.system_prompt)?;
        conn.execute(
            "UPDATE agents SET system_prompt = ?1 WHERE id = ?2",
            params![version.content, agent_id],
        )?;
    }
    get_agent(conn, agent_id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

fn habit_log_dates(conn: &Connection, habit_id: &str) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT date FROM habit_logs WHERE habit_id = ?1 ORDER BY date ASC")?;
    let rows = stmt.query_map(params![habit_id], |row| row.get(0))?;
    rows.collect()
}

pub fn list_habits(conn: &Connection) -> Result<Vec<Habit>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, week_goal, current_streak, color, created_at
         FROM habits
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(4)?,
            row.get::<_, i64>(5)?,
        ))
    })?;
    let today = today_local();
    let mut habits = Vec::new();
    for row in rows {
        let (id, name, week_goal, color, created_at) = row?;
        let log_dates = habit_log_dates(conn, &id)?;
        let done_today = log_dates.iter().any(|date| date == &today);
        habits.push(Habit {
            id,
            name,
            week_goal,
            current_streak: compute_habit_streak(&log_dates, &today),
            color,
            done_today,
            created_at,
            recent_logs: recent_habit_logs(&log_dates, &today, 14),
        });
    }
    Ok(habits)
}

pub fn create_habit(conn: &Connection, name: &str, week_goal: i64, color: &str) -> Result<Habit> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5)",
        params![id, name, week_goal, color, now],
    )?;
    Ok(Habit {
        id,
        name: name.to_string(),
        week_goal,
        current_streak: 0,
        color: color.to_string(),
        done_today: false,
        created_at: now,
        recent_logs: Vec::new(),
    })
}

pub fn toggle_habit(conn: &Connection, id: &str) -> Result<Habit> {
    let today = today_local();
    let checked: i64 = conn.query_row(
        "SELECT COUNT(*) FROM habit_logs WHERE habit_id = ?1 AND date = ?2",
        params![id, today],
        |row| row.get(0),
    )?;
    if checked > 0 {
        conn.execute(
            "DELETE FROM habit_logs WHERE habit_id = ?1 AND date = ?2",
            params![id, today],
        )?;
    } else {
        conn.execute(
            "INSERT INTO habit_logs (id, habit_id, date, checked_at) VALUES (?1, ?2, ?3, ?4)",
            params![uid(), id, today, now_millis()],
        )?;
    }
    let habit = list_habits(conn)?
        .into_iter()
        .find(|h| h.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    Ok(habit)
}

pub fn update_habit_week_goal(conn: &Connection, id: &str, week_goal: i64) -> Result<Habit> {
    let goal = week_goal.clamp(1, 31);
    conn.execute(
        "UPDATE habits SET week_goal = ?1 WHERE id = ?2",
        params![goal, id],
    )?;
    list_habits(conn)?
        .into_iter()
        .find(|h| h.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_habit(conn: &Connection, id: &str) -> Result<bool> {
    conn.execute("DELETE FROM habit_logs WHERE habit_id = ?1", params![id])?;
    let removed = conn.execute("DELETE FROM habits WHERE id = ?1", params![id])?;
    Ok(removed > 0)
}

pub fn list_schedule_events(conn: &Connection) -> Result<Vec<ScheduleEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, start_time, date, done, tag, created_at FROM schedule_events ORDER BY date ASC, start_time ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ScheduleEvent {
            id: row.get(0)?,
            title: row.get(1)?,
            start_time: row.get(2)?,
            date: row.get(3)?,
            done: row.get::<_, i64>(4)? != 0,
            tag: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn create_schedule_event(
    conn: &Connection,
    title: &str,
    start_time: &str,
    date: &str,
    tag: &str,
) -> Result<ScheduleEvent> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO schedule_events (id, title, start_time, date, done, tag, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        params![id, title, start_time, date, tag, now],
    )?;
    Ok(ScheduleEvent {
        id,
        title: title.to_string(),
        start_time: start_time.to_string(),
        date: date.to_string(),
        done: false,
        tag: tag.to_string(),
        created_at: now,
    })
}

pub fn toggle_event_done(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE schedule_events SET done = CASE WHEN done = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn capture_clipboard(conn: &Connection, content: &str, source: &str) -> Result<ClipboardItem> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "empty clipboard".into(),
        ));
    }
    let recent: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clipboard_history WHERE content = ?1 AND updated_at > ?2",
        params![trimmed, now_millis() - 10_000],
        |row| row.get(0),
    )?;
    if recent > 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "duplicate clipboard".into(),
        ));
    }
    let id = uid();
    let timestamp = now_millis();
    conn.execute(
        "INSERT INTO clipboard_history (id, content, source, timestamp, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, trimmed, source, timestamp, timestamp],
    )?;
    Ok(ClipboardItem {
        id,
        content: trimmed.to_string(),
        source: source.to_string(),
        timestamp,
        updated_at: timestamp,
    })
}

pub fn list_clipboard(conn: &Connection) -> Result<Vec<ClipboardItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, content, source, timestamp, updated_at FROM clipboard_history ORDER BY updated_at DESC LIMIT 30",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ClipboardItem {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            timestamp: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn report_frontend_error(
    conn: &Connection,
    source: &str,
    message: &str,
    stack: Option<&str>,
    severity: &str,
    device_id: &str,
) -> Result<ErrorLog> {
    let id = uid();
    let timestamp = now_millis();
    conn.execute(
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, source, message, stack, severity, timestamp, timestamp, device_id],
    )?;
    Ok(ErrorLog {
        id,
        source: source.to_string(),
        message: message.to_string(),
        stack: stack.map(|s| s.to_string()),
        severity: severity.to_string(),
        timestamp,
        updated_at: timestamp,
        device_id: device_id.to_string(),
    })
}

pub fn list_error_logs(conn: &Connection) -> Result<Vec<ErrorLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, source, message, stack, severity, timestamp, updated_at, device_id FROM error_logs ORDER BY updated_at DESC LIMIT 30",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ErrorLog {
            id: row.get(0)?,
            source: row.get(1)?,
            message: row.get(2)?,
            stack: row.get(3)?,
            severity: row.get(4)?,
            timestamp: row.get(5)?,
            updated_at: row.get(6)?,
            device_id: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn build_sync_snapshot(conn: &Connection) -> Result<SyncSnapshot, String> {
    Ok(SyncSnapshot {
        device_id: uid(),
        exported_at: now_millis(),
        clipboard: list_clipboard(conn).map_err(|e| e.to_string())?,
        logs: list_error_logs(conn).map_err(|e| e.to_string())?,
        quick_prompts: list_quick_prompts(conn).map_err(|e| e.to_string())?,
        quick_prompt_usage: list_quick_prompt_usage(conn).map_err(|e| e.to_string())?,
    })
}

pub fn export_sync_snapshot(conn: &Connection, path: &Path) -> Result<SyncSnapshot, String> {
    let snapshot = build_sync_snapshot(conn)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(snapshot)
}

pub fn import_sync_snapshot(conn: &Connection, path: &Path) -> Result<SyncResult, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let snapshot: SyncSnapshot = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    merge_sync_snapshot(conn, snapshot)
}

pub fn merge_sync_snapshot(
    conn: &Connection,
    snapshot: SyncSnapshot,
) -> Result<SyncResult, String> {
    let mut clipboard_added = 0;
    let mut clipboard_updated = 0;
    let mut conflicts = Vec::new();
    for item in snapshot.clipboard {
        match merge_clipboard_item(conn, &item).map_err(|e| e.to_string())? {
            MergeOutcome::Added => clipboard_added += 1,
            MergeOutcome::Updated {
                local_updated_at,
                local_content,
            } => {
                clipboard_updated += 1;
                conflicts.push(SyncConflictItem {
                    id: item.id.clone(),
                    kind: "clipboard".to_string(),
                    local_updated_at,
                    remote_updated_at: item.updated_at,
                    resolved_to: "remote".to_string(),
                    preview: item.content.chars().take(120).collect(),
                    local_content,
                    remote_content: item.content.clone(),
                });
            }
            MergeOutcome::Skipped {
                local_updated_at,
                local_content,
            } => {
                if local_updated_at > item.updated_at {
                    conflicts.push(SyncConflictItem {
                        id: item.id.clone(),
                        kind: "clipboard".to_string(),
                        local_updated_at,
                        remote_updated_at: item.updated_at,
                        resolved_to: "local".to_string(),
                        preview: item.content.chars().take(120).collect(),
                        local_content,
                        remote_content: item.content.clone(),
                    });
                }
            }
        }
    }
    let mut logs_added = 0;
    let mut logs_updated = 0;
    for log in snapshot.logs {
        match merge_error_log(conn, &log).map_err(|e| e.to_string())? {
            MergeOutcome::Added => logs_added += 1,
            MergeOutcome::Updated {
                local_updated_at,
                local_content,
            } => {
                logs_updated += 1;
                conflicts.push(SyncConflictItem {
                    id: log.id.clone(),
                    kind: "log".to_string(),
                    local_updated_at,
                    remote_updated_at: log.updated_at,
                    resolved_to: "remote".to_string(),
                    preview: log.message.chars().take(120).collect(),
                    local_content,
                    remote_content: log.message.clone(),
                });
            }
            MergeOutcome::Skipped {
                local_updated_at,
                local_content,
            } => {
                if local_updated_at > log.updated_at {
                    conflicts.push(SyncConflictItem {
                        id: log.id.clone(),
                        kind: "log".to_string(),
                        local_updated_at,
                        remote_updated_at: log.updated_at,
                        resolved_to: "local".to_string(),
                        preview: log.message.chars().take(120).collect(),
                        local_content,
                        remote_content: log.message.clone(),
                    });
                }
            }
        }
    }
    let mut quick_prompts_added = 0;
    let mut quick_prompts_updated = 0;
    for prompt in snapshot.quick_prompts {
        let local_prompt: Option<QuickPrompt> = conn
            .query_row(
                "SELECT id, label, category, text, custom, sort_order, updated_at, created_at FROM quick_prompts WHERE id = ?1",
                params![prompt.id],
                |row| {
                    Ok(QuickPrompt {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        category: row.get(2)?,
                        text: row.get(3)?,
                        custom: row.get::<_, i64>(4)? != 0,
                        sort_order: row.get(5)?,
                        updated_at: row.get(6)?,
                        created_at: row.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        match local_prompt {
            None => {
                upsert_quick_prompt(conn, &prompt).map_err(|e| e.to_string())?;
                quick_prompts_added += 1;
            }
            Some(local) if local.updated_at < prompt.updated_at => {
                upsert_quick_prompt(conn, &prompt).map_err(|e| e.to_string())?;
                quick_prompts_updated += 1;
                conflicts.push(SyncConflictItem {
                    id: prompt.id.clone(),
                    kind: "quick_prompt".to_string(),
                    local_updated_at: local.updated_at,
                    remote_updated_at: prompt.updated_at,
                    resolved_to: "remote".to_string(),
                    preview: prompt.text.chars().take(120).collect(),
                    local_content: serde_json::to_string(&local).unwrap_or_default(),
                    remote_content: serde_json::to_string(&prompt).unwrap_or_default(),
                });
            }
            Some(local) if local.updated_at > prompt.updated_at => {
                conflicts.push(SyncConflictItem {
                    id: prompt.id.clone(),
                    kind: "quick_prompt".to_string(),
                    local_updated_at: local.updated_at,
                    remote_updated_at: prompt.updated_at,
                    resolved_to: "local".to_string(),
                    preview: prompt.text.chars().take(120).collect(),
                    local_content: serde_json::to_string(&local).unwrap_or_default(),
                    remote_content: serde_json::to_string(&prompt).unwrap_or_default(),
                });
            }
            Some(_) => {}
        }
    }
    let mut quick_prompt_usage_updated = 0;
    for entry in snapshot.quick_prompt_usage {
        let local_count: Option<i64> = conn
            .query_row(
                "SELECT count FROM quick_prompt_usage WHERE id = ?1",
                params![entry.id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if local_count.unwrap_or(0) < entry.count {
            upsert_quick_prompt_usage(conn, &entry.id, entry.count, entry.updated_at)
                .map_err(|e| e.to_string())?;
            quick_prompt_usage_updated += 1;
        }
    }
    for conflict in &conflicts {
        persist_conflict(conn, conflict)?;
    }
    let _ = append_sync_audit(
        conn,
        "sync.merge",
        &format!(
            "clips +{} / updated {} / logs +{} / updated {} / prompts +{} / updated {} / usage {} / conflicts {}",
            clipboard_added,
            clipboard_updated,
            logs_added,
            logs_updated,
            quick_prompts_added,
            quick_prompts_updated,
            quick_prompt_usage_updated,
            conflicts.len()
        ),
        &snapshot.device_id,
    );
    Ok(SyncResult {
        device_id: snapshot.device_id,
        synced_at: now_millis(),
        clipboard_added,
        clipboard_updated,
        logs_added,
        logs_updated,
        quick_prompts_added,
        quick_prompts_updated,
        quick_prompt_usage_updated,
        conflicts,
    })
}

fn persist_conflict(conn: &Connection, conflict: &SyncConflictItem) -> Result<(), String> {
    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sync_conflicts WHERE id = ?1 AND kind = ?2 AND resolved_choice IS NULL",
            params![conflict.id, conflict.kind],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if existing > 0 {
        conn.execute(
            "UPDATE sync_conflicts
             SET local_content = ?1,
                 remote_content = ?2,
                 local_updated_at = ?3,
                 remote_updated_at = ?4,
                 resolved_to = ?5,
                 preview = ?6
             WHERE id = ?7 AND kind = ?8 AND resolved_choice IS NULL",
            params![
                conflict.local_content,
                conflict.remote_content,
                conflict.local_updated_at,
                conflict.remote_updated_at,
                conflict.resolved_to,
                conflict.preview,
                conflict.id,
                conflict.kind
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO sync_conflicts
             (id, kind, local_content, remote_content, local_updated_at, remote_updated_at,
              resolved_to, preview, resolved_choice, resolved_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, NULL, ?9)",
            params![
                conflict.id,
                conflict.kind,
                conflict.local_content,
                conflict.remote_content,
                conflict.local_updated_at,
                conflict.remote_updated_at,
                conflict.resolved_to,
                conflict.preview,
                now_millis()
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn list_sync_conflicts(
    conn: &Connection,
    status: &str,
) -> Result<Vec<SyncConflictRecord>, String> {
    let mut sql = String::from(
        "SELECT id, kind, local_content, remote_content, local_updated_at, remote_updated_at,
                resolved_to, preview, resolved_choice, resolved_at, created_at
         FROM sync_conflicts",
    );
    match status {
        "unresolved" => sql.push_str(" WHERE resolved_choice IS NULL ORDER BY created_at DESC"),
        "resolved" => sql.push_str(" WHERE resolved_choice IS NOT NULL ORDER BY resolved_at DESC"),
        _ => sql.push_str(" ORDER BY created_at DESC"),
    }
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SyncConflictRecord {
                id: row.get(0)?,
                kind: row.get(1)?,
                local_content: row.get(2)?,
                remote_content: row.get(3)?,
                local_updated_at: row.get(4)?,
                remote_updated_at: row.get(5)?,
                resolved_to: row.get(6)?,
                preview: row.get(7)?,
                resolved_choice: row.get(8)?,
                resolved_at: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn clear_resolved_sync_conflicts(conn: &Connection) -> Result<usize, String> {
    let deleted = conn
        .execute(
            "DELETE FROM sync_conflicts WHERE resolved_choice IS NOT NULL",
            [],
        )
        .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.history.cleared",
        &format!("cleared {} resolved conflict(s)", deleted),
        "",
    );
    Ok(deleted)
}

pub fn append_sync_audit(
    conn: &Connection,
    event: &str,
    detail: &str,
    device_id: &str,
) -> Result<SyncAuditEntry> {
    let created_at = now_millis();
    conn.execute(
        "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![event, detail, device_id, created_at],
    )?;
    Ok(SyncAuditEntry {
        id: conn.last_insert_rowid(),
        event: event.to_string(),
        detail: detail.to_string(),
        device_id: device_id.to_string(),
        created_at,
    })
}

pub fn list_sync_audit(
    conn: &Connection,
    limit: i64,
    event: Option<&str>,
    since: Option<i64>,
    device_id: Option<&str>,
) -> Result<Vec<SyncAuditEntry>, String> {
    list_sync_audit_range(conn, limit, event, since, None, device_id)
}

pub fn list_sync_audit_range(
    conn: &Connection,
    limit: i64,
    event: Option<&str>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<&str>,
) -> Result<Vec<SyncAuditEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, event, detail, device_id, created_at
             FROM sync_audit_log
             WHERE (?1 IS NULL OR event = ?1)
               AND (?2 IS NULL OR created_at >= ?2)
               AND (?3 IS NULL OR created_at <= ?3)
               AND (?4 IS NULL OR device_id = ?4)
             ORDER BY created_at DESC, id DESC LIMIT ?5",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![event, since, until, device_id, limit], |row| {
            Ok(SyncAuditEntry {
                id: row.get(0)?,
                event: row.get(1)?,
                detail: row.get(2)?,
                device_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn iso_date_from_epoch_ms(epoch_ms: i64) -> String {
    let day_ms = 86_400_000i64;
    let days = epoch_ms.div_euclid(day_ms);
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year_base = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year_base + 1 } else { year_base };
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn error_bucket_label(start_at: i64, granularity: &str) -> String {
    let date = iso_date_from_epoch_ms(start_at);
    if granularity != "hour" {
        return date;
    }
    let hour = (start_at / 3_600_000i64).rem_euclid(24);
    format!("{date} {hour:02}:00")
}

fn error_bucket_step(granularity: &str, day_ms: i64, week_ms: i64, hour_ms: i64) -> i64 {
    if granularity == "hour" {
        hour_ms
    } else if granularity == "week" {
        week_ms
    } else {
        day_ms
    }
}

pub fn sync_audit_summary_range(
    conn: &Connection,
    granularity: &str,
    event: Option<&str>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<&str>,
) -> Result<SyncAuditSummary, String> {
    let day_ms = 86_400_000i64;
    let week_ms = day_ms * 7;
    if granularity != "day" && granularity != "week" {
        return Err("unsupported audit summary granularity; use day or week".to_string());
    }
    let mut stmt = conn
        .prepare(
            "SELECT created_at, event FROM sync_audit_log
             WHERE (?1 IS NULL OR event = ?1)
               AND (?2 IS NULL OR created_at >= ?2)
               AND (?3 IS NULL OR created_at <= ?3)
               AND (?4 IS NULL OR device_id = ?4)",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![event, since, until, device_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut grouped: HashMap<i64, (i64, i64, i64)> = HashMap::new();
    let mut total = 0i64;
    for row in rows {
        let (created_at, event_name) = row.map_err(|e| e.to_string())?;
        let start_at = if granularity == "week" {
            let days = created_at.div_euclid(day_ms);
            let week_index = (days + 3).div_euclid(7);
            (week_index * 7 - 3) * day_ms
        } else {
            created_at.div_euclid(day_ms) * day_ms
        };
        let slot = grouped.entry(start_at).or_insert((0, 0, 0));
        if event_name.starts_with("sync.merge") {
            slot.0 += 1;
        } else if event_name.starts_with("sync.resolve") {
            slot.1 += 1;
        } else {
            slot.2 += 1;
        }
        total += 1;
    }
    let mut buckets: Vec<SyncAuditBucket> = grouped
        .iter()
        .map(|(&start_at, &(merge, resolve, other))| SyncAuditBucket {
            bucket: iso_date_from_epoch_ms(start_at),
            start_at,
            count: merge + resolve + other,
            merge,
            resolve,
            other,
        })
        .collect();
    buckets.sort_by_key(|bucket| bucket.start_at);
    if !buckets.is_empty() && buckets.len() <= 62 {
        let step = if granularity == "week" {
            week_ms
        } else {
            day_ms
        };
        let mut filled = Vec::new();
        let mut cursor = buckets[0].start_at;
        for bucket in buckets {
            while cursor < bucket.start_at {
                filled.push(SyncAuditBucket {
                    bucket: iso_date_from_epoch_ms(cursor),
                    start_at: cursor,
                    count: 0,
                    merge: 0,
                    resolve: 0,
                    other: 0,
                });
                cursor += step;
            }
            filled.push(bucket);
            cursor += step;
        }
        buckets = filled;
    }
    Ok(SyncAuditSummary {
        granularity: granularity.to_string(),
        total,
        buckets,
    })
}

pub fn error_log_summary(
    conn: &Connection,
    granularity: &str,
    source: Option<&str>,
    severity: Option<&str>,
    device_id: Option<&str>,
    since_ms: Option<i64>,
    until_ms: Option<i64>,
) -> Result<ErrorLogSummary, String> {
    let day_ms = 86_400_000i64;
    let week_ms = day_ms * 7;
    let hour_ms = 3_600_000i64;
    if granularity != "hour" && granularity != "day" && granularity != "week" {
        return Err("unsupported error log granularity; use hour, day or week".to_string());
    }
    let mut stmt = conn
        .prepare(
            "SELECT severity, updated_at FROM error_logs
             WHERE (?1 IS NULL OR source = ?1)
               AND (?2 IS NULL OR severity = ?2)
               AND (?3 IS NULL OR device_id = ?3)
               AND (?4 IS NULL OR updated_at >= ?4)
               AND (?5 IS NULL OR updated_at <= ?5)",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![source, severity, device_id, since_ms, until_ms],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let mut grouped: HashMap<i64, (i64, i64, i64)> = HashMap::new();
    let mut total = 0i64;
    for row in rows {
        let (severity_name, updated_at) = row.map_err(|e| e.to_string())?;
        let start_at = if granularity == "hour" {
            updated_at.div_euclid(hour_ms) * hour_ms
        } else if granularity == "week" {
            let days = updated_at.div_euclid(day_ms);
            let week_index = (days + 3).div_euclid(7);
            (week_index * 7 - 3) * day_ms
        } else {
            updated_at.div_euclid(day_ms) * day_ms
        };
        let slot = grouped.entry(start_at).or_insert((0, 0, 0));
        match severity_name.as_str() {
            "error" => slot.0 += 1,
            "warning" => slot.1 += 1,
            _ => slot.2 += 1,
        }
        total += 1;
    }
    let mut buckets: Vec<ErrorLogBucket> = grouped
        .iter()
        .map(|(&start_at, &(error, warning, info))| ErrorLogBucket {
            bucket: error_bucket_label(start_at, granularity),
            start_at,
            count: error + warning + info,
            error,
            warning,
            info,
        })
        .collect();
    buckets.sort_by_key(|bucket| bucket.start_at);
    if !buckets.is_empty() && buckets.len() <= 62 {
        let step = error_bucket_step(granularity, day_ms, week_ms, hour_ms);
        let mut filled = Vec::new();
        let mut cursor = buckets[0].start_at;
        for bucket in buckets {
            while cursor < bucket.start_at {
                filled.push(ErrorLogBucket {
                    bucket: error_bucket_label(cursor, granularity),
                    start_at: cursor,
                    count: 0,
                    error: 0,
                    warning: 0,
                    info: 0,
                });
                cursor += step;
            }
            filled.push(bucket);
            cursor += step;
        }
        buckets = filled;
    }
    Ok(ErrorLogSummary {
        granularity: granularity.to_string(),
        total,
        buckets,
    })
}

fn csv_escape(value: &str) -> String {
    if value.chars().any(|c| matches!(c, ',' | '"' | '\r' | '\n')) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn export_sync_audit(
    conn: &Connection,
    format: &str,
    event: Option<&str>,
    since: Option<i64>,
    device_id: Option<&str>,
) -> Result<String, String> {
    export_sync_audit_range(conn, format, event, since, None, device_id)
}

pub fn export_sync_audit_range(
    conn: &Connection,
    format: &str,
    event: Option<&str>,
    since: Option<i64>,
    until: Option<i64>,
    device_id: Option<&str>,
) -> Result<String, String> {
    let entries = list_sync_audit_range(conn, 10_000, event, since, until, device_id)?;
    match format {
        "json" => serde_json::to_string_pretty(&entries).map_err(|e| e.to_string()),
        "csv" => {
            let mut out = String::from("id,event,detail,device_id,created_at\n");
            for entry in &entries {
                out.push_str(&format!(
                    "{},{},{},{},{}\n",
                    entry.id,
                    csv_escape(&entry.event),
                    csv_escape(&entry.detail),
                    csv_escape(&entry.device_id),
                    entry.created_at
                ));
            }
            Ok(out)
        }
        _ => Err("unsupported audit export format; use json or csv".to_string()),
    }
}

pub fn clear_sync_audit(conn: &Connection) -> Result<usize, String> {
    conn.execute("DELETE FROM sync_audit_log", [])
        .map_err(|e| e.to_string())
}

pub fn get_vault_watch_config(conn: &Connection) -> Result<VaultWatchConfig> {
    let row = conn.query_row(
        "SELECT path, ignore_patterns, enabled, updated_at
         FROM vault_watch_config WHERE id = 1",
        [],
        |row| {
            let raw: String = row.get(1)?;
            let enabled: i64 = row.get(2)?;
            Ok((
                row.get::<_, String>(0)?,
                raw,
                enabled,
                row.get::<_, i64>(3)?,
            ))
        },
    );
    match row {
        Ok((path, raw, enabled, updated_at)) => Ok(VaultWatchConfig {
            path,
            ignore_patterns: raw
                .lines()
                .map(|line| line.to_string())
                .filter(|line| !line.is_empty())
                .collect(),
            enabled: enabled != 0,
            updated_at,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(VaultWatchConfig {
            path: String::new(),
            ignore_patterns: Vec::new(),
            enabled: false,
            updated_at: 0,
        }),
        Err(e) => Err(e),
    }
}

pub fn set_vault_watch_config(
    conn: &Connection,
    path: &str,
    ignore_patterns: &[String],
    enabled: bool,
) -> Result<VaultWatchConfig> {
    let joined = ignore_patterns.join("\n");
    conn.execute(
        "INSERT INTO vault_watch_config (id, path, ignore_patterns, enabled, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           path = excluded.path,
           ignore_patterns = excluded.ignore_patterns,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at",
        params![path, joined, enabled as i64, now_millis()],
    )?;
    get_vault_watch_config(conn)
}

pub fn list_vault_watch_targets(conn: &Connection) -> Result<Vec<VaultWatchTarget>> {
    let mut stmt = conn.prepare(
        "SELECT path, ignore_patterns, enabled, updated_at, last_event_at, event_count,
                created_events, modified_events, removed_events
         FROM vault_watch_targets ORDER BY path",
    )?;
    let rows = stmt.query_map([], |row| {
        let raw: String = row.get(1)?;
        let enabled: i64 = row.get(2)?;
        Ok((
            row.get::<_, String>(0)?,
            raw,
            enabled,
            row.get::<_, i64>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, i64>(8)?,
        ))
    })?;
    let mut targets = Vec::new();
    for row in rows {
        let (
            path,
            raw,
            enabled,
            updated_at,
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        ) = row?;
        targets.push(VaultWatchTarget {
            path,
            ignore_patterns: raw
                .lines()
                .map(|line| line.to_string())
                .filter(|line| !line.is_empty())
                .collect(),
            enabled: enabled != 0,
            updated_at,
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        });
    }
    Ok(targets)
}

fn get_vault_watch_target(conn: &Connection, path: &str) -> Result<Option<VaultWatchTarget>> {
    let row = conn.query_row(
        "SELECT path, ignore_patterns, enabled, updated_at, last_event_at, event_count,
                created_events, modified_events, removed_events
         FROM vault_watch_targets WHERE path = ?1",
        params![path],
        |row| {
            let raw: String = row.get(1)?;
            let enabled: i64 = row.get(2)?;
            Ok((
                row.get::<_, String>(0)?,
                raw,
                enabled,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        },
    );
    match row {
        Ok((
            path,
            raw,
            enabled,
            updated_at,
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        )) => Ok(Some(VaultWatchTarget {
            path,
            ignore_patterns: raw
                .lines()
                .map(|line| line.to_string())
                .filter(|line| !line.is_empty())
                .collect(),
            enabled: enabled != 0,
            updated_at,
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        })),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn upsert_vault_watch_target(
    conn: &Connection,
    path: &str,
    ignore_patterns: &[String],
    enabled: bool,
) -> Result<VaultWatchTarget> {
    let patterns: Vec<String> = ignore_patterns
        .iter()
        .filter(|pattern| !pattern.is_empty())
        .cloned()
        .collect();
    let joined = patterns.join("\n");
    let updated_at = now_millis();
    conn.execute(
        "INSERT INTO vault_watch_targets
         (path, ignore_patterns, enabled, updated_at, last_event_at, event_count,
          created_events, modified_events, removed_events)
         VALUES (?1, ?2, ?3, ?4, 0, 0, 0, 0, 0)
         ON CONFLICT(path) DO UPDATE SET
           ignore_patterns = excluded.ignore_patterns,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at",
        params![path, joined, enabled as i64, updated_at],
    )?;
    Ok(VaultWatchTarget {
        path: path.to_string(),
        ignore_patterns: patterns,
        enabled,
        updated_at,
        last_event_at: 0,
        event_count: 0,
        created_events: 0,
        modified_events: 0,
        removed_events: 0,
    })
}

pub fn touch_vault_watch_event(
    conn: &Connection,
    path: &str,
    file_path: &str,
    event_kind: &str,
) -> Result<(), String> {
    let (created, modified, removed) = match event_kind {
        "created" => (1, 0, 0),
        "modified" => (0, 1, 0),
        "removed" => (0, 0, 1),
        _ => {
            return Err(format!(
                "Unsupported vault watch event kind: {}",
                event_kind
            ))
        }
    };
    let now = now_millis();
    conn.execute(
        "INSERT INTO vault_watch_events (vault_path, file_path, event_kind, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![path, file_path, event_kind, now],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM vault_watch_events
         WHERE id NOT IN (SELECT id FROM vault_watch_events ORDER BY id DESC LIMIT 500)",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO vault_watch_targets
         (path, ignore_patterns, enabled, updated_at, last_event_at, event_count,
          created_events, modified_events, removed_events)
         VALUES (?1, '', 0, ?2, ?2, 1, ?3, ?4, ?5)
         ON CONFLICT(path) DO UPDATE SET
           last_event_at = excluded.last_event_at,
           event_count = event_count + 1,
           created_events = created_events + excluded.created_events,
           modified_events = modified_events + excluded.modified_events,
           removed_events = removed_events + excluded.removed_events",
        params![path, now, created, modified, removed],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_vault_watch_events(
    conn: &Connection,
    vault_path: Option<&str>,
    limit: i64,
) -> Result<Vec<VaultWatchEvent>, String> {
    let limit = limit.clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, vault_path, file_path, event_kind, created_at
             FROM vault_watch_events
             WHERE (?1 IS NULL OR vault_path = ?1)
             ORDER BY created_at DESC, id DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![vault_path, limit], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (id, vault_path, file_path, event_kind, created_at) = row.map_err(|e| e.to_string())?;
        out.push(VaultWatchEvent {
            id,
            vault_path,
            file_path,
            event_kind,
            created_at,
        });
    }
    Ok(out)
}

pub fn clear_vault_watch_events(
    conn: &Connection,
    vault_path: Option<&str>,
) -> Result<i64, String> {
    let removed = match vault_path {
        Some(path) => conn
            .execute(
                "DELETE FROM vault_watch_events WHERE vault_path = ?1",
                params![path],
            )
            .map_err(|e| e.to_string())?,
        None => conn
            .execute("DELETE FROM vault_watch_events", [])
            .map_err(|e| e.to_string())?,
    };
    Ok(removed as i64)
}

pub fn set_vault_watch_target_enabled(
    conn: &Connection,
    path: &str,
    enabled: bool,
) -> Result<Option<VaultWatchTarget>> {
    let changed = conn.execute(
        "UPDATE vault_watch_targets SET enabled = ?2, updated_at = ?3 WHERE path = ?1",
        params![path, enabled as i64, now_millis()],
    )?;
    if changed == 0 {
        return Ok(None);
    }
    get_vault_watch_target(conn, path)
}

pub fn delete_vault_watch_target(conn: &Connection, path: &str) -> Result<bool> {
    conn.execute(
        "DELETE FROM vault_watch_events WHERE vault_path = ?1",
        params![path],
    )?;
    let deleted = conn.execute(
        "DELETE FROM vault_watch_targets WHERE path = ?1",
        params![path],
    )?;
    Ok(deleted > 0)
}

enum MergeOutcome {
    Added,
    Updated {
        local_updated_at: i64,
        local_content: String,
    },
    Skipped {
        local_updated_at: i64,
        local_content: String,
    },
}

fn merge_clipboard_item(conn: &Connection, item: &ClipboardItem) -> Result<MergeOutcome> {
    let local_row: Option<(String, i64)> = conn
        .query_row(
            "SELECT content, updated_at FROM clipboard_history WHERE id = ?1",
            params![item.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    match local_row {
        Some((local_content, local_updated)) if local_updated >= item.updated_at => {
            Ok(MergeOutcome::Skipped {
                local_updated_at: local_updated,
                local_content,
            })
        }
        Some((local_content, local_updated)) => {
            conn.execute(
                "UPDATE clipboard_history SET content = ?1, source = ?2, timestamp = ?3, updated_at = ?4 WHERE id = ?5",
                params![item.content, item.source, item.timestamp, item.updated_at, item.id],
            )?;
            Ok(MergeOutcome::Updated {
                local_updated_at: local_updated,
                local_content,
            })
        }
        None => {
            conn.execute(
                "INSERT INTO clipboard_history (id, content, source, timestamp, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![item.id, item.content, item.source, item.timestamp, item.updated_at],
            )?;
            Ok(MergeOutcome::Added)
        }
    }
}

fn merge_error_log(conn: &Connection, log: &ErrorLog) -> Result<MergeOutcome> {
    let local_row: Option<(String, i64)> = conn
        .query_row(
            "SELECT message, updated_at FROM error_logs WHERE id = ?1",
            params![log.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    match local_row {
        Some((local_content, local_updated)) if local_updated >= log.updated_at => {
            Ok(MergeOutcome::Skipped {
                local_updated_at: local_updated,
                local_content,
            })
        }
        Some((local_content, local_updated)) => {
            conn.execute(
                "UPDATE error_logs SET source = ?1, message = ?2, stack = ?3, severity = ?4, timestamp = ?5, updated_at = ?6, device_id = ?7 WHERE id = ?8",
                params![log.source, log.message, log.stack, log.severity, log.timestamp, log.updated_at, log.device_id, log.id],
            )?;
            Ok(MergeOutcome::Updated {
                local_updated_at: local_updated,
                local_content,
            })
        }
        None => {
            conn.execute(
                "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![log.id, log.source, log.message, log.stack, log.severity, log.timestamp, log.updated_at, log.device_id],
            )?;
            Ok(MergeOutcome::Added)
        }
    }
}

fn apply_quick_prompt_resolution(conn: &Connection, content: &str) -> Result<(), String> {
    let mut prompt: QuickPrompt = serde_json::from_str(content).map_err(|e| e.to_string())?;
    prompt.updated_at = now_millis();
    upsert_quick_prompt(conn, &prompt).map_err(|e| e.to_string())
}

pub fn resolve_conflict(
    conn: &Connection,
    conflict: &SyncConflictItem,
    choice: &str,
) -> Result<(), String> {
    let content = match choice {
        "local" => conflict.local_content.clone(),
        "remote" => conflict.remote_content.clone(),
        _ => return Err(format!("Unsupported conflict choice: {}", choice)),
    };
    let now = now_millis();
    match conflict.kind.as_str() {
        "clipboard" => {
            conn.execute(
                "UPDATE clipboard_history SET content = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "log" => {
            conn.execute(
                "UPDATE error_logs SET message = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "quick_prompt" => {
            apply_quick_prompt_resolution(conn, &content)?;
        }
        _ => return Err(format!("Unsupported conflict kind: {}", conflict.kind)),
    }
    conn.execute(
        "UPDATE sync_conflicts
         SET resolved_choice = ?1, resolved_at = ?2
         WHERE id = ?3 AND kind = ?4 AND resolved_choice IS NULL",
        params![choice, now, conflict.id, conflict.kind],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve",
        &format!("{} {} -> {}", conflict.kind, conflict.id, choice),
        "",
    );
    Ok(())
}

pub fn resolve_conflicts(
    conn: &Connection,
    conflicts: &[SyncConflictItem],
    choice: &str,
) -> Result<usize, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for conflict in conflicts {
        resolve_conflict(&tx, conflict, choice)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve.batch",
        &format!(
            "batch resolved {} conflict(s) -> {}",
            conflicts.len(),
            choice
        ),
        "",
    );
    Ok(conflicts.len())
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            format!(
                "{{{}}}",
                keys.iter()
                    .map(|key| {
                        let encoded =
                            serde_json::to_string(key).unwrap_or_else(|_| format!("\"{}\"", key));
                        let child = map.get(key.as_str()).unwrap_or(&Value::Null);
                        format!("{}:{}", encoded, canonical_json(child))
                    })
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => value.to_string(),
    }
}

fn merge_json_value(local: &Value, remote: &Value, prefer_local: bool) -> Value {
    match (local, remote) {
        (Value::Object(local_obj), Value::Object(remote_obj)) => {
            let mut keys: Vec<&String> = local_obj.keys().chain(remote_obj.keys()).collect();
            keys.sort();
            keys.dedup();
            let mut merged = serde_json::Map::new();
            for key in keys {
                let value = match (local_obj.get(key), remote_obj.get(key)) {
                    (Some(local_value), Some(remote_value)) => {
                        merge_json_value(local_value, remote_value, prefer_local)
                    }
                    (Some(local_value), None) => local_value.clone(),
                    (None, Some(remote_value)) => remote_value.clone(),
                    (None, None) => Value::Null,
                };
                merged.insert(key.clone(), value);
            }
            Value::Object(merged)
        }
        (Value::Array(local_arr), Value::Array(remote_arr)) => {
            let mut seen = std::collections::HashSet::new();
            let mut merged = Vec::new();
            for item in local_arr.iter().chain(remote_arr.iter()) {
                if seen.insert(canonical_json(item)) {
                    merged.push(item.clone());
                }
            }
            Value::Array(merged)
        }
        _ => {
            if prefer_local || local == remote {
                local.clone()
            } else {
                remote.clone()
            }
        }
    }
}

fn parse_frontmatter(text: &str) -> Option<(Vec<(String, String)>, String)> {
    let text = text.trim_start_matches('\u{feff}');
    let rest = text.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    let raw = &rest[..end];
    let body_start = 3 + end + 4;
    let body = text.get(body_start..)?.trim_start_matches('\n').to_string();
    let fields = raw
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (key, value) = line.split_once(':')?;
            let key = key.trim();
            if key.is_empty() {
                return None;
            }
            Some((key.to_string(), value.trim().to_string()))
        })
        .collect::<Vec<_>>();
    if fields.is_empty() {
        None
    } else {
        Some((fields, body))
    }
}

fn merge_frontmatter_value(local: &str, remote: &str, prefer_local: bool) -> String {
    if local == remote {
        return local.to_string();
    }
    if local.contains(',') || remote.contains(',') {
        let mut seen = std::collections::HashSet::new();
        let mut parts = Vec::new();
        for item in local.split(',').chain(remote.split(',')) {
            let item = item.trim();
            if !item.is_empty() && seen.insert(item.to_string()) {
                parts.push(item.to_string());
            }
        }
        return parts.join(", ");
    }
    if prefer_local {
        local.to_string()
    } else {
        remote.to_string()
    }
}

fn render_frontmatter_merge(
    local_fields: &[(String, String)],
    remote_fields: &[(String, String)],
    prefer_local: bool,
    local_body: &str,
    remote_body: &str,
) -> String {
    let mut seen = std::collections::HashSet::new();
    let mut keys = Vec::new();
    for (key, _) in local_fields.iter().chain(remote_fields.iter()) {
        if seen.insert(key.clone()) {
            keys.push(key.clone());
        }
    }
    let mut lines = vec!["---".to_string()];
    for key in keys {
        let local_value = local_fields
            .iter()
            .find(|(k, _)| k == &key)
            .map(|(_, value)| value.as_str());
        let remote_value = remote_fields
            .iter()
            .find(|(k, _)| k == &key)
            .map(|(_, value)| value.as_str());
        let value = match (local_value, remote_value) {
            (Some(local), Some(remote)) => merge_frontmatter_value(local, remote, prefer_local),
            (Some(local), None) => local.to_string(),
            (None, Some(remote)) => remote.to_string(),
            (None, None) => continue,
        };
        lines.push(format!("{}: {}", key, value));
    }
    lines.push("---".to_string());
    let head = lines.join("\n");
    let body = union_merge_content(local_body, remote_body);
    if body.is_empty() {
        head
    } else {
        format!("{}\n\n{}", head, body)
    }
}

fn structured_merge_content(local: &str, remote: &str, prefer_local: bool) -> String {
    if let (Ok(local_json), Ok(remote_json)) = (
        serde_json::from_str::<Value>(local),
        serde_json::from_str::<Value>(remote),
    ) {
        let structured = (local_json.is_object() || local_json.is_array())
            && (remote_json.is_object() || remote_json.is_array());
        if structured {
            let merged = merge_json_value(&local_json, &remote_json, prefer_local);
            return serde_json::to_string_pretty(&merged)
                .unwrap_or_else(|_| union_merge_content(local, remote));
        }
    }
    if let (Some((local_fields, local_body)), Some((remote_fields, remote_body))) =
        (parse_frontmatter(local), parse_frontmatter(remote))
    {
        return render_frontmatter_merge(
            &local_fields,
            &remote_fields,
            prefer_local,
            &local_body,
            &remote_body,
        );
    }
    union_merge_content(local, remote)
}

fn union_merge_content(local: &str, remote: &str) -> String {
    let mut seen = std::collections::HashSet::new();
    let mut lines = Vec::new();
    for line in local.split('\n') {
        if !local.is_empty() && seen.insert(line.to_string()) {
            lines.push(line.to_string());
        }
    }
    for line in remote.split('\n') {
        if !remote.is_empty() && seen.insert(line.to_string()) {
            lines.push(line.to_string());
        }
    }
    lines.join("\n")
}

pub fn resolve_conflict_union(
    conn: &Connection,
    conflict: &SyncConflictItem,
) -> Result<String, String> {
    let content = if conflict.kind == "quick_prompt" {
        structured_merge_content(
            &conflict.local_content,
            &conflict.remote_content,
            conflict.local_updated_at >= conflict.remote_updated_at,
        )
    } else {
        union_merge_content(&conflict.local_content, &conflict.remote_content)
    };
    let now = now_millis();
    match conflict.kind.as_str() {
        "clipboard" => {
            conn.execute(
                "UPDATE clipboard_history SET content = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "log" => {
            conn.execute(
                "UPDATE error_logs SET message = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "quick_prompt" => {
            apply_quick_prompt_resolution(conn, &content)?;
        }
        _ => return Err(format!("Unsupported conflict kind: {}", conflict.kind)),
    }
    conn.execute(
        "UPDATE sync_conflicts
         SET resolved_choice = 'union', resolved_at = ?1
         WHERE id = ?2 AND kind = ?3 AND resolved_choice IS NULL",
        params![now, conflict.id, conflict.kind],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve.union",
        &format!("{} {} -> union", conflict.kind, conflict.id),
        "",
    );
    Ok(content)
}

pub fn resolve_conflicts_union(
    conn: &Connection,
    conflicts: &[SyncConflictItem],
) -> Result<usize, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for conflict in conflicts {
        resolve_conflict_union(&tx, conflict)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve.union.batch",
        &format!("batch merged {} conflict(s)", conflicts.len()),
        "",
    );
    Ok(conflicts.len())
}

pub fn resolve_conflict_structured(
    conn: &Connection,
    conflict: &SyncConflictItem,
) -> Result<String, String> {
    let prefer_local = conflict.local_updated_at >= conflict.remote_updated_at;
    let content = structured_merge_content(
        &conflict.local_content,
        &conflict.remote_content,
        prefer_local,
    );
    let now = now_millis();
    match conflict.kind.as_str() {
        "clipboard" => {
            conn.execute(
                "UPDATE clipboard_history SET content = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "log" => {
            conn.execute(
                "UPDATE error_logs SET message = ?1, updated_at = ?2 WHERE id = ?3",
                params![content, now, conflict.id],
            )
            .map_err(|e| e.to_string())?;
        }
        "quick_prompt" => {
            apply_quick_prompt_resolution(conn, &content)?;
        }
        _ => return Err(format!("Unsupported conflict kind: {}", conflict.kind)),
    }
    conn.execute(
        "UPDATE sync_conflicts
         SET resolved_choice = 'structured', resolved_at = ?1
         WHERE id = ?2 AND kind = ?3 AND resolved_choice IS NULL",
        params![now, conflict.id, conflict.kind],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve.structured",
        &format!("{} {} -> structured", conflict.kind, conflict.id),
        "",
    );
    Ok(content)
}

pub fn resolve_conflicts_structured(
    conn: &Connection,
    conflicts: &[SyncConflictItem],
) -> Result<usize, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for conflict in conflicts {
        resolve_conflict_structured(&tx, conflict)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.resolve.structured.batch",
        &format!("batch merged {} conflict(s) with fields", conflicts.len()),
        "",
    );
    Ok(conflicts.len())
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !(c.is_alphanumeric() || c.is_ascii_digit()))
        .filter(|t| !t.is_empty() && t.len() > 1)
        .map(|t| t.to_string())
        .collect()
}

const EMBED_DIM: usize = 256;
const FNV_OFFSET: u32 = 2166136261;
const FNV_PRIME: u32 = 16777619;

fn fnv1a(bytes: &[u8], seed: u32) -> u32 {
    let mut hash = seed;
    for byte in bytes {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

fn embed_text(text: &str) -> Vec<f64> {
    let lower = text.to_lowercase();
    let chars: Vec<char> = lower.chars().filter(|c| c.is_alphanumeric()).collect();
    let mut features = std::collections::BTreeSet::new();
    for word in tokenize(text) {
        features.insert(word);
    }
    for width in 1..=4usize {
        for window in chars.windows(width) {
            features.insert(window.iter().collect::<String>());
        }
    }
    let mut vector = vec![0.0f64; EMBED_DIM];
    for feature in features {
        let bytes = feature.as_bytes();
        let bucket = (fnv1a(bytes, FNV_OFFSET) as usize) % EMBED_DIM;
        let sign = if fnv1a(bytes, FNV_PRIME) & 1 == 0 {
            1.0
        } else {
            -1.0
        };
        vector[bucket] += sign;
    }
    let norm = vector.iter().map(|v| v * v).sum::<f64>().sqrt();
    if norm > 0.0 {
        for value in &mut vector {
            *value /= norm;
        }
    }
    vector
}

fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom > 0.0 {
        dot / denom
    } else {
        0.0
    }
}

fn serialize_embedding(vector: &[f64]) -> String {
    serde_json::to_string(vector).unwrap_or_else(|_| "[]".to_string())
}

pub fn rag_index_status(conn: &Connection) -> Result<RagIndexStatus> {
    let documents: i64 = conn.query_row("SELECT COUNT(*) FROM thoughts", [], |row| row.get(0))?;
    let files: i64 =
        conn.query_row("SELECT COUNT(*) FROM knowledge_files", [], |row| row.get(0))?;
    let last: Option<i64> =
        conn.query_row("SELECT MAX(created_at) FROM thoughts", [], |row| row.get(0))?;
    let file_last: Option<i64> =
        conn.query_row("SELECT MAX(indexed_at) FROM knowledge_files", [], |row| {
            row.get(0)
        })?;
    Ok(RagIndexStatus {
        documents: documents + files,
        indexed: documents + files > 0,
        last_indexed_at: last.max(file_last).unwrap_or(0),
        vector_indexed: documents + files > 0,
    })
}

pub fn upsert_knowledge_file(
    conn: &Connection,
    path: &str,
    title: &str,
    tags: &str,
    content: &str,
    vault_path: &str,
) -> Result<()> {
    let embedding = serialize_embedding(&embed_text(content));
    conn.execute(
        "INSERT INTO knowledge_files (id, path, title, tags, content, vault_path, indexed_at, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(path) DO UPDATE SET
           title = excluded.title,
           tags = excluded.tags,
           content = excluded.content,
           vault_path = excluded.vault_path,
           indexed_at = excluded.indexed_at,
           embedding = excluded.embedding",
        params![uid(), path, title, tags, content, vault_path, now_millis(), embedding],
    )?;
    Ok(())
}

pub fn vault_target_stats(conn: &Connection) -> Result<Vec<VaultTargetStats>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT f.vault_path, COUNT(*), MAX(f.indexed_at),
                    COALESCE(MAX(t.last_event_at), 0), COALESCE(MAX(t.event_count), 0),
                    COALESCE(MAX(t.created_events), 0), COALESCE(MAX(t.modified_events), 0),
                    COALESCE(MAX(t.removed_events), 0)
             FROM knowledge_files f
             LEFT JOIN vault_watch_targets t ON t.path = f.vault_path
             WHERE f.vault_path <> ''
             GROUP BY f.vault_path
             ORDER BY f.vault_path",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (
            path,
            files,
            last_indexed_at,
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        ) = row.map_err(|e| e.to_string())?;
        out.push(VaultTargetStats {
            path,
            files,
            last_indexed_at: last_indexed_at.unwrap_or(0),
            last_event_at,
            event_count,
            created_events,
            modified_events,
            removed_events,
        });
    }
    Ok(out)
}

pub fn delete_knowledge_file(conn: &Connection, path: &str) -> Result<()> {
    conn.execute("DELETE FROM knowledge_files WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn persist_vault_index_queue(conn: &Connection, record: &VaultIndexQueueRecord) -> Result<()> {
    let serialized =
        serde_json::to_string(&record.ignore_patterns).unwrap_or_else(|_| "[]".to_string());
    let now = now_millis();
    conn.execute(
        "INSERT INTO vault_index_queue (run_id, path, ignore_patterns, concurrency, status, priority, attempts, last_error, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
         ON CONFLICT(run_id) DO UPDATE SET
           path = excluded.path,
           ignore_patterns = excluded.ignore_patterns,
           concurrency = excluded.concurrency,
           status = excluded.status,
           priority = excluded.priority,
           attempts = excluded.attempts,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at",
        params![
            record.run_id,
            record.path,
            serialized,
            record.concurrency as i64,
            record.status,
            record.priority as i64,
            record.attempts as i64,
            record.last_error,
            now
        ],
    )?;
    Ok(())
}

pub fn list_vault_index_queue(conn: &Connection) -> Result<Vec<VaultIndexQueueRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT run_id, path, ignore_patterns, concurrency, status, priority, attempts, last_error
             FROM vault_index_queue
             ORDER BY priority DESC, created_at ASC, rowid ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        let (run_id, path, serialized, concurrency, status, priority, attempts, last_error) =
            row.map_err(|e| e.to_string())?;
        let ignore_patterns =
            serde_json::from_str::<Vec<String>>(&serialized).unwrap_or_else(|_| Vec::new());
        records.push(VaultIndexQueueRecord {
            run_id,
            path,
            ignore_patterns,
            concurrency: concurrency.clamp(0, 16) as usize,
            status,
            priority: priority.max(0) as usize,
            attempts: attempts.max(0) as usize,
            last_error,
        });
    }
    Ok(records)
}

pub fn delete_vault_index_queue(conn: &Connection, run_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM vault_index_queue WHERE run_id = ?1",
        params![run_id],
    )?;
    Ok(())
}

pub fn knowledge_index_status(conn: &Connection) -> Result<KnowledgeIndexStatus> {
    let files: i64 =
        conn.query_row("SELECT COUNT(*) FROM knowledge_files", [], |row| row.get(0))?;
    let last: Option<i64> =
        conn.query_row("SELECT MAX(indexed_at) FROM knowledge_files", [], |row| {
            row.get(0)
        })?;
    Ok(KnowledgeIndexStatus {
        files,
        indexed_at: last.unwrap_or(0),
    })
}

pub fn list_knowledge_files(
    conn: &Connection,
    vault_path: Option<&str>,
    limit: Option<i64>,
) -> Result<Vec<KnowledgeFileRecord>, String> {
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, tags, vault_path, indexed_at FROM knowledge_files
             WHERE (?1 IS NULL OR vault_path = ?1)
             ORDER BY indexed_at DESC, path ASC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![vault_path, limit], |row| {
            let id: String = row.get(0)?;
            let path: String = row.get(1)?;
            let title: String = row.get(2)?;
            let tags: String = row.get(3)?;
            let vault_path: String = row.get(4)?;
            let indexed_at: i64 = row.get(5)?;
            let exists = std::path::Path::new(&path).exists();
            let stale = exists && knowledge_file_stale(&path, indexed_at);
            Ok(KnowledgeFileRecord {
                id,
                path,
                title,
                tags,
                vault_path,
                indexed_at,
                exists,
                stale,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<KnowledgeFileRecord>, _>>()
        .map_err(|e| e.to_string())
}

fn knowledge_file_stale(path: &str, indexed_at: i64) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(modified_ms) = modified.duration_since(std::time::UNIX_EPOCH) else {
        return false;
    };
    (modified_ms.as_millis() as i64).saturating_sub(indexed_at) > 1_000
}

fn parse_knowledge_document(content: &str) -> (String, String, String) {
    match parse_frontmatter(content) {
        Some((fields, body)) => {
            let title = fields
                .iter()
                .find(|(key, _)| key == "title")
                .map(|(_, value)| value.clone())
                .unwrap_or_else(|| "Untitled".to_string());
            let tags = fields
                .iter()
                .find(|(key, _)| key == "tags")
                .map(|(_, value)| value.clone())
                .unwrap_or_default();
            (title, tags, body)
        }
        None => ("Untitled".to_string(), String::new(), content.to_string()),
    }
}

pub fn cleanup_knowledge_files(
    conn: &Connection,
    vault_path: Option<&str>,
) -> Result<KnowledgeCleanupResult, String> {
    let mut stmt = conn
        .prepare(
            "SELECT path, vault_path, indexed_at FROM knowledge_files
             WHERE (?1 IS NULL OR vault_path = ?1)",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![vault_path], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut removed = 0i64;
    let mut reindexed = 0i64;
    let mut failed = 0i64;
    for row in rows {
        let (path, doc_vault_path, indexed_at) = row.map_err(|e| e.to_string())?;
        let path_ref = std::path::Path::new(&path);
        if !path_ref.exists() {
            delete_knowledge_file(conn, &path).map_err(|e| e.to_string())?;
            removed += 1;
        } else if knowledge_file_stale(&path, indexed_at) {
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    let (title, tags, body) = parse_knowledge_document(&content);
                    upsert_knowledge_file(conn, &path, &title, &tags, &body, &doc_vault_path)
                        .map_err(|e| e.to_string())?;
                    reindexed += 1;
                }
                Err(_) => failed += 1,
            }
        }
    }
    Ok(KnowledgeCleanupResult {
        removed,
        reindexed,
        failed,
    })
}

pub fn search_thoughts(conn: &Connection, query: &str, limit: i64) -> Result<Vec<RagSearchResult>> {
    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        return Ok(Vec::new());
    }
    let query_embedding = embed_text(query);
    struct SearchDoc {
        id: String,
        content: String,
        tags: String,
        kind: String,
        tokens: Vec<String>,
        embedding: Vec<f64>,
    }
    let mut stmt = conn.prepare("SELECT id, content, tags, type FROM thoughts")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;
    let mut docs: Vec<SearchDoc> = rows
        .filter_map(Result::ok)
        .map(|(id, content, tags, kind)| {
            let tokens = tokenize(&content);
            let embedding = embed_text(&content);
            SearchDoc {
                id,
                content,
                tags,
                kind,
                tokens,
                embedding,
            }
        })
        .collect();
    let mut file_stmt = conn.prepare("SELECT id, content, tags, embedding FROM knowledge_files")?;
    let file_rows = file_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;
    for file in file_rows.flatten() {
        let (id, content, tags, embedding_raw) = file;
        let tokens = tokenize(&content);
        let embedding = if embedding_raw.is_empty() {
            embed_text(&content)
        } else {
            serde_json::from_str(&embedding_raw).unwrap_or_else(|_| embed_text(&content))
        };
        docs.push(SearchDoc {
            id,
            content,
            tags,
            kind: "doc".to_string(),
            tokens,
            embedding,
        });
    }
    if docs.is_empty() {
        return Ok(Vec::new());
    }
    let doc_count = docs.len() as f64;
    let avg_len = docs.iter().map(|d| d.tokens.len() as f64).sum::<f64>() / doc_count;

    let mut scored: Vec<(f64, RagSearchResult)> = Vec::new();
    for doc in &docs {
        let doc_freq: f64 = docs
            .iter()
            .filter(|d| d.tokens.iter().any(|t| query_tokens.contains(t)))
            .count() as f64;
        let idf = ((doc_count - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0).ln();
        let mut bm25 = 0.0;
        for term in &query_tokens {
            let tf = doc.tokens.iter().filter(|t| *t == term).count() as f64;
            if tf > 0.0 {
                let norm = doc.tokens.len() as f64;
                bm25 +=
                    idf * (tf * 1.5) / (tf + 1.5 * (1.0 - 0.75 + 0.75 * (norm / avg_len.max(1.0))));
            }
        }
        let vector_score = cosine_similarity(&query_embedding, &doc.embedding);
        let score = bm25 + 1.2 * vector_score;
        scored.push((
            score,
            RagSearchResult {
                id: doc.id.clone(),
                content: doc.content.clone(),
                tags: doc.tags.clone(),
                kind: doc.kind.clone(),
                score,
                vector_score,
            },
        ));
    }
    scored.sort_by(|a, b| b.0.total_cmp(&a.0));
    Ok(scored
        .into_iter()
        .take(limit.max(1) as usize)
        .map(|(_, r)| r)
        .collect())
}

pub fn list_sessions(conn: &Connection) -> Result<Vec<Session>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.project_id, s.title, s.model, s.created_at, s.pinned, s.archived,
                (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
         FROM sessions s
         ORDER BY s.pinned DESC, s.created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            model: row.get(3)?,
            created_at: row.get(4)?,
            pinned: row.get::<_, i64>(5)? != 0,
            archived: row.get::<_, i64>(6)? != 0,
            message_count: row.get(7)?,
        })
    })?;
    rows.collect()
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum MatchMode {
    Original,
    FullPinyin,
    InitialsPinyin,
}

fn substring_score(haystack: &str, query: &str) -> Option<i64> {
    if haystack.is_empty() || query.is_empty() {
        return None;
    }
    haystack.find(query).map(|index| 120 - index as i64)
}

fn subsequence_score(haystack: &str, query: &str) -> Option<i64> {
    if haystack.is_empty() || query.is_empty() {
        return None;
    }
    let hb = haystack.as_bytes();
    let qb = query.as_bytes();
    let mut qi = 0usize;
    let mut gaps = 0i64;
    let mut last: Option<usize> = None;
    for (index, &byte) in hb.iter().enumerate() {
        if qi < qb.len() && byte == qb[qi] {
            if let Some(prev) = last {
                gaps += (index - prev - 1) as i64;
            }
            last = Some(index);
            qi += 1;
            if qi == qb.len() {
                return Some((80 - gaps).max(1));
            }
        }
    }
    None
}

fn pinyin_text(text: &str, first_letter: bool) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if let Some(p) = ch.to_pinyin() {
            out.push_str(if first_letter {
                p.first_letter()
            } else {
                p.plain()
            });
        } else if !ch.is_whitespace() {
            out.extend(ch.to_lowercase());
        }
    }
    out
}

fn compact_query(query: &str) -> String {
    query.chars().filter(|c| !c.is_whitespace()).collect()
}

fn text_match_score(text: &str, query: &str) -> Option<(i64, MatchMode)> {
    let original_q = query.to_lowercase();
    if let Some(score) = substring_score(&text.to_lowercase(), &original_q) {
        return Some((score, MatchMode::Original));
    }
    if let Some(score) = subsequence_score(&text.to_lowercase(), &original_q) {
        return Some((score, MatchMode::Original));
    }

    let compact_q = compact_query(&original_q);
    let full = pinyin_text(text, false);
    if let Some(score) = substring_score(&full, &compact_q) {
        return Some((score - 5, MatchMode::FullPinyin));
    }
    if let Some(score) = subsequence_score(&full, &compact_q) {
        return Some((score - 10, MatchMode::FullPinyin));
    }

    let initials = pinyin_text(text, true);
    if let Some(score) = substring_score(&initials, &compact_q) {
        return Some((score - 15, MatchMode::InitialsPinyin));
    }
    if let Some(score) = subsequence_score(&initials, &compact_q) {
        return Some((score - 20, MatchMode::InitialsPinyin));
    }
    None
}

fn match_type(field: &str, mode: MatchMode) -> String {
    match mode {
        MatchMode::Original => field.to_string(),
        MatchMode::FullPinyin | MatchMode::InitialsPinyin => format!("pinyin-{}", field),
    }
}

fn session_snippet(content: &str) -> String {
    let text = content.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = text.chars();
    let mut out: String = chars.by_ref().take(90).collect();
    if chars.next().is_some() {
        out.push_str("...");
    }
    out
}

pub fn search_sessions(
    conn: &Connection,
    query: &str,
    since_ms: Option<i64>,
    until_ms: Option<i64>,
    limit: Option<i64>,
    include_messages: bool,
) -> Result<Vec<SessionSearchHit>> {
    let q = query.trim();
    let sessions = list_sessions(conn)?
        .into_iter()
        .filter(|s| !s.archived)
        .filter(|s| since_ms.is_none_or(|since| s.created_at >= since))
        .filter(|s| until_ms.is_none_or(|until| s.created_at <= until));

    if q.is_empty() {
        return Ok(sessions
            .map(|session| SessionSearchHit {
                session,
                match_type: "all".to_string(),
                snippet: String::new(),
                score: 0,
                message_id: None,
            })
            .collect());
    }

    let mut hits = Vec::new();
    for session in sessions {
        let mut best: Option<(i64, String, String, Option<String>)> = None;
        if let Some((score, mode)) = text_match_score(&session.title, q) {
            best = Some((
                score,
                match_type("title", mode),
                session.title.clone(),
                None,
            ));
        }
        if let Some((score, mode)) = text_match_score(&session.model, q) {
            let candidate = (
                score,
                match_type("model", mode),
                session.model.clone(),
                None,
            );
            if best
                .as_ref()
                .is_none_or(|(current, _, _, _)| score > *current)
            {
                best = Some(candidate);
            }
        }
        if include_messages {
            let mut stmt = conn.prepare(
                "SELECT id, content FROM chat_messages
                 WHERE session_id = ?1
                 ORDER BY created_at DESC
                 LIMIT 100",
            )?;
            let rows = stmt.query_map(params![session.id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            for row in rows {
                let (message_id, content) = row?;
                if let Some((score, mode)) = text_match_score(&content, q) {
                    let candidate = (
                        score,
                        match_type("message", mode),
                        session_snippet(&content),
                        Some(message_id),
                    );
                    if best
                        .as_ref()
                        .is_none_or(|(current, _, _, _)| score > *current)
                    {
                        best = Some(candidate);
                    }
                }
            }
        }
        if let Some((score, match_type, snippet, message_id)) = best {
            let pinned = session.pinned;
            hits.push(SessionSearchHit {
                session,
                match_type,
                snippet,
                score: score + if pinned { 10 } else { 0 },
                message_id,
            });
        }
    }

    hits.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| b.session.pinned.cmp(&a.session.pinned))
            .then_with(|| b.session.created_at.cmp(&a.session.created_at))
    });
    hits.truncate(limit.unwrap_or(50).max(1) as usize);
    Ok(hits)
}

pub fn create_session(conn: &Connection, title: &str, model: &str) -> Result<Session> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO sessions (id, project_id, title, model, created_at) VALUES (?1, NULL, ?2, ?3, ?4)",
        params![id, title, model, now],
    )?;
    Ok(Session {
        id,
        project_id: None,
        title: title.to_string(),
        model: model.to_string(),
        pinned: false,
        archived: false,
        message_count: 0,
        created_at: now,
    })
}

pub fn rename_session(conn: &Connection, id: &str, title: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET title = ?1 WHERE id = ?2",
        params![title, id],
    )?;
    Ok(())
}

pub fn set_session_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<()> {
    let updated = conn.execute(
        "UPDATE sessions SET pinned = ?1 WHERE id = ?2",
        params![pinned as i64, id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn set_session_archived(conn: &Connection, id: &str, archived: bool) -> Result<Session> {
    conn.execute(
        "UPDATE sessions SET archived = ?1 WHERE id = ?2",
        params![archived as i64, id],
    )?;
    list_sessions(conn)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn duplicate_session(conn: &Connection, id: &str) -> Result<Session, String> {
    let source = conn
        .query_row(
            "SELECT id, project_id, title, model, created_at FROM sessions WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("session not found: {id}"))?;
    let new_id = uid();
    let now = now_millis();
    let title = format!("{} (copy)", source.2);
    conn.execute(
        "INSERT INTO sessions (id, project_id, title, model, pinned, created_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![new_id, source.1, title, source.3, now],
    )
    .map_err(|e| e.to_string())?;
    let messages: Vec<(String, String, i64)> = {
        let mut stmt = conn
            .prepare(
                "SELECT role, content, created_at FROM chat_messages
                 WHERE session_id = ?1 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        out
    };
    for (role, content, created_at) in &messages {
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![uid(), new_id, role, content, created_at],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(Session {
        id: new_id,
        project_id: source.1,
        title,
        model: source.3,
        pinned: false,
        archived: false,
        message_count: messages.len() as i64,
        created_at: now,
    })
}

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn save_chat_message(
    conn: &Connection,
    session_id: &str,
    role: &str,
    content: &str,
    id: Option<String>,
) -> Result<ChatMessage> {
    let id = id.unwrap_or_else(uid);
    let now = now_millis();
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, session_id, role, content, now],
    )?;
    Ok(ChatMessage {
        id,
        session_id: session_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        created_at: now,
    })
}

pub fn list_chat_messages(conn: &Connection, session_id: &str) -> Result<Vec<ChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, created_at FROM chat_messages
         WHERE session_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(ChatMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn update_chat_message(conn: &Connection, id: &str, content: &str) -> Result<()> {
    let old: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT m.content, v.id FROM chat_messages m
             LEFT JOIN message_versions v ON v.message_id = m.id
             WHERE m.id = ?1 ORDER BY v.created_at DESC LIMIT 1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((old_content, parent)) = old {
        save_message_version(conn, id, &old_content, parent.as_deref())?;
    }
    conn.execute(
        "UPDATE chat_messages SET content = ?1 WHERE id = ?2",
        params![content, id],
    )?;
    Ok(())
}

pub fn save_message_version(
    conn: &Connection,
    message_id: &str,
    content: &str,
    parent_version_id: Option<&str>,
) -> Result<MessageVersion> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO message_versions (id, message_id, content, created_at, parent_version_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, message_id, content, now, parent_version_id],
    )?;
    Ok(MessageVersion {
        id,
        message_id: message_id.to_string(),
        content: content.to_string(),
        created_at: now,
        parent_version_id: parent_version_id.map(|p| p.to_string()),
    })
}

pub fn list_message_versions(conn: &Connection, message_id: &str) -> Result<Vec<MessageVersion>> {
    let mut stmt = conn.prepare(
        "SELECT id, message_id, content, created_at, parent_version_id FROM message_versions
         WHERE message_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![message_id], |row| {
        Ok(MessageVersion {
            id: row.get(0)?,
            message_id: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
            parent_version_id: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn restore_message_version(
    conn: &Connection,
    message_id: &str,
    version_id: &str,
) -> Result<String> {
    let content: Option<String> = conn
        .query_row(
            "SELECT content FROM message_versions WHERE id = ?1 AND message_id = ?2",
            params![version_id, message_id],
            |row| row.get(0),
        )
        .optional()?;
    let content = content.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
    update_chat_message(conn, message_id, &content)?;
    Ok(content)
}

pub fn diff_message_version_with_current(
    conn: &Connection,
    message_id: &str,
    version_id: &str,
) -> Result<MessageDiff> {
    let version_content: Option<String> = conn
        .query_row(
            "SELECT content FROM message_versions WHERE id = ?1 AND message_id = ?2",
            params![version_id, message_id],
            |row| row.get(0),
        )
        .optional()?;
    let current_content: Option<String> = conn
        .query_row(
            "SELECT content FROM chat_messages WHERE id = ?1",
            params![message_id],
            |row| row.get(0),
        )
        .optional()?;
    let version = version_content.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
    let current = current_content.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
    Ok(line_diff(&version, &current))
}

fn line_diff(a: &str, b: &str) -> MessageDiff {
    let diff = similar::TextDiff::from_lines(a, b);
    let mut added = Vec::new();
    let mut removed = Vec::new();
    for change in diff.iter_all_changes() {
        match change.tag() {
            similar::ChangeTag::Delete => removed.push(strip_line_ending(change.value())),
            similar::ChangeTag::Insert => added.push(strip_line_ending(change.value())),
            similar::ChangeTag::Equal => {}
        }
    }
    MessageDiff { added, removed }
}

fn strip_line_ending(value: &str) -> String {
    let trimmed = value.strip_suffix("\r\n").unwrap_or(value);
    let trimmed = trimmed.strip_suffix('\n').unwrap_or(trimmed);
    let trimmed = trimmed.strip_suffix('\r').unwrap_or(trimmed);
    trimmed.to_string()
}

pub fn truncate_chat_messages(
    conn: &Connection,
    session_id: &str,
    keep_message_id: &str,
) -> Result<()> {
    let keep_created_at: Option<i64> = conn.query_row(
        "SELECT created_at FROM chat_messages WHERE id = ?1 AND session_id = ?2",
        params![keep_message_id, session_id],
        |row| row.get(0),
    )?;
    if let Some(created_at) = keep_created_at {
        conn.execute(
            "DELETE FROM chat_messages
             WHERE session_id = ?1 AND created_at > ?2 AND id <> ?3",
            params![session_id, created_at, keep_message_id],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_and_persist_task() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let task = create_task(&conn, "Today task", true).unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let tasks = list_tasks(&conn).unwrap();
        let saved = tasks
            .iter()
            .find(|t| t.id == task.id)
            .expect("created task should be listed");
        assert_eq!(saved.title, "Today task");
        assert!(saved.is_today);
        update_task_status(&conn, &task.id, "done").unwrap();
        let updated = list_tasks(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == task.id)
            .expect("created task should persist after update");
        assert_eq!(updated.status, "done");
        assert!(updated.completed_at.is_some());
        set_task_due_date(&conn, &task.id, Some("2026-08-07")).unwrap();
        let dated = list_tasks(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == task.id)
            .expect("created task should persist after due date update");
        assert_eq!(dated.due_date.as_deref(), Some("2026-08-07"));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn task_completed_at_migration_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'todo',
                is_today INTEGER DEFAULT 0,
                due_date TEXT,
                created_at INTEGER
            );",
        )
        .unwrap();
        migrate_task_completed_at(&conn).unwrap();
        migrate_task_completed_at(&conn).unwrap();
        assert!(column_exists(&conn, "tasks", "completed_at").unwrap());
    }

    #[test]
    fn departments_and_agents_persist_with_counts() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        seed_agents_if_empty(&conn).unwrap();

        let departments = list_departments(&conn).unwrap();
        let design = departments
            .iter()
            .find(|d| d.name == "设计部")
            .expect("design department should be seeded");
        assert!(design.agent_count >= 3);

        let agents = list_agents(&conn).unwrap();
        assert!(agents
            .iter()
            .any(|a| a.department_id == design.id && a.name == "UI Designer"));

        let created = create_agent(
            &conn,
            &design.id,
            "New Designer",
            "Design QA",
            "openai",
            None,
            "Check visuals",
        )
        .unwrap();
        assert_eq!(created.department_name, "设计部");
        let after = list_departments(&conn)
            .unwrap()
            .into_iter()
            .find(|d| d.id == design.id)
            .expect("design department should still exist");
        assert_eq!(after.agent_count, design.agent_count + 1);
    }

    #[test]
    fn agent_system_prompt_updates_and_persists() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        seed_agents_if_empty(&conn).unwrap();

        let ui_designer = list_agents(&conn)
            .unwrap()
            .into_iter()
            .find(|a| a.name == "UI Designer")
            .expect("UI Designer should be seeded");
        assert!(!ui_designer.system_prompt.is_empty());

        let updated = update_agent_system_prompt(
            &conn,
            &ui_designer.id,
            "你是设计验收专家，先给验收清单再给结论。",
        )
        .unwrap();
        assert_eq!(
            updated.system_prompt,
            "你是设计验收专家，先给验收清单再给结论。"
        );

        let reloaded = get_agent(&conn, &ui_designer.id)
            .unwrap()
            .expect("agent should still exist");
        assert_eq!(reloaded.system_prompt, updated.system_prompt);
    }

    #[test]
    fn agent_prompt_versions_track_and_restore_history() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        seed_agents_if_empty(&conn).unwrap();

        let ui_designer = list_agents(&conn)
            .unwrap()
            .into_iter()
            .find(|a| a.name == "UI Designer")
            .expect("UI Designer should be seeded");
        let seed_prompt = ui_designer.system_prompt.clone();

        update_agent_system_prompt(&conn, &ui_designer.id, "v2 prompt").unwrap();
        update_agent_system_prompt(&conn, &ui_designer.id, "v3 prompt").unwrap();
        let versions = list_agent_prompt_versions(&conn, &ui_designer.id).unwrap();
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].content, seed_prompt);
        assert_eq!(versions[1].content, "v2 prompt");

        let restored = restore_agent_prompt(&conn, &ui_designer.id, &versions[0].id).unwrap();
        assert_eq!(restored.system_prompt, seed_prompt);
        let after = list_agent_prompt_versions(&conn, &ui_designer.id).unwrap();
        assert_eq!(after.len(), 3);
        assert_eq!(after[2].content, "v3 prompt");
    }

    #[test]
    fn chat_messages_persist_across_reopen() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-chat-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Sprint planning", "openai").unwrap();
        save_chat_message(&conn, &session.id, "user", "Hello", None).unwrap();
        save_chat_message(&conn, &session.id, "assistant", "Hi there", None).unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let messages = list_chat_messages(&conn, &session.id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].content, "Hi there");
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn session_rename_and_delete_cascade_messages() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-session-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Old title", "openai").unwrap();
        save_chat_message(&conn, &session.id, "user", "Hello", None).unwrap();

        rename_session(&conn, &session.id, "New title").unwrap();
        let sessions = list_sessions(&conn).unwrap();
        assert_eq!(sessions[0].title, "New title");

        delete_session(&conn, &session.id).unwrap();
        let sessions = list_sessions(&conn).unwrap();
        assert!(!sessions.iter().any(|s| s.id == session.id));
        assert!(list_chat_messages(&conn, &session.id).unwrap().is_empty());
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn session_pinned_migration_adds_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT,
                model TEXT,
                created_at INTEGER
            );",
        )
        .unwrap();
        migrate_session_pinned(&conn).unwrap();
        assert!(column_exists(&conn, "sessions", "pinned").unwrap());
        conn.execute(
            "INSERT INTO sessions (id, title, model, created_at) VALUES (?1, 'old', 'openai', 1)",
            params!["old-session"],
        )
        .unwrap();
        let pinned: i64 = conn
            .query_row(
                "SELECT pinned FROM sessions WHERE id = 'old-session'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pinned, 0);
    }

    #[test]
    fn session_archived_migration_adds_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT,
                model TEXT,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER
            );",
        )
        .unwrap();
        migrate_session_archived(&conn).unwrap();
        assert!(column_exists(&conn, "sessions", "archived").unwrap());
        conn.execute(
            "INSERT INTO sessions (id, title, model, created_at) VALUES (?1, 'old', 'openai', 1)",
            params!["old-session"],
        )
        .unwrap();
        let archived: i64 = conn
            .query_row(
                "SELECT archived FROM sessions WHERE id = 'old-session'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(archived, 0);
    }

    #[test]
    fn session_archive_round_trip_search_and_duplicate() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let first = create_session(&conn, "Archive me", "openai").unwrap();
        let _second = create_session(&conn, "Keep me", "ollama").unwrap();
        save_chat_message(&conn, &first.id, "user", "archive question", None).unwrap();

        let archived = set_session_archived(&conn, &first.id, true).unwrap();
        assert!(archived.archived);
        let sessions = list_sessions(&conn).unwrap();
        assert!(sessions.iter().any(|s| s.id == first.id && s.archived));
        assert!(search_sessions(&conn, "archive", None, None, None, true)
            .unwrap()
            .is_empty());

        let restored = set_session_archived(&conn, &first.id, false).unwrap();
        assert!(!restored.archived);
        let copy = duplicate_session(&conn, &first.id).unwrap();
        assert!(!copy.archived);
        let hits = search_sessions(&conn, "archive", None, None, None, true).unwrap();
        assert!(hits.iter().any(|h| h.session.id == first.id));

        assert!(set_session_archived(&conn, "missing", true).is_err());
        drop(conn);
    }

    #[test]
    fn session_pin_duplicate_orders_and_counts() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-session-workspace-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let first = create_session(&conn, "First", "openai").unwrap();
        let second = create_session(&conn, "Second", "ollama").unwrap();
        save_chat_message(&conn, &first.id, "user", "Hello", None).unwrap();
        save_chat_message(&conn, &first.id, "assistant", "Hi", None).unwrap();
        save_chat_message(&conn, &second.id, "user", "Ollama question", None).unwrap();

        let sessions = list_sessions(&conn).unwrap();
        assert_eq!(sessions[0].id, second.id);
        assert_eq!(sessions[0].message_count, 1);
        assert_eq!(sessions[1].message_count, 2);

        set_session_pinned(&conn, &first.id, true).unwrap();
        let sessions = list_sessions(&conn).unwrap();
        assert!(sessions[0].pinned);
        assert_eq!(sessions[0].id, first.id);

        let copy = duplicate_session(&conn, &first.id).unwrap();
        assert!(copy.title.ends_with("(copy)"));
        assert!(!copy.archived);
        assert_eq!(copy.message_count, 2);
        let messages = list_chat_messages(&conn, &copy.id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].content, "Hello");

        drop(conn);
        let conn = init_connection(&db_path).unwrap();
        let sessions = list_sessions(&conn).unwrap();
        let restored = sessions.iter().find(|s| s.id == first.id).unwrap();
        assert!(restored.pinned);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn session_search_matches_title_model_and_message_content() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let planning = create_session(&conn, "Sprint Planning", "openai").unwrap();
        let grocery = create_session(&conn, "Grocery list", "ollama").unwrap();
        let planning_message = save_chat_message(
            &conn,
            &planning.id,
            "user",
            "Can you review the RAG architecture?",
            None,
        )
        .unwrap();
        save_chat_message(&conn, &grocery.id, "user", "Add milk and eggs", None).unwrap();

        let title_hits = search_sessions(&conn, "planning", None, None, None, true).unwrap();
        assert_eq!(title_hits.len(), 1);
        assert_eq!(title_hits[0].session.id, planning.id);
        assert_eq!(title_hits[0].match_type, "title");
        assert!(title_hits[0].message_id.is_none());

        let model_hits = search_sessions(&conn, "ollama", None, None, None, true).unwrap();
        assert_eq!(model_hits.len(), 1);
        assert_eq!(model_hits[0].session.id, grocery.id);
        assert_eq!(model_hits[0].match_type, "model");

        let message_hits =
            search_sessions(&conn, "RAG architecture", None, None, None, true).unwrap();
        assert_eq!(message_hits.len(), 1);
        assert_eq!(message_hits[0].session.id, planning.id);
        assert_eq!(message_hits[0].match_type, "message");
        assert!(message_hits[0].snippet.contains("RAG architecture"));
        assert_eq!(
            message_hits[0].message_id.as_deref(),
            Some(planning_message.id.as_str())
        );

        let title_only =
            search_sessions(&conn, "RAG architecture", None, None, None, false).unwrap();
        assert!(title_only.is_empty());
    }

    #[test]
    fn session_search_fuzzy_subsequence_ranks_above_message_hits() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let planning = create_session(&conn, "Sprint Planning", "openai").unwrap();
        let generic = create_session(&conn, "General chat", "openai").unwrap();
        save_chat_message(
            &conn,
            &generic.id,
            "user",
            "Please prepare a sprint plan for next week",
            None,
        )
        .unwrap();

        let hits = search_sessions(&conn, "sprnt plan", None, None, None, true).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].session.id, planning.id);
        assert_eq!(hits[0].match_type, "title");
        assert!(hits[0].score > hits[1].score);
    }

    #[test]
    fn session_search_pinyin_full_and_initials_match_chinese() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let plan = create_session(&conn, "每日计划", "openai").unwrap();
        let message = save_chat_message(&conn, &plan.id, "user", "买牛奶和鸡蛋", None).unwrap();

        let by_initials = search_sessions(&conn, "mrjh", None, None, None, true).unwrap();
        assert_eq!(by_initials.len(), 1);
        assert_eq!(by_initials[0].session.id, plan.id);
        assert_eq!(by_initials[0].match_type, "pinyin-title");

        let by_full = search_sessions(&conn, "meirijihua", None, None, None, true).unwrap();
        assert_eq!(by_full.len(), 1);
        assert_eq!(by_full[0].session.id, plan.id);
        assert_eq!(by_full[0].match_type, "pinyin-title");

        let by_message = search_sessions(&conn, "mnhjd", None, None, None, true).unwrap();
        assert_eq!(by_message.len(), 1);
        assert_eq!(by_message[0].session.id, plan.id);
        assert_eq!(by_message[0].match_type, "pinyin-message");
        assert_eq!(
            by_message[0].message_id.as_deref(),
            Some(message.id.as_str())
        );

        let by_chinese = search_sessions(&conn, "计划", None, None, None, true).unwrap();
        assert_eq!(by_chinese.len(), 1);
        assert_eq!(by_chinese[0].match_type, "title");
    }

    #[test]
    fn session_search_filters_by_time_range_and_limit() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let old = create_session(&conn, "Old planning", "openai").unwrap();
        let recent = create_session(&conn, "Recent planning", "openai").unwrap();
        conn.execute(
            "UPDATE sessions SET created_at = ?1 WHERE id = ?2",
            params![1_000i64, old.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE sessions SET created_at = ?1 WHERE id = ?2",
            params![2_000i64, recent.id],
        )
        .unwrap();

        let hits = search_sessions(&conn, "planning", Some(1_500), None, None, true).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].session.id, recent.id);

        let limited = search_sessions(&conn, "planning", None, None, Some(1), true).unwrap();
        assert_eq!(limited.len(), 1);
    }

    #[test]
    fn chat_message_edit_and_truncate_tail() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-message-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Edit test", "openai").unwrap();
        let user = save_chat_message(&conn, &session.id, "user", "Old question", None).unwrap();
        let first = save_chat_message(&conn, &session.id, "assistant", "Old answer", None).unwrap();
        let tail =
            save_chat_message(&conn, &session.id, "assistant", "Should be removed", None).unwrap();

        update_chat_message(&conn, &user.id, "New question").unwrap();
        truncate_chat_messages(&conn, &session.id, &user.id).unwrap();

        let messages = list_chat_messages(&conn, &session.id).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "New question");
        assert!(!messages.iter().any(|m| m.id == first.id || m.id == tail.id));
        let versions = list_message_versions(&conn, &user.id).unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].content, "Old question");
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn message_versions_persist_and_restore() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-version-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Version test", "openai").unwrap();
        let user = save_chat_message(&conn, &session.id, "user", "v1 original", None).unwrap();
        let assistant =
            save_chat_message(&conn, &session.id, "assistant", "old answer", None).unwrap();
        save_message_version(&conn, &assistant.id, "old answer", None).unwrap();
        update_chat_message(&conn, &user.id, "v2 edited").unwrap();
        update_chat_message(&conn, &user.id, "v3 edited again").unwrap();

        let versions = list_message_versions(&conn, &user.id).unwrap();
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].content, "v1 original");
        assert_eq!(versions[1].content, "v2 edited");
        assert!(versions[0].parent_version_id.is_none());
        assert_eq!(
            versions[1].parent_version_id.as_deref(),
            Some(versions[0].id.as_str())
        );
        let assistant_versions = list_message_versions(&conn, &assistant.id).unwrap();
        assert_eq!(assistant_versions.len(), 1);
        assert_eq!(assistant_versions[0].content, "old answer");

        let restored = restore_message_version(&conn, &user.id, &versions[0].id).unwrap();
        assert_eq!(restored, "v1 original");
        assert_eq!(
            list_chat_messages(&conn, &session.id).unwrap()[0].content,
            "v1 original"
        );
        assert_eq!(list_message_versions(&conn, &user.id).unwrap().len(), 3);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn message_version_diff_with_current_reports_added_and_removed_lines() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-diff-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Diff test", "openai").unwrap();
        let user = save_chat_message(&conn, &session.id, "user", "current", None).unwrap();
        save_message_version(&conn, &user.id, "alpha\nbeta\nold line", None).unwrap();
        save_message_version(&conn, &user.id, "alpha\nbeta\nnew line", None).unwrap();
        update_chat_message(&conn, &user.id, "alpha\nbeta\nnew line").unwrap();

        let versions = list_message_versions(&conn, &user.id).unwrap();
        assert_eq!(versions.len(), 3);
        assert_eq!(versions[0].content, "alpha\nbeta\nold line");
        assert_eq!(versions[1].content, "alpha\nbeta\nnew line");
        let diff = diff_message_version_with_current(&conn, &user.id, &versions[0].id).unwrap();
        assert_eq!(diff.removed, vec!["old line"]);
        assert_eq!(diff.added, vec!["new line"]);

        let same = diff_message_version_with_current(&conn, &user.id, &versions[1].id).unwrap();
        assert!(same.added.is_empty());
        assert!(same.removed.is_empty());
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn project_status_and_revenue_update_persist() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-update-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let project = create_project(&conn, "Side Project", "").unwrap();
        let updated = update_project(&conn, &project.id, "paused", 1234.56).unwrap();
        assert_eq!(updated.status, "paused");
        assert_eq!(updated.revenue, 1234.56);
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let saved = list_projects(&conn)
            .unwrap()
            .into_iter()
            .find(|p| p.id == project.id)
            .expect("updated project should be listed");
        assert_eq!(saved.status, "paused");
        assert_eq!(saved.revenue, 1234.56);

        let clamped = update_project(&conn, &project.id, "active", -5.0).unwrap();
        assert_eq!(clamped.status, "active");
        assert_eq!(clamped.revenue, 0.0);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn project_revenue_history_records_and_limits_points() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-revenue-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let project = create_project(&conn, "Trend Project", "").unwrap();
        update_project(&conn, &project.id, "active", 100.0).unwrap();
        update_project(&conn, &project.id, "active", 250.0).unwrap();
        update_project(&conn, &project.id, "paused", 400.0).unwrap();

        let all = list_project_revenue_history(&conn, &project.id, 100).unwrap();
        assert_eq!(all.len(), 4);
        assert_eq!(all.first().unwrap().revenue, 0.0);
        assert_eq!(all.last().unwrap().revenue, 400.0);

        let limited = list_project_revenue_history(&conn, &project.id, 2).unwrap();
        assert_eq!(limited.len(), 2);
        assert_eq!(limited.first().unwrap().revenue, 250.0);
        assert_eq!(limited.last().unwrap().revenue, 400.0);

        delete_project(&conn, &project.id).unwrap();
        assert!(list_project_revenue_history(&conn, &project.id, 100)
            .unwrap()
            .is_empty());
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        assert!(list_project_revenue_history(&conn, &project.id, 100)
            .unwrap()
            .is_empty());
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn project_delete_unlinks_sessions_and_persists() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-delete-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let project = create_project(&conn, "Disposable Project", "").unwrap();
        let session = create_session(&conn, "Project chat", "openai").unwrap();
        conn.execute(
            "UPDATE sessions SET project_id = ?1 WHERE id = ?2",
            params![project.id, session.id],
        )
        .unwrap();

        delete_project(&conn, &project.id).unwrap();
        assert!(list_projects(&conn)
            .unwrap()
            .iter()
            .all(|p| p.id != project.id));
        let sessions = list_sessions(&conn).unwrap();
        let session = sessions.iter().find(|s| s.id == session.id).unwrap();
        assert!(session.project_id.is_none());

        assert!(matches!(
            delete_project(&conn, "missing-project"),
            Err(rusqlite::Error::QueryReturnedNoRows)
        ));
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        assert!(list_projects(&conn)
            .unwrap()
            .iter()
            .all(|p| p.id != project.id));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn thought_tags_update_persist() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-thought-tags-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let thought = create_thought(&conn, "daily note", "#work", "note").unwrap();
        let updated = update_thought_tags(&conn, &thought.id, "#work,#life").unwrap();
        assert_eq!(updated.tags, "#work,#life");
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let saved = list_thoughts(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == thought.id)
            .expect("updated thought should be listed");
        assert_eq!(saved.tags, "#work,#life");

        let missing = update_thought_tags(&conn, "missing-thought", "#life");
        assert!(matches!(missing, Err(rusqlite::Error::QueryReturnedNoRows)));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn thought_body_update_persists_and_missing_id_errors() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-thought-body-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let thought = create_thought(&conn, "old markdown body", "#work", "note").unwrap();
        let updated =
            update_thought_content(&conn, &thought.id, "# New body\n\nupdated content").unwrap();
        assert_eq!(updated.content, "# New body\n\nupdated content");
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let saved = list_thoughts(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == thought.id)
            .expect("updated thought should be listed");
        assert_eq!(saved.content, "# New body\n\nupdated content");

        let missing = update_thought_content(&conn, "missing-thought", "nope");
        assert!(matches!(missing, Err(rusqlite::Error::QueryReturnedNoRows)));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn thought_type_update_persists_and_missing_id_errors() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-thought-type-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let thought = create_thought(&conn, "convert me", "#work", "inbox").unwrap();
        let updated = update_thought_type(&conn, &thought.id, "doc").unwrap();
        assert_eq!(updated.kind, "doc");
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let saved = list_thoughts(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == thought.id)
            .expect("updated thought should be listed");
        assert_eq!(saved.kind, "doc");

        let missing = update_thought_type(&conn, "missing-thought", "note");
        assert!(matches!(missing, Err(rusqlite::Error::QueryReturnedNoRows)));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn thought_delete_removes_row_and_missing_id_errors() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-thought-delete-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let thought = create_thought(&conn, "delete me", "#work", "inbox").unwrap();
        delete_thought(&conn, &thought.id).unwrap();
        assert!(list_thoughts(&conn)
            .unwrap()
            .iter()
            .all(|t| t.id != thought.id));

        let missing = delete_thought(&conn, &thought.id);
        assert!(matches!(missing, Err(rusqlite::Error::QueryReturnedNoRows)));
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        assert!(list_thoughts(&conn)
            .unwrap()
            .iter()
            .all(|t| t.id != thought.id));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn habit_week_goal_edit_and_delete_persist() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-habit-manage-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let habit = create_habit(&conn, "Deep work", 3, "blue").unwrap();
        toggle_habit(&conn, &habit.id).unwrap();
        let updated = update_habit_week_goal(&conn, &habit.id, 7).unwrap();
        assert_eq!(updated.week_goal, 7);
        let clamped = update_habit_week_goal(&conn, &habit.id, 99).unwrap();
        assert_eq!(clamped.week_goal, 31);
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let saved = list_habits(&conn)
            .unwrap()
            .into_iter()
            .find(|h| h.id == habit.id)
            .expect("updated habit should be listed");
        assert_eq!(saved.week_goal, 31);

        let deleted = delete_habit(&conn, &habit.id).unwrap();
        assert!(deleted);
        let logs: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM habit_logs WHERE habit_id = ?1",
                params![habit.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(logs, 0);
        assert!(!list_habits(&conn).unwrap().iter().any(|h| h.id == habit.id));
        assert!(!delete_habit(&conn, &habit.id).unwrap());
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn habits_and_schedule_persist_across_reopen() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-habit-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let habit = create_habit(&conn, "早睡", 5, "emerald").unwrap();
        assert!(!habit.done_today);
        let toggled = toggle_habit(&conn, &habit.id).unwrap();
        assert!(toggled.done_today);
        let event =
            create_schedule_event(&conn, "发布 Sprint 3", "20:00", "2026-08-10", "work").unwrap();
        assert!(!event.done);
        assert_eq!(event.date, "2026-08-10");
        toggle_event_done(&conn, &event.id).unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let habits = list_habits(&conn).unwrap();
        let saved_habit = habits
            .iter()
            .find(|h| h.id == habit.id)
            .expect("created habit should be listed");
        assert!(saved_habit.done_today);
        assert_eq!(saved_habit.name, "早睡");
        assert_eq!(saved_habit.current_streak, 1);
        assert!(saved_habit.recent_logs.iter().any(|d| d == &today_local()));

        let events = list_schedule_events(&conn).unwrap();
        let saved_event = events
            .iter()
            .find(|e| e.id == event.id)
            .expect("created event should be listed");
        assert!(saved_event.done);
        assert_eq!(saved_event.start_time, "20:00");
        assert_eq!(saved_event.date, "2026-08-10");

        let untoggled = toggle_habit(&conn, &habit.id).unwrap();
        assert!(!untoggled.done_today);
        assert_eq!(untoggled.current_streak, 0);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn schedule_event_date_migration_adds_column_and_orders() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schedule_events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                done INTEGER DEFAULT 0,
                tag TEXT DEFAULT 'general',
                created_at INTEGER
            );",
        )
        .unwrap();
        migrate_schedule_event_date(&conn).unwrap();
        migrate_schedule_event_date(&conn).unwrap();
        assert!(column_exists(&conn, "schedule_events", "date").unwrap());
        conn.execute(
            "INSERT INTO schedule_events (id, title, start_time, date, done, tag, created_at)
             VALUES ('a', 'A', '10:00', '2026-08-11', 0, 'work', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO schedule_events (id, title, start_time, date, done, tag, created_at)
             VALUES ('b', 'B', '09:00', '2026-08-10', 0, 'work', 2)",
            [],
        )
        .unwrap();
        let events = list_schedule_events(&conn).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].id, "b");
        assert_eq!(events[0].date, "2026-08-10");
        assert_eq!(events[1].id, "a");
        assert_eq!(events[1].date, "2026-08-11");
    }

    #[test]
    fn seeded_habits_have_log_backed_streaks() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-habit-seed-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let habits = list_habits(&conn).unwrap();
        assert_eq!(habits.len(), 3);
        let reading = habits.iter().find(|h| h.name == "晨间阅读").unwrap();
        let deep_work = habits.iter().find(|h| h.name == "深水工作").unwrap();
        let exercise = habits.iter().find(|h| h.name == "运动 30 分钟").unwrap();
        assert_eq!(reading.current_streak, 3);
        assert_eq!(deep_work.current_streak, 2);
        assert_eq!(exercise.current_streak, 5);
        assert!(!reading.done_today);
        assert!(!reading.recent_logs.is_empty());
        assert!(!deep_work.recent_logs.is_empty());
        assert!(!exercise.recent_logs.is_empty());

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn habit_streak_math_counts_consecutive_days() {
        let now = chrono::Local::now();
        let today = now.format("%Y-%m-%d").to_string();
        let yesterday = (now - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();
        let two_days_ago = (now - chrono::Duration::days(2))
            .format("%Y-%m-%d")
            .to_string();

        let ending_yesterday = vec![two_days_ago.clone(), yesterday.clone()];
        assert_eq!(compute_habit_streak(&ending_yesterday, &today), 2);

        let ending_today = vec![two_days_ago.clone(), yesterday, today.clone()];
        assert_eq!(compute_habit_streak(&ending_today, &today), 3);

        let with_gap = vec![two_days_ago, today.clone()];
        assert_eq!(compute_habit_streak(&with_gap, &today), 1);
    }

    #[test]
    fn clipboard_and_errors_persist_across_reopen() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-system-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let item = capture_clipboard(&conn, "Sprint 4 clipboard", "test").unwrap();
        assert!(capture_clipboard(&conn, "Sprint 4 clipboard", "test").is_err());
        let log = report_frontend_error(
            &conn,
            "frontend",
            "boom",
            Some("at line 1"),
            "error",
            "device-local",
        )
        .unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let items = list_clipboard(&conn).unwrap();
        assert!(items.iter().any(|i| i.id == item.id));
        let logs = list_error_logs(&conn).unwrap();
        assert!(logs.iter().any(|l| l.id == log.id));
        assert_eq!(
            logs.iter().find(|l| l.id == log.id).unwrap().device_id,
            "device-local"
        );
        assert_eq!(
            logs.iter().find(|l| l.id == log.id).unwrap().message,
            "boom"
        );
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_snapshot_merges_clipboard_and_logs_between_devices() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let device_a = dir.join("device-a.db");
        let device_b = dir.join("device-b.db");
        let snapshot_path = dir.join("sync-snapshot.json");

        let conn_a = init_connection(&device_a).unwrap();
        capture_clipboard(&conn_a, "from device A", "test").unwrap();
        report_frontend_error(&conn_a, "a", "log from A", None, "info", "device-a").unwrap();
        export_sync_snapshot(&conn_a, &snapshot_path).unwrap();

        let conn_b = init_connection(&device_b).unwrap();
        capture_clipboard(&conn_b, "from device B", "test").unwrap();
        report_frontend_error(&conn_b, "b", "log from B", None, "error", "device-b").unwrap();

        let result = import_sync_snapshot(&conn_b, &snapshot_path).unwrap();
        assert!(result.clipboard_added >= 1);
        assert!(result.logs_added >= 1);
        let clips = list_clipboard(&conn_b).unwrap();
        assert!(clips.iter().any(|c| c.content == "from device A"));
        assert!(clips.iter().any(|c| c.content == "from device B"));
        let logs = list_error_logs(&conn_b).unwrap();
        assert!(logs.iter().any(|l| l.message == "log from A"));
        assert!(logs.iter().any(|l| l.message == "log from B"));
        assert!(logs
            .iter()
            .any(|l| l.message == "log from A" && l.device_id == "device-a"));
        assert!(logs
            .iter()
            .any(|l| l.message == "log from B" && l.device_id == "device-b"));
        drop(conn_a);
        drop(conn_b);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_snapshot_conflicts_track_direction() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-conflict-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "local content", "test").unwrap();
        let local_updated = clip.updated_at;

        let remote_newer = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 1,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote content".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 1000,
                updated_at: local_updated + 1000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let first = merge_sync_snapshot(&conn, remote_newer).unwrap();
        assert_eq!(first.clipboard_updated, 1);
        assert_eq!(first.conflicts.len(), 1);
        assert_eq!(first.conflicts[0].resolved_to, "remote");
        assert_eq!(first.conflicts[0].local_updated_at, local_updated);
        assert_eq!(first.conflicts[0].remote_updated_at, local_updated + 1000);
        assert_eq!(first.conflicts[0].preview, "remote content");

        let remote_stale = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 2,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "stale remote".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 500,
                updated_at: local_updated + 500,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let second = merge_sync_snapshot(&conn, remote_stale).unwrap();
        assert_eq!(second.clipboard_updated, 0);
        assert_eq!(second.conflicts.len(), 1);
        assert_eq!(second.conflicts[0].resolved_to, "local");

        let remote_equal = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 3,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "equal timestamp".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 1000,
                updated_at: local_updated + 1000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let third = merge_sync_snapshot(&conn, remote_equal).unwrap();
        assert_eq!(third.conflicts.len(), 0);
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_quick_prompt_conflict_restores_chosen_side() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-quick-resolve-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        upsert_quick_prompt(
            &conn,
            &QuickPrompt {
                id: "custom-conflict".to_string(),
                label: "Local prompt".to_string(),
                category: "work".to_string(),
                text: "local text".to_string(),
                custom: true,
                sort_order: 0,
                updated_at: 1000,
                created_at: 500,
            },
        )
        .unwrap();
        let remote = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 3000,
            clipboard: Vec::new(),
            logs: Vec::new(),
            quick_prompts: vec![QuickPrompt {
                id: "custom-conflict".to_string(),
                label: "Remote prompt".to_string(),
                category: "life".to_string(),
                text: "remote text".to_string(),
                custom: true,
                sort_order: 1,
                updated_at: 2000,
                created_at: 500,
            }],
            quick_prompt_usage: Vec::new(),
        };
        let merged = merge_sync_snapshot(&conn, remote).unwrap();
        assert_eq!(merged.quick_prompts_updated, 1);
        assert_eq!(merged.conflicts.len(), 1);
        assert_eq!(merged.conflicts[0].kind, "quick_prompt");
        let conflict = merged.conflicts[0].clone();
        let parsed: QuickPrompt = serde_json::from_str(&conflict.remote_content).unwrap();
        assert_eq!(parsed.label, "Remote prompt");

        resolve_conflict(&conn, &conflict, "remote").unwrap();
        let prompts = list_quick_prompts(&conn).unwrap();
        let prompt = prompts.iter().find(|p| p.id == "custom-conflict").unwrap();
        assert_eq!(prompt.label, "Remote prompt");
        assert_eq!(prompt.category, "life");
        assert!(prompt.updated_at >= 2000);
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn quick_prompt_edit_and_reorder_persist() {
        let dir = std::env::temp_dir().join(format!("aiwb-quick-edit-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        for (id, label, order) in [
            ("custom-a", "Alpha", 0),
            ("custom-b", "Beta", 1),
            ("builtin-x", "Builtin", 2),
        ] {
            upsert_quick_prompt(
                &conn,
                &QuickPrompt {
                    id: id.to_string(),
                    label: label.to_string(),
                    category: "work".to_string(),
                    text: format!("{label} text"),
                    custom: id.starts_with("custom"),
                    sort_order: order,
                    updated_at: 1000,
                    created_at: 500,
                },
            )
            .unwrap();
        }

        let updated =
            update_custom_quick_prompt(&conn, "custom-a", "Alpha edited", "life", "new text")
                .unwrap();
        assert_eq!(updated.label, "Alpha edited");
        assert_eq!(updated.category, "life");
        assert_eq!(updated.text, "new text");
        assert!(updated.updated_at > 1000);
        assert!(update_custom_quick_prompt(&conn, "builtin-x", "x", "work", "x").is_err());

        reorder_custom_quick_prompts(&conn, &["custom-b".to_string(), "custom-a".to_string()])
            .unwrap();
        let prompts = list_quick_prompts(&conn).unwrap();
        let alpha = prompts.iter().find(|p| p.id == "custom-a").unwrap();
        let beta = prompts.iter().find(|p| p.id == "custom-b").unwrap();
        assert_eq!(alpha.sort_order, 1);
        assert_eq!(beta.sort_order, 0);
        assert_eq!(
            prompts
                .iter()
                .find(|p| p.id == "builtin-x")
                .unwrap()
                .sort_order,
            2
        );
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_conflict_restores_chosen_side() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-resolve-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "local content", "test").unwrap();
        let local_updated = clip.updated_at;
        let remote = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 1,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote content".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 1000,
                updated_at: local_updated + 1000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let merged = merge_sync_snapshot(&conn, remote).unwrap();
        let conflict = merged.conflicts[0].clone();
        assert_eq!(conflict.local_content, "local content");
        assert_eq!(conflict.remote_content, "remote content");

        resolve_conflict(&conn, &conflict, "local").unwrap();
        let clips = list_clipboard(&conn).unwrap();
        assert_eq!(clips[0].content, "local content");

        let err = resolve_conflict(&conn, &conflict, "sideways").unwrap_err();
        assert!(err.contains("Unsupported conflict choice"), "{}", err);

        resolve_conflict(&conn, &conflict, "remote").unwrap();
        let clips = list_clipboard(&conn).unwrap();
        assert_eq!(clips[0].content, "remote content");
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_conflicts_batch_writes_both_sides() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-batch-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "local clip", "test").unwrap();
        let log = report_frontend_error(&conn, "test", "local log", None, "error", "device-local")
            .unwrap();
        let clip_updated = clip.updated_at;
        let log_updated = log.updated_at;
        let remote = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 1,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote clip".to_string(),
                source: "remote".to_string(),
                timestamp: clip_updated + 1000,
                updated_at: clip_updated + 1000,
            }],
            logs: vec![ErrorLog {
                id: log.id.clone(),
                source: "remote".to_string(),
                message: "remote log".to_string(),
                stack: None,
                severity: "error".to_string(),
                timestamp: log_updated + 1000,
                updated_at: log_updated + 1000,
                device_id: "device-remote".to_string(),
            }],
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let merged = merge_sync_snapshot(&conn, remote).unwrap();
        assert_eq!(merged.conflicts.len(), 2);

        let resolved = resolve_conflicts(&conn, &merged.conflicts, "local").unwrap();
        assert_eq!(resolved, 2);
        let clips = list_clipboard(&conn).unwrap();
        assert_eq!(clips[0].content, "local clip");
        let logs = list_error_logs(&conn).unwrap();
        assert_eq!(logs[0].message, "local log");
        assert!(list_sync_conflicts(&conn, "unresolved").unwrap().is_empty());
        assert_eq!(list_sync_conflicts(&conn, "resolved").unwrap().len(), 2);

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn union_merge_content_keeps_order_and_dedupes() {
        assert_eq!(union_merge_content("a\nb\nc", "b\nc\nd"), "a\nb\nc\nd");
        assert_eq!(union_merge_content("", "x"), "x");
        assert_eq!(union_merge_content("x", ""), "x");
    }

    #[test]
    fn structured_merge_content_merges_json_fields_and_arrays() {
        let merged = structured_merge_content(
            r#"{"title":"Workbench","tags":["work"],"meta":{"count":1}}"#,
            r#"{"title":"Workbench","tags":["work","life"],"meta":{"count":2,"done":true}}"#,
            false,
        );
        let value: Value = serde_json::from_str(&merged).unwrap();
        assert_eq!(value["title"], "Workbench");
        assert_eq!(value["tags"], serde_json::json!(["work", "life"]));
        assert_eq!(value["meta"]["count"], 2);
        assert_eq!(value["meta"]["done"], true);
    }

    #[test]
    fn structured_merge_content_dedupes_object_arrays_by_key() {
        let merged = structured_merge_content(
            r#"{"items":[{"id":1,"label":"a"}]}"#,
            r#"{"items":[{"label":"a","id":1},{"id":2,"label":"b"}]}"#,
            true,
        );
        let value: Value = serde_json::from_str(&merged).unwrap();
        assert_eq!(value["items"].as_array().unwrap().len(), 2);
        assert_eq!(value["items"][0]["id"], 1);
        assert_eq!(value["items"][1]["id"], 2);
    }

    #[test]
    fn structured_merge_content_merges_markdown_frontmatter() {
        let local = "---\ntitle: Sprint 55\ntags: work\n---\n\nLocal body\nline two";
        let remote = "---\ntitle: Sprint 55\ntags: work, life\n---\n\nRemote body\nline two";
        let merged = structured_merge_content(local, remote, true);
        assert!(merged.contains("title: Sprint 55"));
        assert!(merged.contains("tags: work, life"));
        assert!(merged.contains("Local body"));
        assert!(merged.contains("Remote body"));
    }

    #[test]
    fn structured_merge_content_falls_back_to_line_union() {
        assert_eq!(
            structured_merge_content("alpha\nbeta", "beta\ngamma", true),
            "alpha\nbeta\ngamma"
        );
    }

    #[test]
    fn resolve_conflict_union_merges_both_sides() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-union-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "alpha\nbeta\ngamma", "test").unwrap();
        let conflict = SyncConflictItem {
            id: clip.id.clone(),
            kind: "clipboard".to_string(),
            local_updated_at: 1,
            remote_updated_at: 2,
            resolved_to: "union".to_string(),
            preview: "conflict".to_string(),
            local_content: "alpha\nbeta".to_string(),
            remote_content: "beta\ngamma\ndelta".to_string(),
        };
        persist_conflict(&conn, &conflict).unwrap();

        let merged = resolve_conflict_union(&conn, &conflict).unwrap();
        assert_eq!(merged, "alpha\nbeta\ngamma\ndelta");
        let clips = list_clipboard(&conn).unwrap();
        assert_eq!(clips[0].content, merged);
        let records = list_sync_conflicts(&conn, "resolved").unwrap();
        assert_eq!(records[0].resolved_choice.as_deref(), Some("union"));
        let audit = list_sync_audit(&conn, 10, Some("sync.resolve.union"), None, None).unwrap();
        assert_eq!(audit.len(), 1);
        assert!(audit[0].detail.contains("-> union"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_conflict_structured_merges_json_content() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-structured-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "plain", "test").unwrap();
        let conflict = SyncConflictItem {
            id: clip.id.clone(),
            kind: "clipboard".to_string(),
            local_updated_at: 1,
            remote_updated_at: 2,
            resolved_to: "structured".to_string(),
            preview: "structured conflict".to_string(),
            local_content: r#"{"title":"A","tags":["x"]}"#.to_string(),
            remote_content: r#"{"title":"A","tags":["x","y"],"done":true}"#.to_string(),
        };
        persist_conflict(&conn, &conflict).unwrap();

        let merged = resolve_conflict_structured(&conn, &conflict).unwrap();
        assert!(merged.contains("\"done\": true"));
        assert!(merged.contains("\"y\""));
        let clips = list_clipboard(&conn).unwrap();
        assert_eq!(clips[0].content, merged);
        let records = list_sync_conflicts(&conn, "resolved").unwrap();
        assert_eq!(records[0].resolved_choice.as_deref(), Some("structured"));
        let audit =
            list_sync_audit(&conn, 10, Some("sync.resolve.structured"), None, None).unwrap();
        assert_eq!(audit.len(), 1);
        assert!(audit[0].detail.contains("-> structured"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_conflicts_structured_batch_resolves_all() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-structured-batch-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip_a = capture_clipboard(&conn, "plain a", "test").unwrap();
        let clip_b = capture_clipboard(&conn, "plain b", "test").unwrap();
        let conflicts = vec![
            SyncConflictItem {
                id: clip_a.id.clone(),
                kind: "clipboard".to_string(),
                local_updated_at: 1,
                remote_updated_at: 2,
                resolved_to: "structured".to_string(),
                preview: "structured a".to_string(),
                local_content: r#"{"a":1}"#.to_string(),
                remote_content: r#"{"a":1,"b":2}"#.to_string(),
            },
            SyncConflictItem {
                id: clip_b.id.clone(),
                kind: "clipboard".to_string(),
                local_updated_at: 1,
                remote_updated_at: 2,
                resolved_to: "structured".to_string(),
                preview: "structured b".to_string(),
                local_content: r#"{"x":1}"#.to_string(),
                remote_content: r#"{"y":2}"#.to_string(),
            },
        ];
        for conflict in &conflicts {
            persist_conflict(&conn, conflict).unwrap();
        }

        let resolved = resolve_conflicts_structured(&conn, &conflicts).unwrap();
        assert_eq!(resolved, 2);
        let records = list_sync_conflicts(&conn, "resolved").unwrap();
        assert_eq!(records.len(), 2);
        assert!(records
            .iter()
            .all(|r| r.resolved_choice.as_deref() == Some("structured")));
        let audit =
            list_sync_audit(&conn, 10, Some("sync.resolve.structured.batch"), None, None).unwrap();
        assert_eq!(audit.len(), 1);
        assert!(audit[0].detail.contains("batch merged 2"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_conflicts_union_batch_resolves_all() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-union-batch-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip_a = capture_clipboard(&conn, "a1\na2", "test").unwrap();
        let clip_b = capture_clipboard(&conn, "b1\nb2", "test").unwrap();
        let conflicts = vec![
            SyncConflictItem {
                id: clip_a.id.clone(),
                kind: "clipboard".to_string(),
                local_updated_at: 1,
                remote_updated_at: 2,
                resolved_to: "union".to_string(),
                preview: "conflict a".to_string(),
                local_content: "a1".to_string(),
                remote_content: "a2".to_string(),
            },
            SyncConflictItem {
                id: clip_b.id.clone(),
                kind: "clipboard".to_string(),
                local_updated_at: 1,
                remote_updated_at: 2,
                resolved_to: "union".to_string(),
                preview: "conflict b".to_string(),
                local_content: "b1".to_string(),
                remote_content: "b2".to_string(),
            },
        ];
        for conflict in &conflicts {
            persist_conflict(&conn, conflict).unwrap();
        }

        let resolved = resolve_conflicts_union(&conn, &conflicts).unwrap();
        assert_eq!(resolved, 2);
        assert!(list_sync_conflicts(&conn, "unresolved").unwrap().is_empty());
        let records = list_sync_conflicts(&conn, "resolved").unwrap();
        assert_eq!(records.len(), 2);
        assert!(records
            .iter()
            .all(|r| r.resolved_choice.as_deref() == Some("union")));
        let audit =
            list_sync_audit(&conn, 10, Some("sync.resolve.union.batch"), None, None).unwrap();
        assert_eq!(audit.len(), 1);
        assert!(audit[0].detail.contains("batch merged 2"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_audit_tracks_merge_resolve_and_clear() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-audit-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "local v1", "test").unwrap();
        let local_updated = clip.updated_at;
        let remote = SyncSnapshot {
            device_id: "device-audit".to_string(),
            exported_at: 1,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote v1".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 1000,
                updated_at: local_updated + 1000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };

        merge_sync_snapshot(&conn, remote).unwrap();
        let entries = list_sync_audit(&conn, 20, None, None, None).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].event, "sync.merge");
        assert_eq!(entries[0].device_id, "device-audit");
        assert!(entries[0].detail.contains("conflicts 1"));

        let unresolved = list_sync_conflicts(&conn, "unresolved").unwrap();
        let conflict = SyncConflictItem {
            id: unresolved[0].id.clone(),
            kind: unresolved[0].kind.clone(),
            local_updated_at: unresolved[0].local_updated_at,
            remote_updated_at: unresolved[0].remote_updated_at,
            resolved_to: unresolved[0].resolved_to.clone(),
            preview: unresolved[0].preview.clone(),
            local_content: unresolved[0].local_content.clone(),
            remote_content: unresolved[0].remote_content.clone(),
        };
        resolve_conflict(&conn, &conflict, "remote").unwrap();
        let entries = list_sync_audit(&conn, 20, None, None, None).unwrap();
        assert_eq!(entries[0].event, "sync.resolve");
        assert!(entries[0].detail.contains("clipboard"));

        let cleared = clear_resolved_sync_conflicts(&conn).unwrap();
        assert!(cleared > 0);
        let entries = list_sync_audit(&conn, 20, None, None, None).unwrap();
        assert_eq!(entries[0].event, "sync.history.cleared");
        assert!(entries[0].detail.contains("cleared"));

        let removed = clear_sync_audit(&conn).unwrap();
        assert!(removed > 0);
        assert!(list_sync_audit(&conn, 20, None, None, None)
            .unwrap()
            .is_empty());

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_audit_filter_and_export() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-audit-export-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        append_sync_audit(&conn, "sync.merge", "merged a", "device-a").unwrap();
        append_sync_audit(&conn, "sync.resolve", "clipboard -> remote", "device-a").unwrap();
        append_sync_audit(&conn, "sync.history.cleared", "cleared 2", "device-b").unwrap();

        let all = list_sync_audit(&conn, 10, None, None, None).unwrap();
        assert_eq!(all.len(), 3);
        let resolved = list_sync_audit(&conn, 10, Some("sync.resolve"), None, None).unwrap();
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].event, "sync.resolve");

        let json = export_sync_audit(&conn, "json", Some("sync.merge"), None, None).unwrap();
        assert!(json.contains("\"event\": \"sync.merge\""));
        assert!(!json.contains("sync.resolve"));

        append_sync_audit(
            &conn,
            "sync.merge",
            "quoted \"detail\", line1\nline2",
            "device-a",
        )
        .unwrap();
        let csv = export_sync_audit(&conn, "csv", None, None, None).unwrap();
        assert!(csv.starts_with("id,event,detail,device_id,created_at\n"));
        assert!(csv.contains("\"quoted \"\"detail\"\", line1\nline2\""));

        assert!(export_sync_audit(&conn, "yaml", None, None, None).is_err());

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_audit_summary_groups_by_day_and_week() {
        assert_eq!(iso_date_from_epoch_ms(0), "1970-01-01");
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-audit-summary-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let monday = 1_785_715_200_000i64;
        let day_ms = 86_400_000i64;
        conn.execute(
            "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
             VALUES (?1, '', 'device-a', ?2)",
            params!["sync.merge", monday],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
             VALUES (?1, '', 'device-a', ?2)",
            params!["sync.merge", monday + day_ms],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
             VALUES (?1, '', 'device-b', ?2)",
            params!["sync.resolve", monday + day_ms * 2],
        )
        .unwrap();

        let daily = sync_audit_summary_range(&conn, "day", None, None, None, None).unwrap();
        assert_eq!(daily.total, 3);
        assert_eq!(daily.buckets.len(), 3);
        assert_eq!(daily.buckets[0].bucket, "2026-08-03");
        assert_eq!(daily.buckets[0].merge, 1);
        assert_eq!(daily.buckets[2].resolve, 1);

        let weekly = sync_audit_summary_range(&conn, "week", None, None, None, None).unwrap();
        assert_eq!(weekly.total, 3);
        assert_eq!(weekly.buckets.len(), 1);
        assert_eq!(weekly.buckets[0].bucket, "2026-08-03");
        assert_eq!(weekly.buckets[0].count, 3);
        assert_eq!(weekly.buckets[0].merge, 2);
        assert_eq!(weekly.buckets[0].resolve, 1);

        let merged_only =
            sync_audit_summary_range(&conn, "day", Some("sync.merge"), None, None, None).unwrap();
        assert_eq!(merged_only.total, 2);
        assert!(merged_only
            .buckets
            .iter()
            .all(|bucket| bucket.resolve == 0 && bucket.other == 0));

        assert!(sync_audit_summary_range(&conn, "month", None, None, None, None).is_err());

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn error_log_summary_groups_by_day_week_and_severity() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-error-log-summary-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        conn.execute("DELETE FROM error_logs", []).unwrap();
        let monday = 1_785_715_200_000i64;
        let day_ms = 86_400_000i64;
        conn.execute(
            "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id)
             VALUES (?1, 'frontend', 'boom today', NULL, 'error', ?2, ?2, 'device-a')",
            params![uid(), monday],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id)
             VALUES (?1, 'tauri', 'warn today', NULL, 'warning', ?2, ?2, 'device-b')",
            params![uid(), monday + 1000],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id)
             VALUES (?1, 'frontend', 'info tomorrow', NULL, 'info', ?2, ?2, 'device-a')",
            params![uid(), monday + day_ms],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id)
             VALUES (?1, 'tauri', 'boom in two days', NULL, 'error', ?2, ?2, 'device-b')",
            params![uid(), monday + day_ms * 2],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at, device_id)
             VALUES (?1, 'frontend', 'old boom', NULL, 'error', ?2, ?2, 'device-a')",
            params![uid(), monday - day_ms * 45],
        )
        .unwrap();

        let daily = error_log_summary(&conn, "day", None, None, None, None, None).unwrap();
        assert_eq!(daily.total, 5);
        assert_eq!(daily.buckets.len(), 48);
        assert_eq!(daily.buckets[0].bucket, "2026-06-19");
        assert_eq!(daily.buckets[47].bucket, "2026-08-05");
        assert_eq!(daily.buckets[47].error, 1);
        let non_empty_buckets: Vec<&ErrorLogBucket> = daily
            .buckets
            .iter()
            .filter(|bucket| bucket.count > 0)
            .collect();
        assert_eq!(non_empty_buckets.len(), 4);
        assert_eq!(non_empty_buckets[0].bucket, "2026-06-19");
        assert_eq!(non_empty_buckets[0].count, 1);
        assert_eq!(non_empty_buckets[1].bucket, "2026-08-03");
        assert_eq!(non_empty_buckets[1].count, 2);
        assert_eq!(non_empty_buckets[2].bucket, "2026-08-04");
        assert_eq!(non_empty_buckets[2].count, 1);
        assert_eq!(non_empty_buckets[2].info, 1);
        assert_eq!(non_empty_buckets[2].warning, 0);
        assert_eq!(non_empty_buckets[3].bucket, "2026-08-05");
        assert_eq!(non_empty_buckets[3].count, 1);
        assert_eq!(non_empty_buckets[3].error, 1);

        let weekly = error_log_summary(&conn, "week", None, None, None, None, None).unwrap();
        assert_eq!(weekly.total, 5);
        assert_eq!(weekly.buckets.len(), 8);
        assert_eq!(weekly.buckets[0].bucket, "2026-06-15");
        assert_eq!(weekly.buckets[0].count, 1);
        assert_eq!(weekly.buckets[0].error, 1);
        assert_eq!(weekly.buckets[7].bucket, "2026-08-03");
        assert_eq!(weekly.buckets[7].count, 4);
        assert_eq!(weekly.buckets[7].error, 2);
        assert_eq!(weekly.buckets[7].warning, 1);
        assert_eq!(weekly.buckets[7].info, 1);

        let errors_only =
            error_log_summary(&conn, "day", None, Some("error"), None, None, None).unwrap();
        assert_eq!(errors_only.total, 3);
        assert!(errors_only
            .buckets
            .iter()
            .all(|bucket| bucket.warning == 0 && bucket.info == 0));

        let frontend_only =
            error_log_summary(&conn, "day", Some("frontend"), None, None, None, None).unwrap();
        assert_eq!(frontend_only.total, 3);

        let device_a =
            error_log_summary(&conn, "day", None, None, Some("device-a"), None, None).unwrap();
        assert_eq!(device_a.total, 3);

        let combo = error_log_summary(
            &conn,
            "day",
            Some("frontend"),
            None,
            Some("device-a"),
            None,
            None,
        )
        .unwrap();
        assert_eq!(combo.total, 3);

        let recent =
            error_log_summary(&conn, "day", None, None, None, Some(monday - day_ms), None).unwrap();
        assert_eq!(recent.total, 4);
        assert_eq!(recent.buckets.len(), 3);
        assert_eq!(recent.buckets[0].bucket, "2026-08-03");
        assert_eq!(recent.buckets[2].bucket, "2026-08-05");

        let last_thirty_days = error_log_summary(
            &conn,
            "day",
            None,
            None,
            None,
            Some(monday - day_ms * 30),
            None,
        )
        .unwrap();
        assert_eq!(last_thirty_days.total, 4);
        assert_eq!(last_thirty_days.buckets.len(), 3);
        assert_eq!(last_thirty_days.buckets[2].bucket, "2026-08-05");

        let bounded = error_log_summary(
            &conn,
            "day",
            None,
            None,
            None,
            Some(monday),
            Some(monday + day_ms),
        )
        .unwrap();
        assert_eq!(bounded.total, 3);
        assert_eq!(bounded.buckets.len(), 2);
        assert_eq!(bounded.buckets[0].bucket, "2026-08-03");
        assert_eq!(bounded.buckets[1].bucket, "2026-08-04");
        assert_eq!(bounded.buckets[0].count, 2);
        assert_eq!(bounded.buckets[1].count, 1);

        let hourly = error_log_summary(&conn, "hour", None, None, None, None, None).unwrap();
        assert_eq!(hourly.total, 5);
        assert_eq!(hourly.buckets.len(), 1129);
        assert_eq!(hourly.buckets[0].bucket, "2026-06-19 00:00");
        assert_eq!(hourly.buckets[1128].bucket, "2026-08-05 00:00");
        assert!(hourly
            .buckets
            .iter()
            .all(|bucket| bucket.bucket.ends_with(":00")));
        let same_hour = error_log_summary(
            &conn,
            "hour",
            None,
            None,
            None,
            Some(monday),
            Some(monday + 999),
        )
        .unwrap();
        assert_eq!(same_hour.total, 1);
        assert_eq!(same_hour.buckets.len(), 1);
        assert_eq!(same_hour.buckets[0].error, 1);
        assert_eq!(same_hour.buckets[0].warning, 0);

        assert!(error_log_summary(&conn, "month", None, None, None, None, None).is_err());

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_audit_filters_by_since_and_device() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-audit-filter-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        append_sync_audit(&conn, "sync.merge", "merged a", "device-a").unwrap();
        append_sync_audit(&conn, "sync.resolve", "resolved b", "device-b").unwrap();

        let all = list_sync_audit(&conn, 10, None, None, None).unwrap();
        assert_eq!(all.len(), 2);
        let device_a = list_sync_audit(&conn, 10, None, None, Some("device-a")).unwrap();
        assert_eq!(device_a.len(), 1);
        assert_eq!(device_a[0].event, "sync.merge");

        let past = now_millis() - 10_000;
        let future = now_millis() + 10_000;
        assert!(list_sync_audit(&conn, 10, None, Some(future), None)
            .unwrap()
            .is_empty());
        assert_eq!(
            list_sync_audit(&conn, 10, None, Some(past), None)
                .unwrap()
                .len(),
            2
        );

        let json = export_sync_audit(&conn, "json", None, Some(past), Some("device-b")).unwrap();
        assert!(json.contains("device-b"));
        assert!(!json.contains("device-a"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_audit_filters_by_custom_range() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-audit-range-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let now = now_millis();
        conn.execute(
            "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params!["sync.merge", "old event", "device-a", now - 2000],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sync_audit_log (event, detail, device_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params!["sync.resolve", "recent event", "device-b", now],
        )
        .unwrap();

        let ranged =
            list_sync_audit_range(&conn, 10, None, Some(now - 1000), Some(now), None).unwrap();
        assert_eq!(ranged.len(), 1);
        assert_eq!(ranged[0].event, "sync.resolve");
        assert!(
            list_sync_audit_range(&conn, 10, None, Some(now + 1), None, None)
                .unwrap()
                .is_empty()
        );
        let json = export_sync_audit_range(&conn, "json", None, Some(now - 1000), Some(now), None)
            .unwrap();
        assert!(json.contains("recent event"));
        assert!(!json.contains("old event"));

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sync_conflicts_persist_history_until_resolved() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-sync-history-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let clip = capture_clipboard(&conn, "local v1", "test").unwrap();
        let local_updated = clip.updated_at;
        let remote = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 1,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote v1".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 1000,
                updated_at: local_updated + 1000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let merged = merge_sync_snapshot(&conn, remote).unwrap();
        assert_eq!(merged.conflicts.len(), 1);

        let unresolved = list_sync_conflicts(&conn, "unresolved").unwrap();
        assert_eq!(unresolved.len(), 1);
        assert_eq!(unresolved[0].local_content, "local v1");
        assert_eq!(unresolved[0].remote_content, "remote v1");
        assert!(unresolved[0].resolved_choice.is_none());

        resolve_conflict(&conn, &merged.conflicts[0], "remote").unwrap();
        assert!(list_sync_conflicts(&conn, "unresolved").unwrap().is_empty());
        let resolved = list_sync_conflicts(&conn, "resolved").unwrap();
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].resolved_choice.as_deref(), Some("remote"));
        assert!(resolved[0].resolved_at.is_some());

        let clip_after = list_clipboard(&conn).unwrap();
        assert_eq!(clip_after[0].content, "remote v1");

        let next_remote = SyncSnapshot {
            device_id: "device-remote".to_string(),
            exported_at: 2,
            clipboard: vec![ClipboardItem {
                id: clip.id.clone(),
                content: "remote v2".to_string(),
                source: "remote".to_string(),
                timestamp: local_updated + 2000,
                updated_at: local_updated + 2000,
            }],
            logs: Vec::new(),
            quick_prompts: Vec::new(),
            quick_prompt_usage: Vec::new(),
        };
        let merged2 = merge_sync_snapshot(&conn, next_remote).unwrap();
        assert_eq!(merged2.conflicts.len(), 1);
        assert_eq!(list_sync_conflicts(&conn, "unresolved").unwrap().len(), 1);
        assert_eq!(list_sync_conflicts(&conn, "all").unwrap().len(), 2);

        let cleared = clear_resolved_sync_conflicts(&conn).unwrap();
        assert_eq!(cleared, 1);
        assert_eq!(list_sync_conflicts(&conn, "all").unwrap().len(), 1);
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn vault_watch_config_persists_path_ignore_and_enabled() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-vault-config-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");
        let conn = init_connection(&db_path).unwrap();

        let saved = set_vault_watch_config(
            &conn,
            "C:/vault",
            &["Daily Notes".to_string(), "node_modules".to_string()],
            true,
        )
        .unwrap();
        assert_eq!(saved.path, "C:/vault");
        assert_eq!(saved.ignore_patterns.len(), 2);
        assert!(saved.enabled);
        drop(conn);

        let reopened = init_connection(&db_path).unwrap();
        let restored = get_vault_watch_config(&reopened).unwrap();
        assert_eq!(restored.path, "C:/vault");
        assert_eq!(
            restored.ignore_patterns,
            vec!["Daily Notes", "node_modules"]
        );
        assert!(restored.enabled);
        assert!(restored.updated_at > 0);

        let stopped =
            set_vault_watch_config(&reopened, &restored.path, &restored.ignore_patterns, false)
                .unwrap();
        assert!(!stopped.enabled);
        assert_eq!(stopped.path, "C:/vault");
        assert_eq!(stopped.ignore_patterns.len(), 2);

        let empty = get_vault_watch_config(&reopened).unwrap();
        assert!(!empty.enabled);
        drop(reopened);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn vault_watch_targets_crud_and_legacy_migration() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-vault-targets-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();

        set_vault_watch_config(&conn, "C:/legacy", &["node_modules".to_string()], true).unwrap();
        migrate_vault_watch_targets(&conn).unwrap();
        let targets = list_vault_watch_targets(&conn).unwrap();
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].path, "C:/legacy");
        assert_eq!(targets[0].ignore_patterns, vec!["node_modules"]);
        assert!(targets[0].enabled);
        assert_eq!(targets[0].last_event_at, 0);
        assert_eq!(targets[0].event_count, 0);
        assert_eq!(targets[0].created_events, 0);
        assert_eq!(targets[0].modified_events, 0);
        assert_eq!(targets[0].removed_events, 0);

        upsert_vault_watch_target(&conn, "D:/work", &[], false).unwrap();
        let targets = list_vault_watch_targets(&conn).unwrap();
        assert_eq!(targets.len(), 2);
        assert_eq!(targets[1].path, "D:/work");
        assert!(!targets[1].enabled);

        touch_vault_watch_event(&conn, "D:/work", "D:/work/note.md", "created").unwrap();
        touch_vault_watch_event(&conn, "D:/work", "D:/work/task.md", "modified").unwrap();
        let touched = list_vault_watch_targets(&conn).unwrap();
        let work = touched.iter().find(|t| t.path == "D:/work").unwrap();
        assert_eq!(work.event_count, 2);
        assert!(work.last_event_at > 0);
        assert_eq!(work.created_events, 1);
        assert_eq!(work.modified_events, 1);
        assert_eq!(work.removed_events, 0);
        let events = list_vault_watch_events(&conn, Some("D:/work"), 20).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_kind, "modified");
        assert_eq!(events[0].file_path, "D:/work/task.md");
        assert_eq!(events[1].event_kind, "created");
        assert_eq!(events[1].file_path, "D:/work/note.md");
        assert_eq!(
            list_vault_watch_events(&conn, Some("C:/missing"), 20)
                .unwrap()
                .len(),
            0
        );

        let enabled = set_vault_watch_target_enabled(&conn, "D:/work", true).unwrap();
        assert_eq!(enabled.as_ref().map(|t| t.enabled), Some(true));
        assert!(set_vault_watch_target_enabled(&conn, "missing:/path", true)
            .unwrap()
            .is_none());

        assert!(delete_vault_watch_target(&conn, "C:/legacy").unwrap());
        assert!(!delete_vault_watch_target(&conn, "C:/legacy").unwrap());
        let remaining = list_vault_watch_targets(&conn).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].path, "D:/work");

        assert_eq!(clear_vault_watch_events(&conn, Some("D:/work")).unwrap(), 2);
        assert_eq!(
            list_vault_watch_events(&conn, Some("D:/work"), 20)
                .unwrap()
                .len(),
            0
        );

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn vault_target_stats_group_by_vault_path() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-vault-stats-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();

        upsert_knowledge_file(&conn, "C:/a/a.md", "A", "", "a", "C:/a").unwrap();
        upsert_knowledge_file(&conn, "C:/a/b.md", "B", "", "b", "C:/a").unwrap();
        upsert_knowledge_file(&conn, "D:/b/c.md", "C", "", "c", "D:/b").unwrap();
        upsert_knowledge_file(&conn, "E:/legacy.md", "L", "", "l", "").unwrap();
        upsert_vault_watch_target(&conn, "C:/a", &[], true).unwrap();
        touch_vault_watch_event(&conn, "C:/a", "C:/a/note.md", "created").unwrap();

        let stats = vault_target_stats(&conn).unwrap();
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[0].path, "C:/a");
        assert_eq!(stats[0].files, 2);
        assert!(stats[0].last_indexed_at > 0);
        assert_eq!(stats[0].event_count, 1);
        assert!(stats[0].last_event_at > 0);
        assert_eq!(stats[0].created_events, 1);
        assert_eq!(stats[0].modified_events, 0);
        assert_eq!(stats[0].removed_events, 0);
        assert_eq!(stats[1].path, "D:/b");
        assert_eq!(stats[1].files, 1);
        assert_eq!(stats[1].event_count, 0);
        assert_eq!(stats[1].created_events, 0);

        upsert_knowledge_file(&conn, "C:/a/c.md", "C", "", "c", "C:/a").unwrap();
        let stats = vault_target_stats(&conn).unwrap();
        assert_eq!(stats[0].files, 3);

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn knowledge_files_list_filters_by_vault_and_limit() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-knowledge-files-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();

        upsert_knowledge_file(&conn, "C:/a/a.md", "A", "#work", "a", "C:/a").unwrap();
        upsert_knowledge_file(&conn, "C:/a/b.md", "B", "#life", "b", "C:/a").unwrap();
        upsert_knowledge_file(&conn, "D:/b/c.md", "C", "", "c", "D:/b").unwrap();
        upsert_knowledge_file(&conn, "E:/legacy.md", "L", "", "l", "").unwrap();
        conn.execute(
            "UPDATE knowledge_files SET indexed_at = ?1 WHERE path = ?2",
            params![1000, "C:/a/a.md"],
        )
        .unwrap();
        conn.execute(
            "UPDATE knowledge_files SET indexed_at = ?1 WHERE path = ?2",
            params![2000, "C:/a/b.md"],
        )
        .unwrap();
        conn.execute(
            "UPDATE knowledge_files SET indexed_at = ?1 WHERE path = ?2",
            params![3000, "D:/b/c.md"],
        )
        .unwrap();
        conn.execute(
            "UPDATE knowledge_files SET indexed_at = ?1 WHERE path = ?2",
            params![4000, "E:/legacy.md"],
        )
        .unwrap();

        let all = list_knowledge_files(&conn, None, None).unwrap();
        assert_eq!(all.len(), 4);
        assert_eq!(all[0].title, "L");
        assert_eq!(all[0].vault_path, "");

        let c_files = list_knowledge_files(&conn, Some("C:/a"), None).unwrap();
        assert_eq!(c_files.len(), 2);
        assert_eq!(c_files[0].title, "B");
        assert_eq!(c_files[1].title, "A");
        assert!(c_files.iter().all(|file| file.vault_path == "C:/a"));

        let limited = list_knowledge_files(&conn, None, Some(1)).unwrap();
        assert_eq!(limited.len(), 1);
        assert_eq!(limited[0].title, "L");

        let legacy = list_knowledge_files(&conn, Some(""), None).unwrap();
        assert_eq!(legacy.len(), 1);
        assert_eq!(legacy[0].path, "E:/legacy.md");

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn knowledge_files_list_reports_missing_and_stale() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-knowledge-status-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("note.md");
        std::fs::write(&file_path, "# note").unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();
        let path_str = file_path.to_string_lossy().to_string();
        upsert_knowledge_file(&conn, &path_str, "Note", "", "note", "C:/vault").unwrap();

        let fresh = list_knowledge_files(&conn, Some("C:/vault"), None).unwrap();
        assert_eq!(fresh.len(), 1);
        assert!(fresh[0].exists);
        assert!(!fresh[0].stale);

        conn.execute(
            "UPDATE knowledge_files SET indexed_at = 0 WHERE path = ?1",
            params![path_str],
        )
        .unwrap();
        let stale = list_knowledge_files(&conn, Some("C:/vault"), None).unwrap();
        assert!(stale[0].exists);
        assert!(stale[0].stale);

        std::fs::remove_file(&file_path).unwrap();
        let missing = list_knowledge_files(&conn, Some("C:/vault"), None).unwrap();
        assert!(!missing[0].exists);
        assert!(!missing[0].stale);

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn knowledge_cleanup_removes_missing_and_reindexes_stale() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-knowledge-cleanup-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();

        let stale_path = dir.join("stale.md");
        std::fs::write(&stale_path, "---\ntitle: Stale\n---\n# old").unwrap();
        let stale_str = stale_path.to_string_lossy().to_string();
        upsert_knowledge_file(&conn, &stale_str, "Stale", "", "# old", "C:/vault").unwrap();
        conn.execute(
            "UPDATE knowledge_files SET indexed_at = 0 WHERE path = ?1",
            params![stale_str],
        )
        .unwrap();
        std::fs::write(&stale_path, "---\ntitle: Stale\n---\n# new").unwrap();

        let missing_path = dir.join("missing.md");
        let missing_str = missing_path.to_string_lossy().to_string();
        std::fs::write(&missing_path, "gone").unwrap();
        upsert_knowledge_file(&conn, &missing_str, "Missing", "", "gone", "C:/vault").unwrap();
        std::fs::remove_file(&missing_path).unwrap();

        let fresh_path = dir.join("fresh.md");
        let fresh_str = fresh_path.to_string_lossy().to_string();
        std::fs::write(&fresh_path, "# fresh").unwrap();
        upsert_knowledge_file(&conn, &fresh_str, "Fresh", "", "# fresh", "D:/vault").unwrap();

        let result = cleanup_knowledge_files(&conn, Some("C:/vault")).unwrap();
        assert_eq!(result.removed, 1);
        assert_eq!(result.reindexed, 1);
        assert_eq!(result.failed, 0);

        let remaining = list_knowledge_files(&conn, None, None).unwrap();
        assert_eq!(remaining.len(), 2);
        assert!(remaining.iter().all(|doc| doc.path != missing_str));

        let stale_doc = remaining.iter().find(|doc| doc.path == stale_str).unwrap();
        assert!(stale_doc.exists);
        assert!(!stale_doc.stale);
        let content: String = conn
            .query_row(
                "SELECT content FROM knowledge_files WHERE path = ?1",
                params![stale_str],
                |row| row.get(0),
            )
            .unwrap();
        assert!(content.contains("new"));

        let fresh_doc = remaining.iter().find(|doc| doc.path == fresh_str).unwrap();
        assert_eq!(fresh_doc.vault_path, "D:/vault");

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn vault_index_queue_persists_across_reopen() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-index-queue-persist-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");
        let conn = init_connection(&db_path).unwrap();
        persist_vault_index_queue(
            &conn,
            &VaultIndexQueueRecord {
                run_id: "run-1".to_string(),
                path: "C:/vault".to_string(),
                ignore_patterns: vec!["Daily Notes".to_string(), "*.tmp".to_string()],
                concurrency: 2,
                status: "queued".to_string(),
                priority: 1,
                attempts: 0,
                last_error: String::new(),
            },
        )
        .unwrap();
        persist_vault_index_queue(
            &conn,
            &VaultIndexQueueRecord {
                run_id: "run-2".to_string(),
                path: "D:/vault".to_string(),
                ignore_patterns: Vec::new(),
                concurrency: 4,
                status: "running".to_string(),
                priority: 0,
                attempts: 1,
                last_error: "boom".to_string(),
            },
        )
        .unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let records = list_vault_index_queue(&conn).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].run_id, "run-1");
        assert_eq!(records[0].path, "C:/vault");
        assert_eq!(records[0].ignore_patterns, vec!["Daily Notes", "*.tmp"]);
        assert_eq!(records[0].concurrency, 2);
        assert_eq!(records[0].status, "queued");
        assert_eq!(records[0].priority, 1);
        assert_eq!(records[0].attempts, 0);
        assert_eq!(records[0].last_error, "");
        assert_eq!(records[1].status, "running");
        assert_eq!(records[1].priority, 0);
        assert_eq!(records[1].attempts, 1);
        assert_eq!(records[1].last_error, "boom");

        delete_vault_index_queue(&conn, "run-1").unwrap();
        let records = list_vault_index_queue(&conn).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].run_id, "run-2");
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn vault_index_queue_migrates_priority_columns() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE vault_index_queue (
                run_id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                ignore_patterns TEXT NOT NULL DEFAULT '[]',
                concurrency INTEGER NOT NULL DEFAULT 4,
                status TEXT NOT NULL DEFAULT 'queued',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        migrate_vault_index_queue_priority(&conn).unwrap();
        assert!(column_exists(&conn, "vault_index_queue", "priority").unwrap());
        assert!(column_exists(&conn, "vault_index_queue", "attempts").unwrap());
        assert!(column_exists(&conn, "vault_index_queue", "last_error").unwrap());
        persist_vault_index_queue(
            &conn,
            &VaultIndexQueueRecord {
                run_id: "run-1".to_string(),
                path: "C:/vault".to_string(),
                ignore_patterns: Vec::new(),
                concurrency: 4,
                status: "queued".to_string(),
                priority: 1,
                attempts: 2,
                last_error: "boom".to_string(),
            },
        )
        .unwrap();
        let records = list_vault_index_queue(&conn).unwrap();
        assert_eq!(records[0].priority, 1);
        assert_eq!(records[0].attempts, 2);
        assert_eq!(records[0].last_error, "boom");
        migrate_vault_index_queue_priority(&conn).unwrap();
        assert_eq!(list_vault_index_queue(&conn).unwrap().len(), 1);
    }

    #[test]
    fn vault_watch_events_clear_all_and_prune() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-vault-events-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = init_connection(&dir.join("workbench.db")).unwrap();

        touch_vault_watch_event(&conn, "A:/one", "A:/one/1.md", "created").unwrap();
        touch_vault_watch_event(&conn, "B:/two", "B:/two/2.md", "removed").unwrap();
        assert_eq!(list_vault_watch_events(&conn, None, 50).unwrap().len(), 2);
        assert_eq!(clear_vault_watch_events(&conn, None).unwrap(), 2);
        assert_eq!(list_vault_watch_events(&conn, None, 50).unwrap().len(), 0);
        assert!(touch_vault_watch_event(&conn, "A:/one", "A:/one/bad.txt", "watched").is_err());
        assert_eq!(list_vault_watch_events(&conn, None, 50).unwrap().len(), 0);

        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn message_version_parent_lineage_tracks_edit_chain() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-lineage-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let session = create_session(&conn, "Lineage test", "openai").unwrap();
        let user = save_chat_message(&conn, &session.id, "user", "v1 original", None).unwrap();
        update_chat_message(&conn, &user.id, "v2 edited").unwrap();
        update_chat_message(&conn, &user.id, "v3 edited again").unwrap();
        restore_message_version(
            &conn,
            &user.id,
            &list_message_versions(&conn, &user.id).unwrap()[0].id,
        )
        .unwrap();

        let versions = list_message_versions(&conn, &user.id).unwrap();
        assert_eq!(versions.len(), 3);
        assert!(versions[0].parent_version_id.is_none());
        assert_eq!(
            versions[1].parent_version_id.as_deref(),
            Some(versions[0].id.as_str())
        );
        assert_eq!(
            versions[2].parent_version_id.as_deref(),
            Some(versions[1].id.as_str())
        );
        assert_eq!(
            list_chat_messages(&conn, &session.id).unwrap()[0].content,
            "v1 original"
        );
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rag_search_ranks_relevant_thought_first() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-rag-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        create_thought(
            &conn,
            "Rust SQLite migration plan with tasks and sprints",
            "#work",
            "note",
        )
        .unwrap();
        create_thought(&conn, "Dinner recipe for tomato pasta", "#life", "note").unwrap();

        let results = search_thoughts(&conn, "sqlite migration", 5).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].content.contains("SQLite"));
        assert!(results[0].score > 0.0);

        let status = rag_index_status(&conn).unwrap();
        assert!(status.indexed);
        assert!(status.documents >= 2);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn webhook_rules_crud_and_due_selection() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let now = now_millis();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Daily sync",
                url: "https://example.test/hook",
                payload: "{\"event\":\"daily\"}",
                method: "POST",
                token: "secret-token",
                secret: "hook-secret",
                retries: 2,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 3,
            },
        )
        .unwrap();
        assert!(rule.enabled);
        assert_eq!(rule.interval_seconds, 60);
        assert_eq!(rule.method, "POST");
        assert_eq!(rule.token, "secret-token");
        assert_eq!(rule.secret, "hook-secret");
        assert_eq!(rule.retries, 2);
        assert_eq!(rule.cooldown_seconds, 0);
        assert_eq!(rule.trigger_event, "");
        assert_eq!(rule.consecutive_failures, 0);
        assert_eq!(rule.auto_disable_after, 3);

        let due = list_due_webhook_rules(&conn, now).unwrap();
        assert!(due.iter().any(|r| r.id == rule.id));

        mark_webhook_rule_run(&conn, &rule.id, 200, "HTTP 200 delivered").unwrap();
        let after = get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after.last_status, 200);
        assert!(after.last_message.contains("HTTP 200"));
        let not_due = list_due_webhook_rules(&conn, now + 1000).unwrap();
        assert!(!not_due.iter().any(|r| r.id == rule.id));

        set_webhook_rule_enabled(&conn, &rule.id, false).unwrap();
        let disabled = list_due_webhook_rules(&conn, now + 10_000_000).unwrap();
        assert!(!disabled.iter().any(|r| r.id == rule.id));

        delete_webhook_rule(&conn, &rule.id).unwrap();
        assert!(get_webhook_rule(&conn, &rule.id).unwrap().is_none());
    }

    #[test]
    fn webhook_migration_adds_secret_and_retries() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE webhook_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                method TEXT NOT NULL DEFAULT 'POST',
                token TEXT NOT NULL DEFAULT '',
                interval_seconds INTEGER NOT NULL DEFAULT 60,
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        migrate_webhook_secret_retries(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "secret").unwrap());
        assert!(column_exists(&conn, "webhook_rules", "retries").unwrap());
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES (?1, 'migrated', 'https://example.test', 1, 1)",
            params!["migrated-rule"],
        )
        .unwrap();
        let secret: String = conn
            .query_row(
                "SELECT secret FROM webhook_rules WHERE id = 'migrated-rule'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let retries: i64 = conn
            .query_row(
                "SELECT retries FROM webhook_rules WHERE id = 'migrated-rule'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(secret, "");
        assert_eq!(retries, 1);
    }

    #[test]
    fn embed_text_is_deterministic_and_cosine_ranks_similar() {
        let a = embed_text("Rust SQLite migration plan with tasks and sprints");
        let b = embed_text("Rust SQLite migration plan with tasks and sprints");
        let c = embed_text("Dinner recipe for tomato pasta");
        let same = cosine_similarity(&a, &b);
        let different = cosine_similarity(&a, &c);
        assert!((same - 1.0).abs() < 1e-9);
        assert!(different >= 0.0 && different < same);
        let empty = embed_text("");
        let norm = empty.iter().map(|v| v * v).sum::<f64>().sqrt();
        assert!(norm <= 1e-9);
    }

    #[test]
    fn knowledge_embedding_migration_adds_column_and_search_reports_vector() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE knowledge_files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                tags TEXT,
                content TEXT NOT NULL,
                vault_path TEXT NOT NULL DEFAULT '',
                indexed_at INTEGER
            );",
        )
        .unwrap();
        conn.execute_batch(
            "CREATE TABLE thoughts (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL DEFAULT 'inbox',
                created_at INTEGER
            );",
        )
        .unwrap();
        migrate_knowledge_embedding(&conn).unwrap();
        assert!(column_exists(&conn, "knowledge_files", "embedding").unwrap());
        upsert_knowledge_file(
            &conn,
            "C:/vault/notes.md",
            "Notes",
            "#work",
            "Local RAG vector search",
            "C:/vault",
        )
        .unwrap();
        let embedding: String = conn
            .query_row(
                "SELECT embedding FROM knowledge_files WHERE path = 'C:/vault/notes.md'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!embedding.is_empty());
        let results = search_thoughts(&conn, "local vector search", 5).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].vector_score > 0.0);
        let status = rag_index_status(&conn).unwrap();
        assert!(status.vector_indexed);
    }

    #[test]
    fn provider_model_migration_adds_column_and_persists() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                is_active INTEGER DEFAULT 1
            );",
        )
        .unwrap();
        migrate_provider_model(&conn).unwrap();
        migrate_provider_priority(&conn).unwrap();
        assert!(column_exists(&conn, "providers", "model").unwrap());
        let provider =
            create_provider(&conn, "Local", "http://localhost:11434", "", "qwen2.5:3b").unwrap();
        assert_eq!(provider.model, "qwen2.5:3b");
        update_provider_model(&conn, &provider.id, "qwen3:8b").unwrap();
        let updated = get_provider(&conn, &provider.id).unwrap().unwrap();
        assert_eq!(updated.model, "qwen3:8b");
    }

    #[test]
    fn provider_priority_migration_adds_column_and_persists() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                model TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1
            );",
        )
        .unwrap();
        migrate_provider_priority(&conn).unwrap();
        assert!(column_exists(&conn, "providers", "priority").unwrap());
        let provider =
            create_provider(&conn, "Local", "http://localhost:11434", "", "qwen2.5:3b").unwrap();
        assert_eq!(provider.priority, 0);
        set_provider_priority(&conn, &provider.id, 5).unwrap();
        let updated = get_provider(&conn, &provider.id).unwrap().unwrap();
        assert_eq!(updated.priority, 5);
        set_provider_priority(&conn, &provider.id, -2).unwrap();
        assert_eq!(
            get_provider(&conn, &provider.id).unwrap().unwrap().priority,
            0
        );
    }

    #[test]
    fn webhook_trigger_event_migration_adds_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE webhook_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                method TEXT NOT NULL DEFAULT 'POST',
                token TEXT NOT NULL DEFAULT '',
                secret TEXT NOT NULL DEFAULT '',
                retries INTEGER NOT NULL DEFAULT 1,
                interval_seconds INTEGER NOT NULL DEFAULT 60,
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        migrate_webhook_trigger_event(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "trigger_event").unwrap());
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES ('legacy-rule', 'Legacy', 'https://example.test', 1, 1)",
            [],
        )
        .unwrap();
        let trigger_event: String = conn
            .query_row(
                "SELECT trigger_event FROM webhook_rules WHERE id = 'legacy-rule'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(trigger_event, "");
    }

    #[test]
    fn webhook_cooldown_migration_adds_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE webhook_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                method TEXT NOT NULL DEFAULT 'POST',
                token TEXT NOT NULL DEFAULT '',
                secret TEXT NOT NULL DEFAULT '',
                retries INTEGER NOT NULL DEFAULT 1,
                interval_seconds INTEGER NOT NULL DEFAULT 60,
                trigger_event TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        migrate_webhook_cooldown(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "cooldown_seconds").unwrap());
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES ('legacy-cooled', 'Legacy', 'https://example.test', 1, 1)",
            [],
        )
        .unwrap();
        let cooldown: i64 = conn
            .query_row(
                "SELECT cooldown_seconds FROM webhook_rules WHERE id = 'legacy-cooled'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(cooldown, 0);
    }

    #[test]
    fn webhook_circuit_breaker_migration_adds_columns() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE webhook_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                method TEXT NOT NULL DEFAULT 'POST',
                token TEXT NOT NULL DEFAULT '',
                secret TEXT NOT NULL DEFAULT '',
                retries INTEGER NOT NULL DEFAULT 1,
                cooldown_seconds INTEGER NOT NULL DEFAULT 0,
                interval_seconds INTEGER NOT NULL DEFAULT 60,
                trigger_event TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        migrate_webhook_circuit_breaker(&conn).unwrap();
        migrate_webhook_circuit_breaker(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "consecutive_failures").unwrap());
        assert!(column_exists(&conn, "webhook_rules", "auto_disable_after").unwrap());
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES ('legacy-circuit', 'Legacy', 'https://example.test', 1, 1)",
            [],
        )
        .unwrap();
        let failures: i64 = conn
            .query_row(
                "SELECT consecutive_failures FROM webhook_rules WHERE id = 'legacy-circuit'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let threshold: i64 = conn
            .query_row(
                "SELECT auto_disable_after FROM webhook_rules WHERE id = 'legacy-circuit'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(failures, 0);
        assert_eq!(threshold, 3);
    }

    #[test]
    fn webhook_circuit_breaker_tracks_failures_and_disables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Circuit hook",
                url: "https://example.test/circuit",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 2,
            },
        )
        .unwrap();
        assert_eq!(rule.consecutive_failures, 0);
        assert_eq!(rule.auto_disable_after, 2);

        record_webhook_rule_outcome(&conn, &rule.id, 500, "HTTP 500 boom").unwrap();
        let after_one = get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after_one.consecutive_failures, 1);
        assert!(after_one.enabled);
        assert_eq!(after_one.last_status, 500);

        record_webhook_rule_outcome(&conn, &rule.id, 0, "Webhook delivery failed: timeout")
            .unwrap();
        let after_two = get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after_two.consecutive_failures, 2);
        assert!(!after_two.enabled);
        assert!(
            after_two
                .last_message
                .contains("Auto-disabled after 2 consecutive failures"),
            "{}",
            after_two.last_message
        );

        let restored = set_webhook_rule_enabled(&conn, &rule.id, true).unwrap();
        assert!(restored.enabled);
        assert_eq!(restored.consecutive_failures, 0);

        record_webhook_rule_outcome(&conn, &rule.id, 200, "HTTP 200 delivered").unwrap();
        let after_success = get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after_success.consecutive_failures, 0);
        assert!(after_success.enabled);
        assert!(after_success.last_message.contains("HTTP 200"));
    }

    #[test]
    fn webhook_circuit_breaker_zero_threshold_never_disables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "No auto-off hook",
                url: "https://example.test/no-auto-off",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 0,
            },
        )
        .unwrap();
        for _ in 0..5 {
            record_webhook_rule_outcome(&conn, &rule.id, 500, "HTTP 500").unwrap();
        }
        let after = get_webhook_rule(&conn, &rule.id).unwrap().unwrap();
        assert_eq!(after.consecutive_failures, 5);
        assert!(after.enabled);
    }

    #[test]
    fn webhook_rule_runs_record_list_and_prune() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Log hook",
                url: "https://example.test/log",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 3,
            },
        )
        .unwrap();

        let first = record_webhook_rule_run(
            &conn,
            &rule.id,
            "manual",
            "success",
            200,
            1,
            "HTTP 200 delivered",
        )
        .unwrap();
        assert_eq!(first.kind, "manual");
        assert_eq!(first.status, "success");
        assert_eq!(first.http_status, 200);
        assert_eq!(first.attempts, 1);

        record_webhook_rule_run(
            &conn,
            &rule.id,
            "scheduled",
            "failed",
            500,
            3,
            "HTTP 500 boom",
        )
        .unwrap();

        let runs = list_webhook_rule_runs(&conn, Some(&rule.id), 10).unwrap();
        assert_eq!(runs.len(), 2);
        assert_eq!(runs[0].status, "failed");
        assert_eq!(runs[0].kind, "scheduled");
        assert_eq!(runs[1].status, "success");

        for i in 0..60 {
            record_webhook_rule_run(
                &conn,
                &rule.id,
                "event",
                "success",
                200,
                1,
                &format!("run {}", i),
            )
            .unwrap();
        }
        let pruned = list_webhook_rule_runs(&conn, Some(&rule.id), 200).unwrap();
        assert_eq!(pruned.len(), 50);
        assert_eq!(pruned[0].message, "run 59");

        let all = list_webhook_rule_runs(&conn, None, 200).unwrap();
        assert_eq!(all.len(), 50);
        let limited = list_webhook_rule_runs(&conn, None, 3).unwrap();
        assert_eq!(limited.len(), 3);
    }

    #[test]
    fn webhook_event_cooldown_suppresses_repeat_triggers() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let now = now_millis();
        let cooled = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Cooled hook",
                url: "https://example.test/cooled",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 30,
                interval_seconds: 60,
                trigger_event: "error.reported",
                auto_disable_after: 3,
            },
        )
        .unwrap();
        let instant = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Instant hook",
                url: "https://example.test/instant",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "error.reported",
                auto_disable_after: 3,
            },
        )
        .unwrap();

        let first = list_event_webhook_rules(&conn, "error.reported", now).unwrap();
        assert!(first.iter().any(|r| r.id == cooled.id));
        assert!(first.iter().any(|r| r.id == instant.id));

        mark_webhook_rule_run(&conn, &cooled.id, 202, "Queued for delivery").unwrap();
        mark_webhook_rule_run(&conn, &instant.id, 202, "Queued for delivery").unwrap();

        let suppressed = list_event_webhook_rules(&conn, "error.reported", now + 1000).unwrap();
        assert!(!suppressed.iter().any(|r| r.id == cooled.id));
        assert!(suppressed.iter().any(|r| r.id == instant.id));

        let restored = list_event_webhook_rules(&conn, "error.reported", now + 31_000).unwrap();
        assert!(restored.iter().any(|r| r.id == cooled.id));
    }

    #[test]
    fn webhook_delivery_queue_lifecycle() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let event_rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Event hook",
                url: "https://example.test/event",
                payload: "{\"source\":\"event\"}",
                method: "POST",
                token: "",
                secret: "",
                retries: 2,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "sync.completed",
                auto_disable_after: 3,
            },
        )
        .unwrap();
        let interval_rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Interval hook",
                url: "https://example.test/interval",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 3,
            },
        )
        .unwrap();
        assert_eq!(event_rule.trigger_event, "sync.completed");
        let fail_rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Fail hook",
                url: "https://example.test/fail",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "sync.completed",
                auto_disable_after: 3,
            },
        )
        .unwrap();
        let due = list_due_webhook_rules(&conn, now_millis()).unwrap();
        assert!(due.iter().any(|r| r.id == interval_rule.id));
        assert!(!due.iter().any(|r| r.id == event_rule.id));

        let now = now_millis();
        let delivery =
            enqueue_webhook_delivery(&conn, &event_rule, "sync.completed", &event_rule.payload)
                .unwrap();
        assert_eq!(delivery.status, "queued");
        assert!(delivery.next_attempt_at <= now + 1);
        let claimed = claim_due_webhook_deliveries(&conn, now, 8).unwrap();
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].status, "delivering");
        complete_webhook_delivery(
            &conn,
            &delivery.id,
            "success",
            200,
            "HTTP 200 delivered",
            1,
            now,
        )
        .unwrap();
        let done = get_webhook_delivery(&conn, &delivery.id).unwrap().unwrap();
        assert_eq!(done.status, "success");

        let failing = enqueue_webhook_delivery(&conn, &fail_rule, "sync.completed", "{}").unwrap();
        claim_due_webhook_deliveries(&conn, now, 8).unwrap();
        let backoff = now + 2000;
        complete_webhook_delivery(&conn, &failing.id, "queued", 500, "HTTP 500", 1, backoff)
            .unwrap();
        let retryable = get_webhook_delivery(&conn, &failing.id).unwrap().unwrap();
        assert_eq!(retryable.status, "queued");
        assert_eq!(retryable.attempts, 1);
        assert_eq!(retryable.next_attempt_at, backoff);
        claim_due_webhook_deliveries(&conn, backoff, 8).unwrap();
        complete_webhook_delivery(&conn, &failing.id, "dead", 500, "HTTP 500", 2, backoff).unwrap();
        let dead = get_webhook_delivery(&conn, &failing.id).unwrap().unwrap();
        assert_eq!(dead.status, "dead");
        let retried = retry_webhook_delivery(&conn, &failing.id).unwrap();
        assert_eq!(retried.status, "queued");
        assert_eq!(retried.attempts, 0);
        delete_webhook_delivery(&conn, &failing.id).unwrap();
        assert!(get_webhook_delivery(&conn, &failing.id).unwrap().is_none());

        enqueue_webhook_delivery(&conn, &event_rule, "sync.completed", "{}").unwrap();
        delete_webhook_rule(&conn, &event_rule.id).unwrap();
        let remaining = list_webhook_deliveries(&conn, 100, "").unwrap();
        assert!(remaining.iter().all(|d| d.rule_id != event_rule.id));
    }

    #[test]
    fn webhook_retention_config_defaults_and_clamps() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let defaults = get_webhook_retention_config(&conn).unwrap();
        assert_eq!(defaults.retention_days, 30);
        assert_eq!(defaults.max_records, 200);
        assert!(defaults.auto_cleanup);

        let clamped = set_webhook_retention_config(&conn, 0, 100_001, false).unwrap();
        assert_eq!(clamped.retention_days, 1);
        assert_eq!(clamped.max_records, 100_000);
        assert!(!clamped.auto_cleanup);

        let clamped_up = set_webhook_retention_config(&conn, 3651, 0, true).unwrap();
        assert_eq!(clamped_up.retention_days, 3650);
        assert_eq!(clamped_up.max_records, 1);
        assert!(clamped_up.auto_cleanup);
        assert!(clamped_up.updated_at > 0);
    }

    #[test]
    fn webhook_retention_prunes_by_age_and_count() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Retention hook",
                url: "https://example.test/retention",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 3,
            },
        )
        .unwrap();

        let old = now_millis() - 2 * 86_400_000;
        let recent = now_millis();
        let set = |label: &str, age: i64, status: &str| {
            let delivery = enqueue_webhook_delivery(
                &conn,
                &rule,
                "sync.completed",
                &format!("{{\"n\":\"{label}\"}}"),
            )
            .unwrap();
            conn.execute(
                "UPDATE webhook_deliveries SET status = ?1, created_at = ?2, updated_at = ?2
                 WHERE id = ?3",
                params![status, age, delivery.id],
            )
            .unwrap();
            delivery.id
        };

        set("old-success", old, "success");
        set("old-dead", old, "dead");
        let recent_dead = set("recent-dead", recent, "dead");
        set("recent-success", recent + 1, "success");
        set("old-queued", old, "queued");
        set("recent-queued", recent, "queued");

        let result = prune_webhook_deliveries(&conn, 1, 1).unwrap();
        assert_eq!(result.removed_by_age, 2);
        assert_eq!(result.removed_by_count, 1);
        assert_eq!(result.total_removed, 3);

        assert!(get_webhook_delivery(&conn, &recent_dead).unwrap().is_none());
        let remaining = list_webhook_deliveries(&conn, 100, "").unwrap();
        assert_eq!(remaining.len(), 3);
        assert!(remaining.iter().any(|d| d.status == "queued"));
        assert!(remaining.iter().any(|d| d.created_at == old));

        let stats = get_webhook_delivery_stats(&conn).unwrap();
        assert_eq!(stats.total, 3);
        assert_eq!(stats.success, 1);
        assert_eq!(stats.dead, 0);
        assert_eq!(stats.queued, 2);
    }

    #[test]
    fn webhook_delivery_stats_counts_each_status() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let rule = create_webhook_rule(
            &conn,
            &WebhookRuleInput {
                name: "Stats hook",
                url: "https://example.test/stats",
                payload: "{}",
                method: "POST",
                token: "",
                secret: "",
                retries: 1,
                cooldown_seconds: 0,
                interval_seconds: 60,
                trigger_event: "",
                auto_disable_after: 3,
            },
        )
        .unwrap();

        let queued = enqueue_webhook_delivery(&conn, &rule, "", "{}").unwrap();
        let delivering = enqueue_webhook_delivery(&conn, &rule, "", "{}").unwrap();
        let success = enqueue_webhook_delivery(&conn, &rule, "", "{}").unwrap();
        let dead = enqueue_webhook_delivery(&conn, &rule, "", "{}").unwrap();
        let now = now_millis();
        conn.execute(
            "UPDATE webhook_deliveries SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params!["delivering", now, delivering.id],
        )
        .unwrap();
        complete_webhook_delivery(&conn, &success.id, "success", 200, "ok", 1, now).unwrap();
        complete_webhook_delivery(&conn, &dead.id, "dead", 500, "fail", 2, now).unwrap();

        let stats = get_webhook_delivery_stats(&conn).unwrap();
        assert_eq!(stats.total, 4);
        assert_eq!(stats.queued, 1);
        assert_eq!(stats.delivering, 1);
        assert_eq!(stats.success, 1);
        assert_eq!(stats.dead, 1);
        assert_eq!(stats.failed, 0);
        assert!(get_webhook_delivery(&conn, &queued.id).unwrap().is_some());
    }
}
