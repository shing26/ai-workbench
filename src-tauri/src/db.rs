use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

use crate::journey;

pub struct Db(pub Mutex<Connection>);

#[cfg(test)]
pub fn new_test_connection() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory connection");
    conn.execute_batch(SCHEMA).expect("schema setup");
    conn
}

pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT,
    revenue REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',
    created_at INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    material TEXT NOT NULL DEFAULT '',
    journey_stage TEXT NOT NULL DEFAULT 'idea',
    journey_doc_path TEXT
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
    completed_at INTEGER,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    is_dod INTEGER NOT NULL DEFAULT 0
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
    is_active INTEGER DEFAULT 1,
    api_key_encrypted INTEGER NOT NULL DEFAULT 0,
    timeout_secs INTEGER NOT NULL DEFAULT 30,
    retry_count INTEGER NOT NULL DEFAULT 1,
    retry_delay_secs INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS model_metadata (
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    owned_by TEXT NOT NULL DEFAULT '',
    context_window INTEGER NOT NULL DEFAULT 0,
    input_price_per_mtok REAL NOT NULL DEFAULT 0,
    output_price_per_mtok REAL NOT NULL DEFAULT 0,
    rate_tpm INTEGER NOT NULL DEFAULT 0,
    rate_rpm INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (provider_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_model_metadata_sort
    ON model_metadata(provider_id, is_favorite DESC, last_used_at DESC);
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
    embedding TEXT DEFAULT '',
    shard_id TEXT NOT NULL DEFAULT '0',
    embedding_model TEXT NOT NULL DEFAULT '',
    embedding_dim INTEGER NOT NULL DEFAULT 256,
    embedding_status TEXT NOT NULL DEFAULT 'indexed',
    embedding_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_path ON knowledge_files(path);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_shard ON knowledge_files(shard_id, embedding_status);
CREATE TABLE IF NOT EXISTS embedding_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'local',
    provider_id TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    dimension INTEGER NOT NULL DEFAULT 256,
    shard_count INTEGER NOT NULL DEFAULT 8,
    auto_rebuild INTEGER NOT NULL DEFAULT 1,
    ann_enabled INTEGER NOT NULL DEFAULT 1,
    probe_count INTEGER NOT NULL DEFAULT 2,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vector_shards (
    shard_id TEXT PRIMARY KEY,
    model TEXT NOT NULL DEFAULT '',
    dimension INTEGER NOT NULL DEFAULT 256,
    documents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idle',
    centroid TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id TEXT PRIMARY KEY,
    centroid TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'local',
    representative TEXT NOT NULL DEFAULT '',
    documents INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS knowledge_cluster_members (
    cluster_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    similarity REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (cluster_id, doc_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_members_doc ON knowledge_cluster_members(doc_id);
CREATE TABLE IF NOT EXISTS knowledge_cluster_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cluster_threshold REAL NOT NULL DEFAULT 0.62,
    dedup_threshold REAL NOT NULL DEFAULT 0.92,
    last_recomputed_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS knowledge_dedup_candidates (
    id TEXT PRIMARY KEY,
    doc_a TEXT NOT NULL,
    doc_b TEXT NOT NULL,
    similarity REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_knowledge_dedup_status ON knowledge_dedup_candidates(status);
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
CREATE TABLE IF NOT EXISTS message_aux (
    message_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_aux_message ON message_aux(message_id);
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
CREATE TABLE IF NOT EXISTS sync_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    device_id TEXT NOT NULL DEFAULT '',
    encryption_enabled INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER NOT NULL DEFAULT 0,
    active_key_version INTEGER NOT NULL DEFAULT 0,
    rotated_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_key_versions (
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    salt TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    iterations INTEGER NOT NULL DEFAULT 100000,
    active INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    rotated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, version)
);
CREATE INDEX IF NOT EXISTS idx_sync_key_versions_active
    ON sync_key_versions(device_id, active DESC, version DESC);
CREATE TABLE IF NOT EXISTS sync_paired_devices (
    device_id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    pairing_code TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    paired_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_paired_devices_paired
    ON sync_paired_devices(paired_at DESC);
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
    trigger_condition TEXT NOT NULL DEFAULT '',
    channels TEXT NOT NULL DEFAULT '["http"]',
    recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300,
    circuit_opened_at INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run_at INTEGER NOT NULL DEFAULT 0,
    last_status INTEGER NOT NULL DEFAULT 0,
    last_message TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    auto_disable_after INTEGER NOT NULL DEFAULT 3,
    template_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_webhook_rules_enabled ON webhook_rules(enabled, interval_seconds);
CREATE TABLE IF NOT EXISTS webhook_template_versions (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE (rule_id, version)
);
CREATE INDEX IF NOT EXISTS idx_webhook_template_versions_rule
    ON webhook_template_versions(rule_id, version DESC);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'http',
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
CREATE TABLE IF NOT EXISTS webhook_channel_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    email_enabled INTEGER NOT NULL DEFAULT 0,
    email_from TEXT NOT NULL DEFAULT '',
    email_to TEXT NOT NULL DEFAULT '',
    smtp_host TEXT NOT NULL DEFAULT '',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_user TEXT NOT NULL DEFAULT '',
    smtp_password TEXT NOT NULL DEFAULT '',
    notification_enabled INTEGER NOT NULL DEFAULT 0,
    notification_title TEXT NOT NULL DEFAULT 'AI Workbench webhook',
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS event_logs (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '{}',
    source TEXT NOT NULL DEFAULT 'workbench',
    device_id TEXT NOT NULL DEFAULT '',
    schema_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'accepted',
    rejected_reason TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_event_created ON event_logs(event, created_at DESC);
CREATE TABLE IF NOT EXISTS event_schemas (
    event TEXT PRIMARY KEY,
    schema TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS event_forwards (
    id TEXT PRIMARY KEY,
    event_log_id TEXT NOT NULL,
    target_url TEXT NOT NULL,
    target_token TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_status INTEGER NOT NULL DEFAULT 0,
    last_message TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_forwards_due ON event_forwards(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS event_bus_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    forward_enabled INTEGER NOT NULL DEFAULT 0,
    forward_url TEXT NOT NULL DEFAULT '',
    forward_token TEXT NOT NULL DEFAULT '',
    retention_days INTEGER NOT NULL DEFAULT 30,
    max_logs INTEGER NOT NULL DEFAULT 500,
    schema_strict INTEGER NOT NULL DEFAULT 1,
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
CREATE TABLE IF NOT EXISTS fsm_nodes (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    node_key TEXT NOT NULL,
    agent TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    context_json TEXT NOT NULL DEFAULT '{}',
    trace_id TEXT,
    temp_file_paths TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(run_id, node_key)
);
CREATE INDEX IF NOT EXISTS idx_fsm_nodes_run ON fsm_nodes(run_id, created_at);
CREATE TABLE IF NOT EXISTS run_metrics (
    run_id TEXT PRIMARY KEY,
    trace_id TEXT,
    kind TEXT NOT NULL DEFAULT 'workflow',
    started_at INTEGER,
    ended_at INTEGER,
    node_count INTEGER DEFAULT 0,
    hitl_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    status TEXT
);
CREATE TABLE IF NOT EXISTS agent_catalog (
    id TEXT PRIMARY KEY,
    division TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'slate',
    developer_instructions TEXT NOT NULL DEFAULT '',
    tools TEXT NOT NULL DEFAULT '[]',
    source_url TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_agent_catalog_division ON agent_catalog(division);
CREATE TABLE IF NOT EXISTS team_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    agent_slugs TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cli_tools (
    bin TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    detected INTEGER NOT NULL DEFAULT 0,
    last_checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS delivery_runs (
    run_id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL DEFAULT '',
    command TEXT NOT NULL DEFAULT '',
    exit_code INTEGER,
    started_at INTEGER NOT NULL DEFAULT 0,
    finished_at INTEGER,
    gate_result TEXT,
    fix_round INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_started
    ON delivery_runs(started_at DESC);
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
    pub project_id: Option<String>,
    pub is_dod: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub revenue: f64,
    pub status: String,
    pub journey_stage: String,
    pub journey_doc_path: Option<String>,
    pub created_at: i64,
    pub sort_order: i64,
    pub material: String,
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
    pub last_referenced_at: Option<i64>,
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
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub priority: i64,
    pub is_active: bool,
    pub api_key_encrypted: bool,
    pub timeout_secs: i64,
    pub retry_count: i64,
    pub retry_delay_secs: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelMeta {
    pub id: String,
    pub owned_by: String,
    pub context_window: i64,
    pub input_price_per_mtok: f64,
    pub output_price_per_mtok: f64,
    pub rate_tpm: i64,
    pub rate_rpm: i64,
    pub is_favorite: bool,
    pub last_used_at: i64,
    pub fetched_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelMetaPatch {
    pub context_window: i64,
    pub input_price_per_mtok: f64,
    pub output_price_per_mtok: f64,
    pub rate_tpm: i64,
    pub rate_rpm: i64,
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
pub struct AgentCatalogEntry {
    pub id: String,
    pub division: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub emoji: String,
    pub color: String,
    pub developer_instructions: String,
    pub tools: Vec<String>,
    pub source_url: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCatalogInput {
    pub division: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub emoji: String,
    pub color: String,
    pub developer_instructions: String,
    pub tools: Vec<String>,
    pub source_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamPreset {
    pub id: String,
    pub name: String,
    pub agent_slugs: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliToolDetection {
    pub bin: String,
    pub label: String,
    pub detected: bool,
    pub last_checked_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryRun {
    pub run_id: String,
    pub project_path: String,
    pub command: String,
    pub exit_code: Option<i64>,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub gate_result: Option<Value>,
    pub fix_round: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPromptVersion {
    pub id: String,
    pub agent_id: String,
    pub content: String,
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
pub struct SyncCredential {
    pub device_id: String,
    pub encryption_enabled: bool,
    pub confirmed: bool,
    pub active_key_version: i64,
    pub rotated_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncKeyVersion {
    pub device_id: String,
    pub version: i64,
    pub salt: String,
    pub fingerprint: String,
    pub algorithm: String,
    pub iterations: i64,
    pub active: bool,
    pub created_at: i64,
    pub rotated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPairedDevice {
    pub device_id: String,
    pub fingerprint: String,
    pub pairing_code: String,
    pub version: i64,
    pub paired_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncKeyStatus {
    pub device_id: String,
    pub encryption_enabled: bool,
    pub confirmed: bool,
    pub active_key_version: i64,
    pub active_salt: String,
    pub active_fingerprint: String,
    pub iterations: i64,
    pub rotated_at: i64,
    pub updated_at: i64,
    pub paired_devices: Vec<SyncPairedDevice>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PassphraseStrength {
    pub score: u8,
    pub label: String,
    pub feedback: Vec<String>,
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
    #[serde(rename = "sourceKind")]
    pub source_kind: String,
    #[serde(rename = "sourceFile")]
    pub source_file: String,
    #[serde(rename = "vaultPath")]
    pub vault_path: String,
    pub score: f64,
    pub vector_score: f64,
    pub shard_id: String,
    pub embedding_model: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagSourceFilter {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub file_paths: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingConfig {
    pub mode: String,
    pub provider_id: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub dimension: usize,
    pub shard_count: usize,
    pub auto_rebuild: bool,
    pub ann_enabled: bool,
    pub probe_count: usize,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorShardRecord {
    pub shard_id: String,
    pub model: String,
    pub dimension: usize,
    pub documents: i64,
    pub status: String,
    pub centroid: String,
    pub updated_at: i64,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogRecord {
    pub id: String,
    pub event: String,
    pub context: String,
    pub source: String,
    pub device_id: String,
    pub schema_version: i64,
    pub status: String,
    pub rejected_reason: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSchema {
    pub event: String,
    pub schema: String,
    pub enabled: bool,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventForwardRecord {
    pub id: String,
    pub event_log_id: String,
    pub target_url: String,
    pub target_token: String,
    pub status: String,
    pub attempts: i64,
    pub next_attempt_at: i64,
    pub last_status: i64,
    pub last_message: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventBusConfig {
    pub forward_enabled: bool,
    pub forward_url: String,
    pub forward_token: String,
    pub retention_days: i64,
    pub max_logs: i64,
    pub schema_strict: bool,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventBusStats {
    pub total: i64,
    pub accepted: i64,
    pub rejected: i64,
    pub forwarded: i64,
    pub pending: i64,
    pub failed: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventEmitResult {
    pub event: String,
    pub recorded: bool,
    pub validated: bool,
    pub rejected_reason: String,
    pub forwarded: i64,
    pub webhook_deliveries: i64,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn event_schema_validates(schema: &str, context: &Value) -> Result<(), String> {
    let schema: Value =
        serde_json::from_str(schema).map_err(|e| format!("Invalid schema JSON: {}", e))?;
    let obj = schema
        .as_object()
        .ok_or_else(|| "Event schema must be a JSON object".to_string())?;
    let context_obj = context
        .as_object()
        .ok_or_else(|| "Event context must be a JSON object".to_string())?;
    if let Some(required) = obj.get("required").and_then(|value| value.as_array()) {
        for field in required {
            let name = field
                .as_str()
                .ok_or_else(|| "required entries must be strings".to_string())?;
            if !context_obj.contains_key(name) {
                return Err(format!("Missing required field '{}'", name));
            }
        }
    }
    if let Some(properties) = obj.get("properties").and_then(|value| value.as_object()) {
        for (name, spec) in properties {
            let expected = spec
                .get("type")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            if let Some(value) = context_obj.get(name) {
                let matches = match expected {
                    "string" => value.is_string(),
                    "number" => value.is_number(),
                    "boolean" => value.is_boolean(),
                    "object" => value.is_object(),
                    "array" => value.is_array(),
                    "null" => value.is_null(),
                    "" => true,
                    _ => {
                        return Err(format!(
                            "Unsupported type '{}' for field '{}'",
                            expected, name
                        ))
                    }
                };
                if !matches {
                    return Err(format!("Field '{}' must be {}", name, expected));
                }
            }
        }
    }
    Ok(())
}

pub fn validate_event_context(
    conn: &Connection,
    event: &str,
    context: &Value,
) -> Result<(bool, String, i64), String> {
    let schema = get_event_schema(conn, event).map_err(|e| e.to_string())?;
    match schema {
        Some(schema) if schema.enabled => match event_schema_validates(&schema.schema, context) {
            Ok(()) => Ok((true, String::new(), schema.updated_at.max(1))),
            Err(reason) => Ok((false, reason, schema.updated_at.max(1))),
        },
        Some(schema) => Ok((true, String::new(), schema.updated_at.max(1))),
        None => Ok((true, String::new(), 1)),
    }
}

pub fn get_event_schema(conn: &Connection, event: &str) -> Result<Option<EventSchema>> {
    conn.query_row(
        "SELECT event, schema, enabled, updated_at FROM event_schemas WHERE event = ?1",
        params![event],
        |row| {
            Ok(EventSchema {
                event: row.get(0)?,
                schema: row.get(1)?,
                enabled: row.get::<_, i64>(2)? != 0,
                updated_at: row.get(3)?,
            })
        },
    )
    .optional()
}

pub fn list_event_schemas(conn: &Connection) -> Result<Vec<EventSchema>> {
    let mut stmt = conn.prepare(
        "SELECT event, schema, enabled, updated_at FROM event_schemas ORDER BY event ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(EventSchema {
            event: row.get(0)?,
            schema: row.get(1)?,
            enabled: row.get::<_, i64>(2)? != 0,
            updated_at: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn set_event_schema(
    conn: &Connection,
    event: &str,
    schema: &str,
    enabled: bool,
) -> Result<EventSchema> {
    let parsed: Value = serde_json::from_str(schema)
        .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
    if !parsed.is_object() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Event schema must be a JSON object".to_string(),
        ));
    }
    conn.execute(
        "INSERT INTO event_schemas (event, schema, enabled, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(event) DO UPDATE SET
           schema = excluded.schema,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at",
        params![event, schema, enabled as i64, now_millis()],
    )?;
    get_event_schema(conn, event)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_event_bus_config(conn: &Connection) -> Result<EventBusConfig> {
    let row = conn.query_row(
        "SELECT forward_enabled, forward_url, forward_token, retention_days, max_logs,
                schema_strict, updated_at
         FROM event_bus_config WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        },
    );
    match row {
        Ok((
            forward_enabled,
            forward_url,
            forward_token,
            retention_days,
            max_logs,
            schema_strict,
            updated_at,
        )) => Ok(EventBusConfig {
            forward_enabled: forward_enabled != 0,
            forward_url,
            forward_token,
            retention_days,
            max_logs,
            schema_strict: schema_strict != 0,
            updated_at,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(EventBusConfig {
            forward_enabled: false,
            forward_url: String::new(),
            forward_token: String::new(),
            retention_days: 30,
            max_logs: 500,
            schema_strict: true,
            updated_at: 0,
        }),
        Err(e) => Err(e),
    }
}

pub fn set_event_bus_config(
    conn: &Connection,
    forward_enabled: bool,
    forward_url: &str,
    forward_token: &str,
    retention_days: i64,
    max_logs: i64,
    schema_strict: bool,
) -> Result<EventBusConfig> {
    let days = retention_days.clamp(1, 3650);
    let max_logs = max_logs.clamp(10, 100_000);
    conn.execute(
        "INSERT INTO event_bus_config
           (id, forward_enabled, forward_url, forward_token, retention_days, max_logs,
            schema_strict, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           forward_enabled = excluded.forward_enabled,
           forward_url = excluded.forward_url,
           forward_token = excluded.forward_token,
           retention_days = excluded.retention_days,
           max_logs = excluded.max_logs,
           schema_strict = excluded.schema_strict,
           updated_at = excluded.updated_at",
        params![
            forward_enabled as i64,
            forward_url.trim(),
            forward_token,
            days,
            max_logs,
            schema_strict as i64,
            now_millis(),
        ],
    )?;
    get_event_bus_config(conn)
}

fn map_event_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventLogRecord> {
    Ok(EventLogRecord {
        id: row.get(0)?,
        event: row.get(1)?,
        context: row.get(2)?,
        source: row.get(3)?,
        device_id: row.get(4)?,
        schema_version: row.get(5)?,
        status: row.get(6)?,
        rejected_reason: row.get(7)?,
        created_at: row.get(8)?,
    })
}

const EVENT_LOG_COLUMNS: &str =
    "id, event, context, source, device_id, schema_version, status, rejected_reason, created_at";

pub fn get_event_log(conn: &Connection, id: &str) -> Result<Option<EventLogRecord>> {
    conn.query_row(
        &format!("SELECT {} FROM event_logs WHERE id = ?1", EVENT_LOG_COLUMNS),
        params![id],
        map_event_log,
    )
    .optional()
}

pub fn record_event_log(
    conn: &Connection,
    event: &str,
    context: &Value,
    source: &str,
    device_id: &str,
) -> Result<EventLogRecord> {
    let context_json = serde_json::to_string(context).unwrap_or_else(|_| "{}".to_string());
    let (validated, reason, version) = validate_event_context(conn, event, context)
        .map_err(rusqlite::Error::InvalidParameterName)?;
    let status = if validated { "accepted" } else { "rejected" };
    let now = now_millis();
    let id = uid();
    conn.execute(
        "INSERT INTO event_logs
           (id, event, context, source, device_id, schema_version, status, rejected_reason, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            event,
            context_json,
            source,
            device_id,
            version,
            status,
            reason,
            now
        ],
    )?;
    if let Ok(config) = get_event_bus_config(conn) {
        let _ = prune_event_logs(conn, config.retention_days, config.max_logs);
    }
    get_event_log(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn prune_event_logs(
    conn: &Connection,
    retention_days: i64,
    max_logs: i64,
) -> Result<(i64, i64)> {
    let now = now_millis();
    let mut removed_by_age = 0_i64;
    if retention_days > 0 {
        let cutoff = now.saturating_sub(retention_days.saturating_mul(86_400_000));
        removed_by_age = conn.execute(
            "DELETE FROM event_logs WHERE created_at < ?1",
            params![cutoff],
        )? as i64;
    }
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM event_logs", [], |row| row.get(0))?;
    let excess = total.saturating_sub(max_logs.max(0));
    let mut removed_by_count = 0_i64;
    if excess > 0 {
        let mut stmt =
            conn.prepare("SELECT id FROM event_logs ORDER BY created_at ASC, rowid ASC LIMIT ?1")?;
        let ids: Vec<String> = stmt
            .query_map(params![excess], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for id in ids {
            removed_by_count +=
                conn.execute("DELETE FROM event_logs WHERE id = ?1", params![id])? as i64;
        }
    }
    Ok((removed_by_age, removed_by_count))
}

pub fn list_event_logs(
    conn: &Connection,
    limit: i64,
    event_filter: &str,
) -> Result<Vec<EventLogRecord>> {
    let limit = limit.clamp(1, 500);
    let event_filter = event_filter.trim();
    let mut stmt = if event_filter.is_empty() {
        conn.prepare(&format!(
            "SELECT {} FROM event_logs ORDER BY created_at DESC, rowid DESC LIMIT ?1",
            EVENT_LOG_COLUMNS
        ))?
    } else {
        conn.prepare(&format!(
            "SELECT {} FROM event_logs WHERE event = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2",
            EVENT_LOG_COLUMNS
        ))?
    };
    let rows = if event_filter.is_empty() {
        stmt.query_map(params![limit], map_event_log)?
    } else {
        stmt.query_map(params![event_filter, limit], map_event_log)?
    };
    rows.collect()
}

pub fn clear_event_logs(conn: &Connection, status_filter: &str) -> Result<i64> {
    let removed = if status_filter.trim().is_empty() {
        conn.execute("DELETE FROM event_logs", [])?
    } else {
        conn.execute(
            "DELETE FROM event_logs WHERE status = ?1",
            params![status_filter.trim()],
        )?
    };
    Ok(removed as i64)
}

fn map_event_forward(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventForwardRecord> {
    Ok(EventForwardRecord {
        id: row.get(0)?,
        event_log_id: row.get(1)?,
        target_url: row.get(2)?,
        target_token: row.get(3)?,
        status: row.get(4)?,
        attempts: row.get(5)?,
        next_attempt_at: row.get(6)?,
        last_status: row.get(7)?,
        last_message: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

const EVENT_FORWARD_COLUMNS: &str =
    "id, event_log_id, target_url, target_token, status, attempts, next_attempt_at, \
     last_status, last_message, created_at, updated_at";

pub fn get_event_forward(conn: &Connection, id: &str) -> Result<Option<EventForwardRecord>> {
    conn.query_row(
        &format!(
            "SELECT {} FROM event_forwards WHERE id = ?1",
            EVENT_FORWARD_COLUMNS
        ),
        params![id],
        map_event_forward,
    )
    .optional()
}

pub fn enqueue_event_forward(
    conn: &Connection,
    event_log_id: &str,
    target_url: &str,
    target_token: &str,
) -> Result<EventForwardRecord> {
    let now = now_millis();
    let id = uid();
    conn.execute(
        "INSERT INTO event_forwards
           (id, event_log_id, target_url, target_token, status, attempts, next_attempt_at,
            last_status, last_message, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'queued', 0, ?5, 0, '', ?5, ?5)",
        params![id, event_log_id, target_url, target_token, now],
    )?;
    get_event_forward(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn claim_due_event_forwards(
    conn: &Connection,
    now_ms: i64,
    limit: i64,
) -> Result<Vec<EventForwardRecord>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM event_forwards
         WHERE status = 'queued' AND next_attempt_at <= ?1
         ORDER BY next_attempt_at ASC, created_at ASC
         LIMIT ?2",
        EVENT_FORWARD_COLUMNS
    ))?;
    let rows = stmt.query_map(params![now_ms, limit], map_event_forward)?;
    let ids: Vec<String> = rows.filter_map(Result::ok).map(|f| f.id).collect();
    for id in &ids {
        conn.execute(
            "UPDATE event_forwards SET status = 'delivering', updated_at = ?1 WHERE id = ?2",
            params![now_millis(), id],
        )?;
    }
    Ok(ids
        .into_iter()
        .filter_map(|id| get_event_forward(conn, &id).ok().flatten())
        .collect())
}

pub fn complete_event_forward(
    conn: &Connection,
    id: &str,
    status: &str,
    last_status: i64,
    message: &str,
    attempts: i64,
    next_attempt_at: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE event_forwards
         SET status = ?1, last_status = ?2, last_message = ?3, attempts = ?4,
             next_attempt_at = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            status,
            last_status,
            message,
            attempts,
            next_attempt_at,
            now_millis(),
            id
        ],
    )?;
    Ok(())
}

pub fn retry_event_forward(conn: &Connection, id: &str) -> Result<EventForwardRecord> {
    let updated = conn.execute(
        "UPDATE event_forwards
         SET attempts = 0, status = 'queued', last_message = '', next_attempt_at = ?1, updated_at = ?1
         WHERE id = ?2",
        params![now_millis(), id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    get_event_forward(conn, id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_event_forwards(
    conn: &Connection,
    limit: i64,
    status_filter: &str,
) -> Result<Vec<EventForwardRecord>> {
    let limit = limit.clamp(1, 200);
    let status_filter = status_filter.trim();
    let mut stmt = if status_filter.is_empty() {
        conn.prepare(&format!(
            "SELECT {} FROM event_forwards ORDER BY created_at DESC LIMIT ?1",
            EVENT_FORWARD_COLUMNS
        ))?
    } else {
        conn.prepare(&format!(
            "SELECT {} FROM event_forwards WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2",
            EVENT_FORWARD_COLUMNS
        ))?
    };
    let rows = if status_filter.is_empty() {
        stmt.query_map(params![limit], map_event_forward)?
    } else {
        stmt.query_map(params![status_filter, limit], map_event_forward)?
    };
    rows.collect()
}

pub fn delete_event_forward(conn: &Connection, id: &str) -> Result<()> {
    let removed = conn.execute("DELETE FROM event_forwards WHERE id = ?1", params![id])?;
    if removed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn clear_event_forwards(conn: &Connection, status_filter: &str) -> Result<i64> {
    let removed = if status_filter.trim().is_empty() {
        conn.execute("DELETE FROM event_forwards", [])?
    } else {
        conn.execute(
            "DELETE FROM event_forwards WHERE status = ?1",
            params![status_filter.trim()],
        )?
    };
    Ok(removed as i64)
}

pub fn get_event_bus_stats(conn: &Connection) -> Result<EventBusStats> {
    let mut logs = conn.prepare("SELECT status, COUNT(*) FROM event_logs GROUP BY status")?;
    let mut total = 0_i64;
    let mut accepted = 0_i64;
    let mut rejected = 0_i64;
    for row in logs.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })? {
        let (status, count) = row?;
        total += count;
        match status.as_str() {
            "accepted" => accepted = count,
            "rejected" => rejected = count,
            _ => {}
        }
    }
    let mut forwards =
        conn.prepare("SELECT status, COUNT(*) FROM event_forwards GROUP BY status")?;
    let mut forwarded = 0_i64;
    let mut pending = 0_i64;
    let mut failed = 0_i64;
    for row in forwards.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })? {
        let (status, count) = row?;
        match status.as_str() {
            "success" => forwarded = count,
            "queued" | "delivering" => pending += count,
            "dead" | "failed" => failed += count,
            _ => {}
        }
    }
    Ok(EventBusStats {
        total,
        accepted,
        rejected,
        forwarded,
        pending,
        failed,
    })
}

pub fn init_connection(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    migrate_updated_at(&conn)?;
    migrate_project_sort_order(&conn)?;
    migrate_project_material(&conn)?;
    migrate_project_journey(&conn)?;
    migrate_error_log_device(&conn)?;
    migrate_version_parent(&conn)?;
    migrate_vault_watch_targets(&conn)?;
    migrate_vault_watch_event_stats(&conn)?;
    migrate_knowledge_vault_path(&conn)?;
    migrate_knowledge_embedding(&conn)?;
    migrate_vector_index(&conn)?;
    migrate_knowledge_clusters(&conn)?;
    migrate_provider_model(&conn)?;
    migrate_provider_priority(&conn)?;
    migrate_provider_stream_config(&conn)?;
    migrate_provider_api_key_encryption(&conn)?;
    migrate_vault_index_queue_priority(&conn)?;
    migrate_quick_prompt_order(&conn)?;
    migrate_webhook_secret_retries(&conn)?;
    migrate_webhook_trigger_event(&conn)?;
    migrate_webhook_cooldown(&conn)?;
    migrate_webhook_circuit_breaker(&conn)?;
    migrate_webhook_trigger_condition(&conn)?;
    migrate_webhook_channels_recovery(&conn)?;
    migrate_webhook_template_version(&conn)?;
    migrate_session_pinned(&conn)?;
    migrate_session_archived(&conn)?;
    migrate_task_completed_at(&conn)?;
    migrate_task_project(&conn)?;
    migrate_schedule_event_date(&conn)?;
    migrate_thought_last_referenced(&conn)?;
    migrate_fsm_nodes(&conn)?;
    seed_if_empty(&conn)?;
    Ok(conn)
}

fn migrate_fsm_nodes(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS fsm_nodes (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            node_key TEXT NOT NULL,
            agent TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            context_json TEXT NOT NULL DEFAULT '{}',
            trace_id TEXT,
            temp_file_paths TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(run_id, node_key)
        );
        CREATE INDEX IF NOT EXISTS idx_fsm_nodes_run ON fsm_nodes(run_id, created_at);
        CREATE TABLE IF NOT EXISTS run_metrics (
            run_id TEXT PRIMARY KEY,
            trace_id TEXT,
            kind TEXT NOT NULL DEFAULT 'workflow',
            started_at INTEGER,
            ended_at INTEGER,
            node_count INTEGER DEFAULT 0,
            hitl_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            status TEXT
        );",
    )?;
    Ok(())
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

fn migrate_vector_index(conn: &Connection) -> Result<()> {
    for (column, definition) in [
        ("shard_id", "TEXT NOT NULL DEFAULT '0'"),
        ("embedding_model", "TEXT NOT NULL DEFAULT ''"),
        ("embedding_dim", "INTEGER NOT NULL DEFAULT 256"),
        ("embedding_status", "TEXT NOT NULL DEFAULT 'indexed'"),
        ("embedding_error", "TEXT NOT NULL DEFAULT ''"),
    ] {
        if !column_exists(conn, "knowledge_files", column)? {
            conn.execute_batch(&format!(
                "ALTER TABLE knowledge_files ADD COLUMN {column} {definition};"
            ))?;
        }
    }
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_files_shard ON knowledge_files(shard_id, embedding_status)",
        [],
    )?;
    for (table, column, definition) in [
        (
            "embedding_config",
            "ann_enabled",
            "ALTER TABLE embedding_config ADD COLUMN ann_enabled INTEGER NOT NULL DEFAULT 1",
        ),
        (
            "embedding_config",
            "probe_count",
            "ALTER TABLE embedding_config ADD COLUMN probe_count INTEGER NOT NULL DEFAULT 2",
        ),
        (
            "vector_shards",
            "centroid",
            "ALTER TABLE vector_shards ADD COLUMN centroid TEXT NOT NULL DEFAULT ''",
        ),
    ] {
        if !column_exists(conn, table, column)? {
            conn.execute_batch(definition)?;
        }
    }
    let shard_count: Option<i64> = conn
        .query_row(
            "SELECT shard_count FROM embedding_config WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()?;
    let shard_count = shard_count.unwrap_or(8).clamp(1, 64) as usize;
    seed_vector_shards(conn, shard_count, "local", 256)?;
    Ok(())
}

fn migrate_knowledge_clusters(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO knowledge_cluster_config (id, cluster_threshold, dedup_threshold, last_recomputed_at)
         VALUES (1, 0.62, 0.92, 0)",
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

fn migrate_provider_stream_config(conn: &Connection) -> Result<()> {
    for (column, definition) in [
        ("timeout_secs", "INTEGER NOT NULL DEFAULT 30"),
        ("retry_count", "INTEGER NOT NULL DEFAULT 1"),
        ("retry_delay_secs", "INTEGER NOT NULL DEFAULT 1"),
        ("api_key_encrypted", "INTEGER NOT NULL DEFAULT 0"),
    ] {
        if !column_exists(conn, "providers", column)? {
            conn.execute_batch(&format!(
                "ALTER TABLE providers ADD COLUMN {column} {definition};"
            ))?;
        }
    }
    Ok(())
}

fn migrate_provider_api_key_encryption(conn: &Connection) -> Result<()> {
    conn.execute(
        "UPDATE providers SET api_key_encrypted = 0 WHERE api_key_encrypted IS NULL",
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

fn migrate_webhook_trigger_condition(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "trigger_condition")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN trigger_condition TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn migrate_webhook_channels_recovery(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "channels")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN channels TEXT NOT NULL DEFAULT '[\"http\"]';",
        )?;
    }
    if !column_exists(conn, "webhook_rules", "recovery_backoff_seconds")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300;",
        )?;
    }
    if !column_exists(conn, "webhook_rules", "circuit_opened_at")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN circuit_opened_at INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if !column_exists(conn, "webhook_deliveries", "channel")? {
        conn.execute_batch(
            "ALTER TABLE webhook_deliveries ADD COLUMN channel TEXT NOT NULL DEFAULT 'http';",
        )?;
    }
    Ok(())
}

fn migrate_webhook_template_version(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "webhook_rules", "template_version")? {
        conn.execute_batch(
            "ALTER TABLE webhook_rules ADD COLUMN template_version INTEGER NOT NULL DEFAULT 1;",
        )?;
    }
    conn.execute(
        "UPDATE webhook_rules SET template_version = 1 WHERE template_version IS NULL",
        [],
    )?;
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

fn migrate_thought_last_referenced(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "thoughts", "last_referenced_at")? {
        conn.execute_batch("ALTER TABLE thoughts ADD COLUMN last_referenced_at INTEGER DEFAULT 0")?;
    }
    Ok(())
}

fn migrate_project_sort_order(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "projects", "sort_order")? {
        conn.execute_batch(
            "ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;",
        )?;
        conn.execute_batch(
            "UPDATE projects SET sort_order = (
                SELECT COUNT(*) FROM projects p2
                WHERE p2.created_at > projects.created_at
                   OR (p2.created_at = projects.created_at AND p2.rowid > projects.rowid)
            );",
        )?;
    }
    Ok(())
}

fn migrate_project_material(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "projects", "material")? {
        conn.execute_batch("ALTER TABLE projects ADD COLUMN material TEXT NOT NULL DEFAULT '';")?;
    }
    Ok(())
}

fn migrate_project_journey(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "projects", "journey_stage")? {
        conn.execute_batch(
            "ALTER TABLE projects ADD COLUMN journey_stage TEXT NOT NULL DEFAULT 'idea';",
        )?;
    }
    if !column_exists(conn, "projects", "journey_doc_path")? {
        conn.execute_batch("ALTER TABLE projects ADD COLUMN journey_doc_path TEXT;")?;
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

fn migrate_task_project(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "tasks", "project_id")? {
        conn.execute_batch(
            "ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;",
        )?;
    }
    if !column_exists(conn, "tasks", "is_dod")? {
        conn.execute_batch("ALTER TABLE tasks ADD COLUMN is_dod INTEGER NOT NULL DEFAULT 0;")?;
    }
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);")?;
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_tasks_is_dod ON tasks(is_dod);")?;
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
        "SELECT id, title, status, is_today, due_date, completed_at, created_at, project_id, is_dod FROM tasks ORDER BY created_at DESC",
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
            project_id: row.get(7)?,
            is_dod: row.get::<_, i64>(8)? != 0,
        })
    })?;
    rows.collect()
}

pub fn create_task(
    conn: &Connection,
    title: &str,
    is_today: bool,
    project_id: Option<&str>,
    is_dod: bool,
) -> Result<Task> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at, completed_at, project_id, is_dod) VALUES (?1, ?2, 'todo', ?3, NULL, ?4, NULL, ?5, ?6)",
        params![id, title, is_today as i64, now, project_id, is_dod as i64],
    )?;
    Ok(Task {
        id,
        title: title.to_string(),
        status: "todo".to_string(),
        is_today,
        due_date: None,
        completed_at: None,
        created_at: now,
        project_id: project_id.map(|p| p.to_string()),
        is_dod,
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

pub fn get_task_project(conn: &Connection, id: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT project_id FROM tasks WHERE id = ?1",
        params![id],
        |row| row.get::<_, Option<String>>(0),
    )
    .optional()
    .map(|opt| opt.flatten())
}

pub fn count_project_dod(conn: &Connection, project_id: &str) -> Result<usize> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE project_id = ?1 AND is_dod = 1 AND status <> 'done'",
        params![project_id],
        |row| row.get(0),
    )?;
    Ok(count as usize)
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

pub fn update_task_title(conn: &Connection, id: &str, title: &str) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET title = ?1 WHERE id = ?2",
        params![title, id],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )?;
    if exists == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, revenue, status, journey_stage, journey_doc_path, created_at, sort_order, material
         FROM projects ORDER BY sort_order ASC, created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            revenue: row.get(3)?,
            status: row.get(4)?,
            journey_stage: row.get(5)?,
            journey_doc_path: row.get(6)?,
            created_at: row.get(7)?,
            sort_order: row.get(8)?,
            material: row.get(9)?,
        })
    })?;
    rows.collect()
}

pub fn get_project(conn: &Connection, id: &str) -> Result<Project> {
    list_projects(conn)?
        .into_iter()
        .find(|project| project.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn create_project(conn: &Connection, name: &str, path: &str) -> Result<Project> {
    let id = uid();
    let now = now_millis();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM projects",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO projects (id, name, path, revenue, status, journey_stage, journey_doc_path, created_at, sort_order, material)
         VALUES (?1, ?2, ?3, 0.0, 'active', 'idea', NULL, ?4, ?5, '')",
        params![
            id,
            name,
            if path.is_empty() { None } else { Some(path) },
            now,
            sort_order
        ],
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
        journey_stage: "idea".to_string(),
        journey_doc_path: None,
        created_at: now,
        sort_order,
        material: String::new(),
    })
}

pub fn reorder_projects(conn: &Connection, ids: &[String]) -> Result<()> {
    for (index, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE projects SET sort_order = ?1 WHERE id = ?2",
            params![index as i64, id],
        )?;
    }
    Ok(())
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
    get_project(conn, id)
}

pub fn update_project_material(conn: &Connection, id: &str, material: &str) -> Result<Project> {
    const PROJECT_MATERIALS: [&str; 4] = ["cyan", "original", "rain", "chrome"];
    let material = if PROJECT_MATERIALS.contains(&material) {
        material.to_string()
    } else {
        String::new()
    };
    conn.execute(
        "UPDATE projects SET material = ?1 WHERE id = ?2",
        params![material, id],
    )?;
    list_projects(conn)?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_project_journey(
    conn: &Connection,
    id: &str,
    stage: &str,
    journey_doc_path: Option<String>,
) -> Result<Project> {
    if !journey::stage_valid(stage) {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "journey stage: {stage}"
        )));
    }
    let current = get_project(conn, id)?;
    if !journey::transition_allowed(&current.journey_stage, stage) {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "journey transition: {} -> {stage}",
            current.journey_stage
        )));
    }
    conn.execute(
        "UPDATE projects SET journey_stage = ?1, journey_doc_path = ?2 WHERE id = ?3",
        params![stage, journey_doc_path, id],
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
        "SELECT id, content, tags, type, created_at, last_referenced_at FROM thoughts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Thought {
            id: row.get(0)?,
            content: row.get(1)?,
            tags: row.get(2)?,
            kind: row.get(3)?,
            created_at: row.get(4)?,
            last_referenced_at: row.get(5)?,
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
        last_referenced_at: None,
    })
}

pub fn record_thought_reference(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE thoughts SET last_referenced_at = ?1 WHERE id = ?2",
        params![now_millis(), id],
    )?;
    Ok(())
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

pub fn list_providers(conn: &Connection) -> Result<Vec<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, base_url, api_key, model, priority, is_active,
                api_key_encrypted, timeout_secs, retry_count, retry_delay_secs
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
            api_key_encrypted: row.get::<_, i64>(7)? != 0,
            timeout_secs: row.get(8)?,
            retry_count: row.get(9)?,
            retry_delay_secs: row.get(10)?,
        })
    })?;
    rows.collect()
}

pub fn get_provider(conn: &Connection, id: &str) -> Result<Option<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, base_url, api_key, model, priority, is_active,
                api_key_encrypted, timeout_secs, retry_count, retry_delay_secs
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
            api_key_encrypted: row.get::<_, i64>(7)? != 0,
            timeout_secs: row.get(8)?,
            retry_count: row.get(9)?,
            retry_delay_secs: row.get(10)?,
        })
    })?;
    rows.next().transpose()
}

#[allow(dead_code)]
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
        api_key_encrypted: false,
        timeout_secs: 30,
        retry_count: 1,
        retry_delay_secs: 1,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn create_provider_with_options(
    conn: &Connection,
    name: &str,
    base_url: &str,
    stored_api_key: &str,
    model: &str,
    api_key_encrypted: bool,
    timeout_secs: i64,
    retry_count: i64,
    retry_delay_secs: i64,
) -> Result<Provider> {
    let id = uid();
    conn.execute(
        "INSERT INTO providers (id, name, base_url, api_key, model, is_active,
                api_key_encrypted, timeout_secs, retry_count, retry_delay_secs)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?9)",
        params![
            id,
            name,
            base_url,
            stored_api_key,
            model,
            api_key_encrypted as i64,
            timeout_secs,
            retry_count,
            retry_delay_secs
        ],
    )?;
    Ok(Provider {
        id,
        name: name.to_string(),
        base_url: base_url.to_string(),
        api_key: stored_api_key.to_string(),
        model: model.to_string(),
        priority: 0,
        is_active: false,
        api_key_encrypted,
        timeout_secs,
        retry_count,
        retry_delay_secs,
    })
}

pub fn update_provider_stream_config(
    conn: &Connection,
    id: &str,
    timeout_secs: i64,
    retry_count: i64,
    retry_delay_secs: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE providers SET timeout_secs = ?1, retry_count = ?2, retry_delay_secs = ?3 WHERE id = ?4",
        params![timeout_secs, retry_count, retry_delay_secs, id],
    )?;
    Ok(())
}

pub fn upsert_provider_models(
    conn: &Connection,
    provider_id: &str,
    models: &[(String, Option<String>)],
) -> Result<usize> {
    let now = now_millis();
    let mut changed = 0usize;
    for (model_id, owned_by) in models {
        changed += conn.execute(
            "INSERT INTO model_metadata (provider_id, model_id, owned_by, fetched_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(provider_id, model_id) DO UPDATE SET
                owned_by = excluded.owned_by,
                fetched_at = excluded.fetched_at,
                updated_at = excluded.updated_at",
            params![
                provider_id,
                model_id,
                owned_by.clone().unwrap_or_default(),
                now
            ],
        )?;
    }
    Ok(changed)
}

pub fn list_cached_provider_models(conn: &Connection, provider_id: &str) -> Result<Vec<ModelMeta>> {
    let mut stmt = conn.prepare(
        "SELECT model_id, owned_by, context_window, input_price_per_mtok,
                output_price_per_mtok, rate_tpm, rate_rpm, is_favorite,
                last_used_at, fetched_at, updated_at
         FROM model_metadata
         WHERE provider_id = ?1
         ORDER BY is_favorite DESC, last_used_at DESC, model_id ASC",
    )?;
    let rows = stmt.query_map(params![provider_id], |row| {
        Ok(ModelMeta {
            id: row.get(0)?,
            owned_by: row.get(1)?,
            context_window: row.get(2)?,
            input_price_per_mtok: row.get(3)?,
            output_price_per_mtok: row.get(4)?,
            rate_tpm: row.get(5)?,
            rate_rpm: row.get(6)?,
            is_favorite: row.get::<_, i64>(7)? != 0,
            last_used_at: row.get(8)?,
            fetched_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn update_model_meta(
    conn: &Connection,
    provider_id: &str,
    model_id: &str,
    patch: ModelMetaPatch,
) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO model_metadata (provider_id, model_id, context_window,
                input_price_per_mtok, output_price_per_mtok, rate_tpm, rate_rpm, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(provider_id, model_id) DO UPDATE SET
            context_window = excluded.context_window,
            input_price_per_mtok = excluded.input_price_per_mtok,
            output_price_per_mtok = excluded.output_price_per_mtok,
            rate_tpm = excluded.rate_tpm,
            rate_rpm = excluded.rate_rpm,
            updated_at = excluded.updated_at",
        params![
            provider_id,
            model_id,
            patch.context_window,
            patch.input_price_per_mtok,
            patch.output_price_per_mtok,
            patch.rate_tpm,
            patch.rate_rpm,
            now
        ],
    )?;
    Ok(())
}

pub fn set_model_favorite(
    conn: &Connection,
    provider_id: &str,
    model_id: &str,
    favorite: bool,
) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO model_metadata (provider_id, model_id, is_favorite, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(provider_id, model_id) DO UPDATE SET
            is_favorite = excluded.is_favorite,
            updated_at = excluded.updated_at",
        params![provider_id, model_id, favorite as i64, now],
    )?;
    Ok(())
}

pub fn touch_model_usage(conn: &Connection, provider_id: &str, model_id: &str) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO model_metadata (provider_id, model_id, last_used_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)
         ON CONFLICT(provider_id, model_id) DO UPDATE SET
            last_used_at = excluded.last_used_at,
            updated_at = excluded.updated_at",
        params![provider_id, model_id, now],
    )?;
    Ok(())
}

pub fn replace_providers(conn: &Connection, providers: &[Provider]) -> Result<usize> {
    conn.execute("DELETE FROM providers", [])?;
    let mut inserted = 0;
    for provider in providers {
        let id = uid();
        conn.execute(
            "INSERT INTO providers (id, name, base_url, api_key, model, priority, is_active,
                    api_key_encrypted, timeout_secs, retry_count, retry_delay_secs)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                provider.name,
                provider.base_url,
                provider.api_key,
                provider.model,
                provider.priority.max(0),
                provider.is_active as i64,
                provider.api_key_encrypted as i64,
                provider.timeout_secs.clamp(1, 300),
                provider.retry_count.clamp(0, 5),
                provider.retry_delay_secs.clamp(0, 30),
            ],
        )?;
        inserted += 1;
    }
    Ok(inserted)
}

pub fn delete_provider(conn: &Connection, id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM model_metadata WHERE provider_id = ?1",
        params![id],
    )?;
    conn.execute("DELETE FROM providers WHERE id = ?1", params![id])
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

fn json_array_text(values: &[String]) -> String {
    serde_json::to_string(values).unwrap_or_else(|_| "[]".to_string())
}

fn parse_json_array_text(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn list_agent_catalog(conn: &Connection) -> Result<Vec<AgentCatalogEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, division, name, slug, COALESCE(description, ''), COALESCE(emoji, ''),
                COALESCE(color, 'slate'), COALESCE(developer_instructions, ''),
                COALESCE(tools, '[]'), COALESCE(source_url, ''), created_at, updated_at
         FROM agent_catalog
         ORDER BY division ASC, name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let tools_raw: String = row.get(8)?;
        Ok(AgentCatalogEntry {
            id: row.get(0)?,
            division: row.get(1)?,
            name: row.get(2)?,
            slug: row.get(3)?,
            description: row.get(4)?,
            emoji: row.get(5)?,
            color: row.get(6)?,
            developer_instructions: row.get(7)?,
            tools: parse_json_array_text(&tools_raw),
            source_url: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

pub fn import_agent_catalog(
    conn: &Connection,
    entries: &[AgentCatalogInput],
) -> Result<Vec<AgentCatalogEntry>> {
    let now = now_millis();
    for entry in entries {
        if entry.slug.trim().is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "empty agent slug".into(),
            ));
        }
        let tools = json_array_text(&entry.tools);
        conn.execute(
            "INSERT INTO agent_catalog
               (id, division, name, slug, description, emoji, color,
                developer_instructions, tools, source_url, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
             ON CONFLICT(slug) DO UPDATE SET
                 division = excluded.division,
                 name = excluded.name,
                 description = excluded.description,
                 emoji = excluded.emoji,
                 color = excluded.color,
                 developer_instructions = excluded.developer_instructions,
                 tools = excluded.tools,
                 source_url = excluded.source_url,
                 updated_at = excluded.updated_at",
            params![
                uid(),
                entry.division,
                entry.name,
                entry.slug,
                entry.description,
                entry.emoji,
                entry.color,
                entry.developer_instructions,
                tools,
                entry.source_url,
                now
            ],
        )?;
    }
    list_agent_catalog(conn)
}

pub fn list_team_presets(conn: &Connection) -> Result<Vec<TeamPreset>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, COALESCE(agent_slugs, '[]'), created_at, updated_at
         FROM team_presets
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let slugs_raw: String = row.get(2)?;
        Ok(TeamPreset {
            id: row.get(0)?,
            name: row.get(1)?,
            agent_slugs: parse_json_array_text(&slugs_raw),
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn create_team_preset(
    conn: &Connection,
    name: &str,
    agent_slugs: &[String],
) -> Result<TeamPreset> {
    if name.trim().is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "empty team preset name".into(),
        ));
    }
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO team_presets (id, name, agent_slugs, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, name, json_array_text(agent_slugs), now],
    )?;
    Ok(TeamPreset {
        id,
        name: name.to_string(),
        agent_slugs: agent_slugs.to_vec(),
        created_at: now,
        updated_at: now,
    })
}

pub fn update_team_preset(
    conn: &Connection,
    id: &str,
    name: &str,
    agent_slugs: &[String],
) -> Result<TeamPreset> {
    if name.trim().is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "empty team preset name".into(),
        ));
    }
    let now = now_millis();
    let changed = conn.execute(
        "UPDATE team_presets SET name = ?1, agent_slugs = ?2, updated_at = ?3 WHERE id = ?4",
        params![name, json_array_text(agent_slugs), now, id],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    list_team_presets(conn)?
        .into_iter()
        .find(|preset| preset.id == id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_team_preset(conn: &Connection, id: &str) -> Result<()> {
    let changed = conn.execute("DELETE FROM team_presets WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn list_cli_tools(conn: &Connection) -> Result<Vec<CliToolDetection>> {
    let mut stmt = conn.prepare(
        "SELECT bin, COALESCE(label, ''), detected, last_checked_at
         FROM cli_tools
         ORDER BY bin ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CliToolDetection {
            bin: row.get(0)?,
            label: row.get(1)?,
            detected: row.get::<_, i64>(2)? != 0,
            last_checked_at: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn save_cli_tool_detections(
    conn: &Connection,
    tools: &[CliToolDetection],
) -> Result<Vec<CliToolDetection>> {
    let now = now_millis();
    for tool in tools {
        if tool.bin.trim().is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "empty cli bin".into(),
            ));
        }
        conn.execute(
            "INSERT INTO cli_tools (bin, label, detected, last_checked_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(bin) DO UPDATE SET
                 label = excluded.label,
                 detected = excluded.detected,
                 last_checked_at = excluded.last_checked_at",
            params![
                tool.bin,
                tool.label,
                tool.detected,
                if tool.last_checked_at > 0 {
                    tool.last_checked_at
                } else {
                    now
                }
            ],
        )?;
    }
    list_cli_tools(conn)
}

fn delivery_run_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DeliveryRun> {
    let gate_result: Option<String> = row.get(6)?;
    Ok(DeliveryRun {
        run_id: row.get(0)?,
        project_path: row.get(1)?,
        command: row.get(2)?,
        exit_code: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        gate_result: gate_result.and_then(|json| serde_json::from_str(&json).ok()),
        fix_round: row.get(7)?,
    })
}

pub fn get_delivery_run(conn: &Connection, run_id: &str) -> Result<Option<DeliveryRun>> {
    conn.query_row(
        "SELECT run_id, project_path, command, exit_code, started_at, finished_at,
                gate_result, fix_round
         FROM delivery_runs
         WHERE run_id = ?1",
        params![run_id],
        delivery_run_from_row,
    )
    .optional()
}

pub fn list_delivery_runs(conn: &Connection, limit: i64) -> Result<Vec<DeliveryRun>> {
    let limit = limit.clamp(1, 500);
    let mut stmt = conn.prepare(
        "SELECT run_id, project_path, command, exit_code, started_at, finished_at,
                gate_result, fix_round
         FROM delivery_runs
         ORDER BY started_at DESC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], delivery_run_from_row)?;
    rows.collect()
}

pub fn record_delivery_run(conn: &Connection, run: &DeliveryRun) -> Result<DeliveryRun> {
    if run.run_id.trim().is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "empty delivery run id".into(),
        ));
    }
    if run.fix_round < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "negative delivery fix round".into(),
        ));
    }
    let gate_result = run.gate_result.as_ref().map(ToString::to_string);
    conn.execute(
        "INSERT INTO delivery_runs (
            run_id, project_path, command, exit_code, started_at, finished_at,
            gate_result, fix_round
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(run_id) DO UPDATE SET
            project_path = excluded.project_path,
            command = excluded.command,
            exit_code = excluded.exit_code,
            started_at = excluded.started_at,
            finished_at = excluded.finished_at,
            gate_result = excluded.gate_result,
            fix_round = excluded.fix_round",
        params![
            run.run_id,
            run.project_path,
            run.command,
            run.exit_code,
            run.started_at,
            run.finished_at,
            gate_result,
            run.fix_round
        ],
    )?;
    get_delivery_run(conn, &run.run_id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
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

fn ensure_sync_credential_row(conn: &Connection, device_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sync_credentials (id, device_id, encryption_enabled, confirmed,
                                       active_key_version, rotated_at, updated_at)
         VALUES (1, ?1, 0, 0, 0, 0, ?2)
         ON CONFLICT(id) DO NOTHING",
        params![device_id, now_millis()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn read_sync_credential(conn: &Connection) -> Result<SyncCredential, String> {
    let device_id: String = conn
        .query_row(
            "SELECT device_id FROM sync_credentials WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Sync credential is not initialized".to_string())?;
    ensure_sync_credential_row(conn, &device_id)?;
    conn.query_row(
        "SELECT device_id, encryption_enabled, confirmed, active_key_version, rotated_at, updated_at
         FROM sync_credentials WHERE id = 1",
        [],
        |row| {
            let encryption_enabled: i64 = row.get(1)?;
            let confirmed: i64 = row.get(2)?;
            Ok(SyncCredential {
                device_id: row.get(0)?,
                encryption_enabled: encryption_enabled != 0,
                confirmed: confirmed != 0,
                active_key_version: row.get(3)?,
                rotated_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn get_sync_credential(conn: &Connection, device_id: &str) -> Result<SyncCredential, String> {
    ensure_sync_credential_row(conn, device_id)?;
    read_sync_credential(conn)
}

pub fn register_sync_key_version(
    conn: &Connection,
    device_id: &str,
    salt_hex: &str,
    fingerprint: &str,
    algorithm: &str,
    iterations: i64,
) -> Result<SyncCredential, String> {
    ensure_sync_credential_row(conn, device_id)?;
    let now = now_millis();
    let current = read_sync_credential(conn)?;
    let version = current.active_key_version + 1;
    conn.execute(
        "UPDATE sync_key_versions SET active = 0
         WHERE device_id = ?1 AND version <> ?2",
        params![current.device_id, version],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO sync_key_versions
           (device_id, version, salt, fingerprint, algorithm, iterations, active, created_at, rotated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
        params![
            current.device_id,
            version,
            salt_hex,
            fingerprint,
            algorithm,
            iterations,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sync_credentials
         SET encryption_enabled = 1, confirmed = 1, active_key_version = ?1,
             rotated_at = ?2, updated_at = ?2
         WHERE id = 1",
        params![version, now],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        if version == 1 {
            "sync.key.registered"
        } else {
            "sync.key.rotated"
        },
        &format!("version {}", version),
        &current.device_id,
    );
    read_sync_credential(conn)
}

pub fn confirm_sync_credential(
    conn: &Connection,
    fingerprint: &str,
) -> Result<SyncCredential, String> {
    let current = read_sync_credential(conn)?;
    if current.active_key_version == 0 {
        return Err("Register a sync passphrase before confirming encryption".to_string());
    }
    let stored_fingerprint: String = conn
        .query_row(
            "SELECT fingerprint FROM sync_key_versions
         WHERE device_id = ?1 AND version = ?2",
            params![current.device_id, current.active_key_version],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if stored_fingerprint != fingerprint {
        return Err("Passphrase does not match the registered sync key".to_string());
    }
    conn.execute(
        "UPDATE sync_credentials SET confirmed = 1, updated_at = ?1 WHERE id = 1",
        params![now_millis()],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.key.confirmed",
        "user confirmed the registered sync passphrase",
        &current.device_id,
    );
    read_sync_credential(conn)
}

pub fn list_sync_key_versions(conn: &Connection) -> Result<Vec<SyncKeyVersion>, String> {
    let device_id = conn
        .query_row(
            "SELECT device_id FROM sync_credentials WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(device_id) = device_id {
        ensure_sync_credential_row(conn, &device_id)?;
    } else {
        ensure_sync_credential_row(conn, "")?;
    }
    let mut stmt = conn
        .prepare(
            "SELECT device_id, version, salt, fingerprint, algorithm, iterations,
                active, created_at, rotated_at
         FROM sync_key_versions ORDER BY version DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let active: i64 = row.get(6)?;
            Ok(SyncKeyVersion {
                device_id: row.get(0)?,
                version: row.get(1)?,
                salt: row.get(2)?,
                fingerprint: row.get(3)?,
                algorithm: row.get(4)?,
                iterations: row.get(5)?,
                active: active != 0,
                created_at: row.get(7)?,
                rotated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn upsert_sync_paired_device(
    conn: &Connection,
    remote_device_id: &str,
    fingerprint: &str,
    pairing_code: &str,
    version: i64,
) -> Result<SyncPairedDevice, String> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO sync_paired_devices (device_id, fingerprint, pairing_code, version, paired_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(device_id) DO UPDATE SET
           fingerprint = excluded.fingerprint,
           pairing_code = excluded.pairing_code,
           version = excluded.version,
           paired_at = excluded.paired_at",
        params![remote_device_id, fingerprint, pairing_code, version, now],
    )
    .map_err(|e| e.to_string())?;
    let _ = append_sync_audit(
        conn,
        "sync.key.paired",
        &format!(
            "paired {}",
            remote_device_id.chars().take(8).collect::<String>()
        ),
        remote_device_id,
    );
    Ok(SyncPairedDevice {
        device_id: remote_device_id.to_string(),
        fingerprint: fingerprint.to_string(),
        pairing_code: pairing_code.to_string(),
        version,
        paired_at: now,
    })
}

pub fn list_sync_paired_devices(conn: &Connection) -> Result<Vec<SyncPairedDevice>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT device_id, fingerprint, pairing_code, version, paired_at
         FROM sync_paired_devices ORDER BY paired_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SyncPairedDevice {
                device_id: row.get(0)?,
                fingerprint: row.get(1)?,
                pairing_code: row.get(2)?,
                version: row.get(3)?,
                paired_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn remove_sync_paired_device(
    conn: &Connection,
    remote_device_id: &str,
) -> Result<usize, String> {
    conn.execute(
        "DELETE FROM sync_paired_devices WHERE device_id = ?1",
        params![remote_device_id],
    )
    .map_err(|e| e.to_string())
}

pub fn get_sync_key_status(conn: &Connection) -> Result<SyncKeyStatus, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT device_id FROM sync_credentials WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let credential = match existing {
        Some(device_id) => {
            ensure_sync_credential_row(conn, &device_id)?;
            read_sync_credential(conn)?
        }
        None => {
            ensure_sync_credential_row(conn, "")?;
            read_sync_credential(conn)?
        }
    };
    let mut active_salt = String::new();
    let mut active_fingerprint = String::new();
    let mut iterations = 0i64;
    if credential.active_key_version > 0 {
        let row = conn.query_row(
            "SELECT salt, fingerprint, iterations FROM sync_key_versions
             WHERE device_id = ?1 AND version = ?2",
            params![credential.device_id, credential.active_key_version],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        );
        match row {
            Ok((salt, fingerprint, iteration_count)) => {
                active_salt = salt;
                active_fingerprint = fingerprint;
                iterations = iteration_count;
            }
            Err(_) => {
                active_salt = String::new();
                active_fingerprint = String::new();
                iterations = 0;
            }
        }
    }
    Ok(SyncKeyStatus {
        device_id: credential.device_id.clone(),
        encryption_enabled: credential.encryption_enabled,
        confirmed: credential.confirmed,
        active_key_version: credential.active_key_version,
        active_salt,
        active_fingerprint,
        iterations,
        rotated_at: credential.rotated_at,
        updated_at: credential.updated_at,
        paired_devices: list_sync_paired_devices(conn)?,
    })
}

pub fn assess_passphrase_strength(passphrase: &str) -> PassphraseStrength {
    let trimmed = passphrase.trim();
    let length = trimmed.chars().count();
    let has_lower = trimmed.chars().any(|c| c.is_ascii_lowercase());
    let has_upper = trimmed.chars().any(|c| c.is_ascii_uppercase());
    let has_digit = trimmed.chars().any(|c| c.is_ascii_digit());
    let has_symbol = trimmed.chars().any(|c| c.is_ascii_punctuation());
    let variety = [has_lower, has_upper, has_digit, has_symbol]
        .iter()
        .filter(|flag| **flag)
        .count();

    let mut score = length.saturating_mul(4) as u16;
    score += variety.saturating_mul(8) as u16;
    if length >= 16 {
        score += 10;
    } else if length >= 12 {
        score += 6;
    } else if length >= 8 {
        score += 3;
    }
    if trimmed.len() > 24 {
        score += 8;
    }
    if has_lower && has_upper && has_digit && has_symbol {
        score += 8;
    }
    let score = score.min(100) as u8;

    let mut feedback = Vec::new();
    if length < 8 {
        feedback.push("at least 8 characters".to_string());
    }
    if !has_digit {
        feedback.push("add digits".to_string());
    }
    if !has_upper || !has_lower {
        feedback.push("mix upper and lower case".to_string());
    }
    if !has_symbol {
        feedback.push("add symbols".to_string());
    }
    if feedback.is_empty() && length < 12 {
        feedback.push("lengthen to 12+ characters for strong protection".to_string());
    }
    let label = match score {
        0..=39 => "weak",
        40..=69 => "fair",
        70..=89 => "strong",
        _ => "excellent",
    };
    PassphraseStrength {
        score,
        label: label.to_string(),
        feedback,
    }
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

fn default_embedding_config() -> EmbeddingConfig {
    EmbeddingConfig {
        mode: "local".to_string(),
        provider_id: String::new(),
        base_url: String::new(),
        api_key: String::new(),
        model: String::new(),
        dimension: 256,
        shard_count: 8,
        auto_rebuild: true,
        ann_enabled: true,
        probe_count: 2,
        updated_at: 0,
    }
}

pub fn get_embedding_config(conn: &Connection) -> Result<EmbeddingConfig> {
    let row = conn.query_row(
        "SELECT mode, provider_id, base_url, api_key, model, dimension, shard_count, auto_rebuild, ann_enabled, probe_count, updated_at
         FROM embedding_config WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, i64>(10)?,
            ))
        },
    );
    match row {
        Ok((
            mode,
            provider_id,
            base_url,
            api_key,
            model,
            dimension,
            shard_count,
            auto_rebuild,
            ann_enabled,
            probe_count,
            updated_at,
        )) => Ok(EmbeddingConfig {
            mode,
            provider_id,
            base_url,
            api_key,
            model,
            dimension: dimension.max(1) as usize,
            shard_count: shard_count.clamp(1, 64) as usize,
            auto_rebuild: auto_rebuild != 0,
            ann_enabled: ann_enabled != 0,
            probe_count: probe_count.clamp(1, 64) as usize,
            updated_at,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(default_embedding_config()),
        Err(err) => Err(err),
    }
}

pub fn seed_vector_shards(
    conn: &Connection,
    shard_count: usize,
    model: &str,
    dimension: usize,
) -> Result<()> {
    let count = shard_count.clamp(1, 64) as i64;
    let now = now_millis();
    for index in 0..count {
        let shard_id = index.to_string();
        conn.execute(
            "INSERT OR IGNORE INTO vector_shards (shard_id, model, dimension, documents, status, updated_at, created_at)
             VALUES (?1, ?2, ?3, 0, 'idle', ?4, ?4)",
            params![shard_id, model, dimension as i64, now],
        )?;
    }
    conn.execute(
        "UPDATE vector_shards SET model = ?1, dimension = ?2 WHERE CAST(shard_id AS INTEGER) < ?3",
        params![model, dimension as i64, count],
    )?;
    conn.execute(
        "DELETE FROM vector_shards WHERE CAST(shard_id AS INTEGER) >= ?1",
        params![count],
    )?;
    Ok(())
}

fn parse_embedding_response(mode: &str, body: &str) -> Result<Vec<f64>, String> {
    let value: Value =
        serde_json::from_str(body).map_err(|err| format!("Invalid embedding response: {err}"))?;
    let candidate = if mode == "ollama" {
        value
            .get("embeddings")
            .and_then(|item| item.as_array())
            .and_then(|items| items.first())
            .cloned()
    } else {
        value
            .get("data")
            .and_then(|item| item.as_array())
            .and_then(|items| items.first())
            .and_then(|item| item.get("embedding"))
            .cloned()
    };
    let Some(candidate) = candidate else {
        return Err("Embedding response missing embedding vector".to_string());
    };
    let vector = candidate
        .as_array()
        .ok_or_else(|| "Embedding vector is not an array".to_string())?
        .iter()
        .map(|item| {
            item.as_f64()
                .ok_or_else(|| "Embedding vector contains non-numeric value".to_string())
        })
        .collect::<Result<Vec<f64>, String>>()?;
    if vector.is_empty() {
        return Err("Embedding vector is empty".to_string());
    }
    Ok(vector)
}

pub fn embed_with_config(config: &EmbeddingConfig, text: &str) -> Result<Vec<f64>, String> {
    if config.mode == "local" {
        return Ok(embed_text(text));
    }
    let base_url = config.base_url.trim().trim_end_matches('/').to_string();
    if base_url.is_empty() {
        return Err("Embedding base URL is empty".to_string());
    }
    let model = if config.model.trim().is_empty() {
        "default".to_string()
    } else {
        config.model.trim().to_string()
    };
    let url = if config.mode == "ollama" {
        format!("{base_url}/api/embed")
    } else {
        format!("{base_url}/embeddings")
    };
    let body = serde_json::json!({ "model": model, "input": text }).to_string();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|err| format!("Embedding client error: {err}"))?;
    let mut request = client.post(&url).header("Content-Type", "application/json");
    if !config.api_key.trim().is_empty() {
        request = request.header("Authorization", format!("Bearer {}", config.api_key.trim()));
    }
    let response = request
        .body(body)
        .send()
        .map_err(|err| format!("Embedding request failed: {err}"))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|err| format!("Embedding response read failed: {err}"))?;
    if !status.is_success() {
        return Err(format!(
            "Embedding HTTP {status}: {}",
            text.chars().take(200).collect::<String>()
        ));
    }
    parse_embedding_response(&config.mode, &text)
}

pub fn list_vector_shards(conn: &Connection) -> Result<Vec<VectorShardRecord>> {
    let mut stmt = conn.prepare(
        "SELECT shard_id, model, dimension, documents, status, centroid, updated_at, created_at
         FROM vector_shards ORDER BY CAST(shard_id AS INTEGER) ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(VectorShardRecord {
            shard_id: row.get(0)?,
            model: row.get(1)?,
            dimension: row.get::<_, i64>(2)?.max(1) as usize,
            documents: row.get(3)?,
            status: row.get(4)?,
            centroid: row.get(5)?,
            updated_at: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn search_thoughts(
    conn: &Connection,
    query: &str,
    limit: i64,
    source_filter: Option<&RagSourceFilter>,
) -> Result<Vec<RagSearchResult>> {
    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        return Ok(Vec::new());
    }
    let config = get_embedding_config(conn)?;
    let query_embedding = embed_with_config(&config, query).unwrap_or_else(|_| embed_text(query));
    struct SearchDoc {
        id: String,
        content: String,
        tags: String,
        kind: String,
        source_kind: String,
        source_file: String,
        vault_path: String,
        tokens: Vec<String>,
        embedding: Vec<f64>,
        shard_id: String,
        embedding_model: String,
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
    let thought_docs: Vec<SearchDoc> = rows
        .filter_map(Result::ok)
        .map(|(id, content, tags, kind)| {
            let tokens = tokenize(&content);
            let embedding = embed_text(&content);
            SearchDoc {
                id,
                content,
                tags,
                kind,
                source_kind: "thought".to_string(),
                source_file: String::new(),
                vault_path: String::new(),
                tokens,
                embedding,
                shard_id: "0".to_string(),
                embedding_model: "local".to_string(),
            }
        })
        .collect();
    let mut file_stmt = conn.prepare(
        "SELECT id, path, content, tags, embedding, shard_id, embedding_model, vault_path
         FROM knowledge_files",
    )?;
    let file_rows = file_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, Option<String>>(7)?,
        ))
    })?;
    let mut file_docs: Vec<SearchDoc> = Vec::new();
    for file in file_rows.flatten() {
        let (id, path, content, tags, embedding_raw, shard_id, embedding_model, vault_path) = file;
        let tokens = tokenize(&content);
        let embedding = if embedding_raw.is_empty() {
            embed_text(&content)
        } else {
            serde_json::from_str(&embedding_raw).unwrap_or_else(|_| embed_text(&content))
        };
        file_docs.push(SearchDoc {
            id: id.clone(),
            content,
            tags,
            kind: "doc".to_string(),
            source_kind: "file".to_string(),
            source_file: path,
            vault_path: vault_path.unwrap_or_default(),
            tokens,
            embedding,
            shard_id,
            embedding_model,
        });
    }
    let ann_ready = config.ann_enabled
        && config.probe_count > 1
        && config.probe_count < config.shard_count
        && file_docs.len() > 1;
    if ann_ready {
        let shards = list_vector_shards(conn)?;
        let mut ranked: Vec<(String, f64)> = shards
            .iter()
            .filter_map(|shard| {
                if shard.centroid.is_empty() {
                    return None;
                }
                let centroid: Vec<f64> = serde_json::from_str(&shard.centroid).ok()?;
                Some((
                    shard.shard_id.clone(),
                    cosine_similarity(&query_embedding, &centroid),
                ))
            })
            .collect();
        if ranked.len() >= config.probe_count {
            ranked.sort_by(|a, b| b.1.total_cmp(&a.1));
            let top: Vec<String> = ranked
                .into_iter()
                .take(config.probe_count)
                .map(|(shard_id, _)| shard_id)
                .collect();
            file_docs.retain(|doc| top.contains(&doc.shard_id));
        }
    }
    let mut docs = thought_docs;
    docs.extend(file_docs);
    if docs.is_empty() {
        return Ok(Vec::new());
    }
    let doc_count = docs.len() as f64;
    let avg_len = docs.iter().map(|d| d.tokens.len() as f64).sum::<f64>() / doc_count;
    let mut idf: HashMap<String, f64> = HashMap::new();
    for term in &query_tokens {
        let doc_freq = docs
            .iter()
            .filter(|d| d.tokens.iter().any(|t| t == term))
            .count() as f64;
        idf.insert(
            term.clone(),
            ((doc_count - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0).ln(),
        );
    }

    let mut scored: Vec<(f64, RagSearchResult)> = Vec::new();
    for doc in &docs {
        if let Some(filter) = source_filter {
            if filter.enabled && doc.source_kind == "file" {
                let keep = if filter.mode == "all" || filter.file_paths.is_empty() {
                    true
                } else {
                    filter
                        .file_paths
                        .iter()
                        .any(|path| path == &doc.source_file)
                };
                if !keep {
                    continue;
                }
            }
        }
        let mut bm25 = 0.0;
        for term in &query_tokens {
            let tf = doc.tokens.iter().filter(|t| *t == term).count() as f64;
            if tf > 0.0 {
                let norm = doc.tokens.len() as f64;
                let term_idf = idf.get(term).copied().unwrap_or(0.0);
                bm25 += term_idf * (tf * 1.5)
                    / (tf + 1.5 * (1.0 - 0.75 + 0.75 * (norm / avg_len.max(1.0))));
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
                source_kind: doc.source_kind.clone(),
                source_file: doc.source_file.clone(),
                vault_path: doc.vault_path.clone(),
                score,
                vector_score,
                shard_id: doc.shard_id.clone(),
                embedding_model: doc.embedding_model.clone(),
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

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM message_aux WHERE message_id IN (SELECT id FROM chat_messages WHERE session_id = ?1)",
        params![id],
    )?;
    conn.execute(
        "DELETE FROM message_versions WHERE message_id IN (SELECT id FROM chat_messages WHERE session_id = ?1)",
        params![id],
    )?;
    conn.execute(
        "DELETE FROM chat_messages WHERE session_id = ?1",
        params![id],
    )?;
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

// ---- FSM orchestration (ADR-001 §6/§7/§11, Sprint 2 backend) ----

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsmNode {
    pub id: String,
    pub run_id: String,
    pub node_key: String,
    pub agent: Option<String>,
    pub status: String,
    pub context_json: String,
    pub trace_id: Option<String>,
    pub temp_file_paths: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunMetric {
    pub run_id: String,
    pub trace_id: Option<String>,
    pub kind: String,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub node_count: i64,
    pub hitl_count: i64,
    pub total_tokens: i64,
    pub status: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsmRunCreated {
    pub run_id: String,
    pub trace_id: String,
}

/// ULID-style sortable trace id: hex millis prefix + 32-char random suffix.
/// Lexicographic ordering of the string follows creation time, per ADR-001 §11.
pub fn generate_trace_id() -> String {
    let millis = now_millis().max(0) as u64;
    let random = uuid::Uuid::new_v4().simple().to_string();
    format!("{:016x}{}", millis, random)
}

fn fsm_run_trace_id(conn: &Connection, run_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT trace_id FROM fsm_nodes
         WHERE run_id = ?1 AND trace_id IS NOT NULL AND trace_id <> ''
         ORDER BY created_at ASC, rowid ASC LIMIT 1",
        params![run_id],
        |row| row.get(0),
    )
    .optional()
    .ok()
    .flatten()
}

fn map_fsm_node(row: &rusqlite::Row<'_>) -> rusqlite::Result<FsmNode> {
    let temp_file_paths_raw: String = row.get(7)?;
    let temp_file_paths =
        serde_json::from_str::<Vec<String>>(&temp_file_paths_raw).unwrap_or_else(|_| Vec::new());
    Ok(FsmNode {
        id: row.get(0)?,
        run_id: row.get(1)?,
        node_key: row.get(2)?,
        agent: row.get(3)?,
        status: row.get(4)?,
        context_json: row.get(5)?,
        trace_id: row.get(6)?,
        temp_file_paths,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn get_fsm_node(conn: &Connection, id: &str) -> Result<Option<FsmNode>> {
    conn.query_row(
        "SELECT id, run_id, node_key, agent, status, context_json, trace_id, temp_file_paths, created_at, updated_at
         FROM fsm_nodes WHERE id = ?1",
        params![id],
        map_fsm_node,
    )
    .optional()
}

/// Creates a fresh FSM run: persists a ULID-style trace id on a root node
/// (`node_key = 'root'`, status `pending`) and returns the run id.
pub fn create_fsm_run(conn: &Connection, run_id: &str, trace_id: &str) -> Result<String> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO fsm_nodes (id, run_id, node_key, agent, status, context_json, trace_id, temp_file_paths, created_at, updated_at)
         VALUES (?1, ?2, 'root', NULL, 'pending', '{}', ?3, '[]', ?4, ?4)",
        params![uid(), run_id, trace_id, now],
    )?;
    Ok(run_id.to_string())
}

/// Inserts a node into an existing run. The node inherits the run's trace id
/// so traces stay contiguous across the whole FSM (ADR-001 §11).
pub fn create_fsm_node(
    conn: &Connection,
    run_id: &str,
    node_key: &str,
    agent: Option<&str>,
    status: &str,
    context_json: &str,
) -> Result<FsmNode> {
    let id = uid();
    let now = now_millis();
    let trace_id = fsm_run_trace_id(conn, run_id);
    conn.execute(
        "INSERT INTO fsm_nodes (id, run_id, node_key, agent, status, context_json, trace_id, temp_file_paths, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '[]', ?8, ?8)",
        params![id, run_id, node_key, agent, status, context_json, trace_id, now],
    )?;
    Ok(FsmNode {
        id,
        run_id: run_id.to_string(),
        node_key: node_key.to_string(),
        agent: agent.map(|a| a.to_string()),
        status: status.to_string(),
        context_json: context_json.to_string(),
        trace_id,
        temp_file_paths: Vec::new(),
        created_at: now,
        updated_at: now,
    })
}

pub fn update_fsm_node_status(conn: &Connection, id: &str, status: &str) -> Result<FsmNode> {
    let updated = conn.execute(
        "UPDATE fsm_nodes SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now_millis(), id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    get_fsm_node(conn, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_fsm_node_context(conn: &Connection, id: &str, context_json: &str) -> Result<FsmNode> {
    let updated = conn.execute(
        "UPDATE fsm_nodes SET context_json = ?1, updated_at = ?2 WHERE id = ?3",
        params![context_json, now_millis(), id],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    get_fsm_node(conn, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_fsm_nodes(conn: &Connection, run_id: &str) -> Result<Vec<FsmNode>> {
    let mut stmt = conn.prepare(
        "SELECT id, run_id, node_key, agent, status, context_json, trace_id, temp_file_paths, created_at, updated_at
         FROM fsm_nodes WHERE run_id = ?1 ORDER BY created_at ASC, rowid ASC",
    )?;
    let rows = stmt.query_map(params![run_id], map_fsm_node)?;
    rows.collect()
}

/// Run ids that still hold at least one non-terminal node
/// (`pending / running / paused / blocked-on-human`), used to revive runs
/// after app restart/crash (ADR-001 §6).
pub fn list_active_fsm_runs(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT run_id FROM fsm_nodes
         WHERE status IN ('pending', 'running', 'paused', 'blocked-on-human')
         GROUP BY run_id
         ORDER BY MIN(created_at) ASC",
    )?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect()
}

/// Deletes the run and all of its nodes; the run's metric row is removed too,
/// matching the ADR-001 §12 right-to-be-forgotten cascade.
pub fn delete_fsm_run(conn: &Connection, run_id: &str) -> Result<()> {
    conn.execute("DELETE FROM fsm_nodes WHERE run_id = ?1", params![run_id])?;
    conn.execute("DELETE FROM run_metrics WHERE run_id = ?1", params![run_id])?;
    Ok(())
}

fn map_run_metric(row: &rusqlite::Row<'_>) -> rusqlite::Result<RunMetric> {
    Ok(RunMetric {
        run_id: row.get(0)?,
        trace_id: row.get(1)?,
        kind: row.get(2)?,
        started_at: row.get(3)?,
        ended_at: row.get(4)?,
        node_count: row.get(5)?,
        hitl_count: row.get(6)?,
        total_tokens: row.get(7)?,
        status: row.get(8)?,
    })
}

pub fn get_run_metric(conn: &Connection, run_id: &str) -> Result<Option<RunMetric>> {
    conn.query_row(
        "SELECT run_id, trace_id, kind, started_at, ended_at, node_count, hitl_count, total_tokens, status
         FROM run_metrics WHERE run_id = ?1",
        params![run_id],
        map_run_metric,
    )
    .optional()
}

pub fn list_run_metrics(conn: &Connection, limit: i64) -> Result<Vec<RunMetric>> {
    let limit = limit.clamp(1, 200);
    let mut stmt = conn.prepare(
        "SELECT run_id, trace_id, kind, started_at, ended_at, node_count, hitl_count, total_tokens, status
         FROM run_metrics ORDER BY started_at DESC, rowid DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], map_run_metric)?;
    rows.collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub thoughts: Vec<Thought>,
    pub sessions: Vec<Session>,
    pub providers: Vec<Provider>,
}

pub fn get_workspace_summary(conn: &Connection) -> Result<WorkspaceSummary> {
    Ok(WorkspaceSummary {
        projects: list_projects(conn)?,
        tasks: list_tasks(conn)?,
        thoughts: list_thoughts(conn)?,
        sessions: list_sessions(conn)?,
        providers: list_providers(conn)?,
    })
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
        let task = create_task(&conn, "Today task", true, None, false).unwrap();
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
    fn task_rename_and_delete() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let task = create_task(&conn, "Original title", true, None, false).unwrap();

        update_task_title(&conn, &task.id, "Renamed title").unwrap();
        let renamed = list_tasks(&conn)
            .unwrap()
            .into_iter()
            .find(|t| t.id == task.id)
            .expect("task should persist after rename");
        assert_eq!(renamed.title, "Renamed title");

        delete_task(&conn, &task.id).unwrap();
        assert!(list_tasks(&conn)
            .unwrap()
            .into_iter()
            .all(|t| t.id != task.id));

        let missing = delete_task(&conn, &task.id);
        assert!(missing.is_err());
    }

    #[test]
    fn dod_count_tracks_project_bound_tasks() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        migrate_task_project(&conn).unwrap();

        let project = create_project(&conn, "DoD Project", "/tmp/dod").unwrap();

        let t1 = create_task(&conn, "DoD task 1", true, Some(&project.id), true).unwrap();
        let _t2 = create_task(&conn, "Normal task", true, None, false).unwrap();

        assert_eq!(count_project_dod(&conn, &project.id).unwrap(), 1);
        assert_eq!(
            get_task_project(&conn, &t1.id).unwrap().as_deref(),
            Some(project.id.as_str())
        );

        update_task_status(&conn, &t1.id, "done").unwrap();
        assert_eq!(count_project_dod(&conn, &project.id).unwrap(), 0);
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
    fn project_sort_order_migrates_and_reorders() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-order-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT,
                    revenue REAL DEFAULT 0.0,
                    status TEXT DEFAULT 'active',
                    created_at INTEGER
                );
                CREATE TABLE project_revenue_history (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    revenue REAL NOT NULL,
                    recorded_at INTEGER NOT NULL
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, created_at) VALUES (?1, ?2, ?3)",
                params!["a", "Alpha", 1000],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, created_at) VALUES (?1, ?2, ?3)",
                params!["b", "Beta", 2000],
            )
            .unwrap();
            migrate_project_sort_order(&conn).unwrap();
            migrate_project_material(&conn).unwrap();
            migrate_project_journey(&conn).unwrap();
            let order: Vec<(String, i64)> = conn
                .prepare("SELECT id, sort_order FROM projects ORDER BY sort_order ASC")
                .unwrap()
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            assert_eq!(order[0], ("b".to_string(), 0));
            assert_eq!(order[1], ("a".to_string(), 1));
            reorder_projects(&conn, &["a".to_string(), "b".to_string()]).unwrap();
            let first: String = conn
                .query_row(
                    "SELECT id FROM projects ORDER BY sort_order ASC LIMIT 1",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(first, "a");
            let created = create_project(&conn, "Gamma", "").unwrap();
            assert_eq!(created.sort_order, 2);
            let all = list_projects(&conn).unwrap();
            assert_eq!(all[0].name, "Alpha");
            assert_eq!(all[1].name, "Beta");
            assert_eq!(all[2].name, "Gamma");
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn project_material_migrates_and_persists() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-material-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT,
                    revenue REAL DEFAULT 0.0,
                    status TEXT DEFAULT 'active',
                    created_at INTEGER,
                    sort_order INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE project_revenue_history (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    revenue REAL NOT NULL,
                    recorded_at INTEGER NOT NULL
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, created_at, sort_order) VALUES (?1, ?2, ?3, 0)",
                params!["a", "Alpha", 1000],
            )
            .unwrap();
            migrate_project_material(&conn).unwrap();
            migrate_project_journey(&conn).unwrap();
            let initial: String = conn
                .query_row("SELECT material FROM projects WHERE id = 'a'", [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(initial, "");
            let updated = update_project_material(&conn, "a", "rain").unwrap();
            assert_eq!(updated.material, "rain");
            let invalid = update_project_material(&conn, "a", "neon").unwrap();
            assert_eq!(invalid.material, "");
            let created = create_project(&conn, "Gamma", "").unwrap();
            assert_eq!(created.material, "");
            let all = list_projects(&conn).unwrap();
            assert_eq!(all[0].material, "");
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn project_journey_migrates_and_persists() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-project-journey-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT,
                    revenue REAL DEFAULT 0.0,
                    status TEXT DEFAULT 'active',
                    created_at INTEGER,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    material TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE project_revenue_history (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    revenue REAL NOT NULL,
                    recorded_at INTEGER NOT NULL
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, created_at, sort_order) VALUES (?1, ?2, ?3, 0)",
                params!["a", "Alpha", 1000],
            )
            .unwrap();
            migrate_project_journey(&conn).unwrap();
            let initial: String = conn
                .query_row(
                    "SELECT journey_stage FROM projects WHERE id = 'a'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(initial, "idea");
            let updated = update_project_journey(
                &conn,
                "a",
                "ready",
                Some("docs/journey/alpha.md".to_string()),
            )
            .unwrap();
            assert_eq!(updated.journey_stage, "ready");
            assert_eq!(
                updated.journey_doc_path.as_deref(),
                Some("docs/journey/alpha.md")
            );
            let invalid = update_project_journey(&conn, "a", "shipped", None);
            assert!(invalid.is_err());
            let created = create_project(&conn, "Gamma", "").unwrap();
            assert_eq!(created.journey_stage, "idea");
            assert_eq!(created.journey_doc_path, None);
            let all = list_projects(&conn).unwrap();
            let alpha = all
                .iter()
                .find(|project| project.name == "Alpha")
                .expect("Alpha should be listed");
            assert_eq!(alpha.journey_stage, "ready");
            let gamma = all
                .iter()
                .find(|project| project.name == "Gamma")
                .expect("Gamma should be listed");
            assert_eq!(gamma.journey_stage, "idea");
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn journey_transition_rules_are_enforced() {
        let conn = new_test_connection();
        let project = create_project(&conn, "Alpha", "").unwrap();
        assert!(update_project_journey(&conn, &project.id, "discussing", None).is_ok());
        assert!(update_project_journey(&conn, &project.id, "building", None).is_err());
        assert!(update_project_journey(&conn, &project.id, "ready", None).is_ok());
        assert!(update_project_journey(&conn, &project.id, "building", None).is_ok());
        assert!(update_project_journey(&conn, &project.id, "archived", None).is_ok());
        assert!(update_project_journey(&conn, &project.id, "idea", None).is_err());
        assert!(update_project_journey(&conn, &project.id, "ready", None).is_ok());
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
    fn webhook_template_version_migration_adds_column() {
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
                trigger_condition TEXT NOT NULL DEFAULT '',
                channels TEXT NOT NULL DEFAULT '[\"http\"]',
                recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300,
                circuit_opened_at INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                consecutive_failures INTEGER NOT NULL DEFAULT 0,
                auto_disable_after INTEGER NOT NULL DEFAULT 3
            );",
        )
        .unwrap();
        migrate_webhook_template_version(&conn).unwrap();
        migrate_webhook_template_version(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "template_version").unwrap());
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
    fn vector_index_migration_adds_columns_and_seeds_shards() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE knowledge_files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                tags TEXT,
                content TEXT NOT NULL,
                vault_path TEXT NOT NULL DEFAULT '',
                indexed_at INTEGER,
                embedding TEXT DEFAULT ''
            );
            CREATE TABLE embedding_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                mode TEXT NOT NULL DEFAULT 'local',
                provider_id TEXT NOT NULL DEFAULT '',
                base_url TEXT NOT NULL DEFAULT '',
                api_key TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                dimension INTEGER NOT NULL DEFAULT 256,
                shard_count INTEGER NOT NULL DEFAULT 8,
                auto_rebuild INTEGER NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE vector_shards (
                shard_id TEXT PRIMARY KEY,
                model TEXT NOT NULL DEFAULT '',
                dimension INTEGER NOT NULL DEFAULT 256,
                documents INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'idle',
                updated_at INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT 0
            );",
        )
        .unwrap();
        migrate_vector_index(&conn).unwrap();
        for column in [
            "shard_id",
            "embedding_model",
            "embedding_dim",
            "embedding_status",
            "embedding_error",
        ] {
            assert!(column_exists(&conn, "knowledge_files", column).unwrap());
        }
        for (table, column) in [
            ("embedding_config", "ann_enabled"),
            ("embedding_config", "probe_count"),
            ("vector_shards", "centroid"),
        ] {
            assert!(column_exists(&conn, table, column).unwrap());
        }
        assert_eq!(list_vector_shards(&conn).unwrap().len(), 8);
    }

    #[test]
    fn knowledge_cluster_migration_seeds_config_and_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE knowledge_files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                tags TEXT,
                content TEXT NOT NULL,
                vault_path TEXT NOT NULL DEFAULT '',
                indexed_at INTEGER,
                embedding TEXT DEFAULT '',
                shard_id TEXT NOT NULL DEFAULT '0',
                embedding_model TEXT NOT NULL DEFAULT '',
                embedding_dim INTEGER NOT NULL DEFAULT 256,
                embedding_status TEXT NOT NULL DEFAULT 'indexed',
                embedding_error TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE knowledge_clusters (
                id TEXT PRIMARY KEY,
                centroid TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT 'local',
                representative TEXT NOT NULL DEFAULT '',
                documents INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE knowledge_cluster_members (
                cluster_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                similarity REAL NOT NULL DEFAULT 0,
                PRIMARY KEY (cluster_id, doc_id)
            );
            CREATE TABLE knowledge_cluster_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                cluster_threshold REAL NOT NULL DEFAULT 0.62,
                dedup_threshold REAL NOT NULL DEFAULT 0.92,
                last_recomputed_at INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE knowledge_dedup_candidates (
                id TEXT PRIMARY KEY,
                doc_a TEXT NOT NULL,
                doc_b TEXT NOT NULL,
                similarity REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'open',
                created_at INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0
            );",
        )
        .unwrap();
        migrate_knowledge_clusters(&conn).unwrap();
        let (cluster_threshold, dedup_threshold, last_recomputed_at): (f64, f64, i64) = conn
            .query_row(
                "SELECT cluster_threshold, dedup_threshold, last_recomputed_at
                 FROM knowledge_cluster_config WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(cluster_threshold, 0.62);
        assert_eq!(dedup_threshold, 0.92);
        assert_eq!(last_recomputed_at, 0);
    }

    #[test]
    fn embedding_response_parses_openai_and_ollama_shapes() {
        let openai = r#"{"data":[{"embedding":[0.1,0.2,0.3]}],"model":"text-embedding-3-small"}"#;
        assert_eq!(
            parse_embedding_response("openai", openai).unwrap(),
            vec![0.1, 0.2, 0.3]
        );
        let ollama = r#"{"model":"nomic-embed-text","embeddings":[[0.5,-0.5]]}"#;
        assert_eq!(
            parse_embedding_response("ollama", ollama).unwrap(),
            vec![0.5, -0.5]
        );
        assert!(parse_embedding_response("openai", r#"{"data":[]}"#).is_err());
        assert!(parse_embedding_response("ollama", r#"{"embeddings":[]}"#).is_err());
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
        migrate_provider_stream_config(&conn).unwrap();
        migrate_provider_api_key_encryption(&conn).unwrap();
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
        migrate_provider_stream_config(&conn).unwrap();
        migrate_provider_api_key_encryption(&conn).unwrap();
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
    fn provider_stream_config_migration_adds_columns_and_persists() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                model TEXT DEFAULT '',
                priority INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1
            );",
        )
        .unwrap();
        migrate_provider_stream_config(&conn).unwrap();
        migrate_provider_api_key_encryption(&conn).unwrap();
        for column in [
            "api_key_encrypted",
            "timeout_secs",
            "retry_count",
            "retry_delay_secs",
        ] {
            assert!(column_exists(&conn, "providers", column).unwrap());
        }
        let provider = create_provider_with_options(
            &conn,
            "Stream Mock",
            "https://example.test/v1",
            "enc:v1:stored",
            "mock-model",
            true,
            15,
            2,
            3,
        )
        .unwrap();
        assert!(provider.api_key_encrypted);
        assert_eq!(provider.timeout_secs, 15);
        assert_eq!(provider.retry_count, 2);
        assert_eq!(provider.retry_delay_secs, 3);

        update_provider_stream_config(&conn, &provider.id, 60, 4, 5).unwrap();
        let updated = get_provider(&conn, &provider.id).unwrap().unwrap();
        assert_eq!(updated.timeout_secs, 60);
        assert_eq!(updated.retry_count, 4);
        assert_eq!(updated.retry_delay_secs, 5);
        assert!(updated.api_key_encrypted);
    }

    #[test]
    fn replace_providers_replaces_all_and_clamps_stream_config() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        create_provider_with_options(
            &conn,
            "Old A",
            "https://a.test/v1",
            "key-a",
            "model-a",
            false,
            30,
            1,
            1,
        )
        .unwrap();
        create_provider_with_options(
            &conn,
            "Old B",
            "https://b.test/v1",
            "key-b",
            "model-b",
            false,
            30,
            1,
            1,
        )
        .unwrap();
        let replacement = vec![Provider {
            id: String::new(),
            name: "Imported".to_string(),
            base_url: "https://c.test/v1".to_string(),
            api_key: "enc:v1:key-c".to_string(),
            model: "model-c".to_string(),
            priority: 900,
            is_active: true,
            api_key_encrypted: true,
            timeout_secs: 999,
            retry_count: 99,
            retry_delay_secs: -5,
        }];
        let inserted = replace_providers(&conn, &replacement).unwrap();
        assert_eq!(inserted, 1);
        let providers = list_providers(&conn).unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].name, "Imported");
        assert_eq!(providers[0].priority, 900);
        assert_eq!(providers[0].timeout_secs, 300);
        assert_eq!(providers[0].retry_count, 5);
        assert_eq!(providers[0].retry_delay_secs, 0);
        assert!(providers[0].api_key_encrypted);
    }

    #[test]
    fn delete_provider_removes_provider_and_model_cache() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let provider = create_provider_with_options(
            &conn,
            "Delete Me",
            "https://delete.test/v1",
            "",
            "model",
            false,
            30,
            1,
            1,
        )
        .unwrap();
        upsert_provider_models(&conn, &provider.id, &[("m1".to_string(), None)]).unwrap();

        let deleted = delete_provider(&conn, &provider.id).unwrap();

        assert_eq!(deleted, 1);
        assert!(get_provider(&conn, &provider.id).unwrap().is_none());
        assert!(list_cached_provider_models(&conn, &provider.id)
            .unwrap()
            .is_empty());
        assert_eq!(delete_provider(&conn, &provider.id).unwrap(), 0);
    }

    #[test]
    fn model_metadata_cache_lifecycle_sorts_by_favorite_then_recent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        upsert_provider_models(
            &conn,
            "provider-a",
            &[
                ("gamma".to_string(), Some("mockai".to_string())),
                ("alpha".to_string(), None),
                ("beta".to_string(), Some("mockai".to_string())),
            ],
        )
        .unwrap();
        set_model_favorite(&conn, "provider-a", "beta", true).unwrap();
        touch_model_usage(&conn, "provider-a", "gamma").unwrap();
        update_model_meta(
            &conn,
            "provider-a",
            "alpha",
            ModelMetaPatch {
                context_window: 128_000,
                input_price_per_mtok: 1.5,
                output_price_per_mtok: 4.0,
                rate_tpm: 1_000_000,
                rate_rpm: 2_000,
            },
        )
        .unwrap();

        let cached = list_cached_provider_models(&conn, "provider-a").unwrap();
        assert_eq!(
            cached.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            vec!["beta", "gamma", "alpha"]
        );
        assert!(cached[0].is_favorite);
        assert!(cached[1].last_used_at > cached[2].last_used_at);
        let alpha = cached.iter().find(|m| m.id == "alpha").unwrap();
        assert_eq!(alpha.context_window, 128_000);
        assert_eq!(alpha.rate_tpm, 1_000_000);
        assert!(list_cached_provider_models(&conn, "provider-other")
            .unwrap()
            .is_empty());
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
    fn webhook_trigger_condition_migration_adds_column() {
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
        migrate_webhook_trigger_condition(&conn).unwrap();
        migrate_webhook_trigger_condition(&conn).unwrap();
        assert!(column_exists(&conn, "webhook_rules", "trigger_condition").unwrap());
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES ('legacy-condition', 'Legacy', 'https://example.test', 1, 1)",
            [],
        )
        .unwrap();
        let condition: String = conn
            .query_row(
                "SELECT trigger_condition FROM webhook_rules WHERE id = 'legacy-condition'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(condition, "");
    }

    #[test]
    fn webhook_channels_recovery_migration_adds_columns() {
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
                trigger_condition TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER NOT NULL DEFAULT 0,
                last_status INTEGER NOT NULL DEFAULT 0,
                last_message TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                consecutive_failures INTEGER NOT NULL DEFAULT 0,
                auto_disable_after INTEGER NOT NULL DEFAULT 3
            );
            CREATE TABLE webhook_deliveries (
                id TEXT PRIMARY KEY,
                rule_id TEXT NOT NULL,
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
            );",
        )
        .unwrap();
        migrate_webhook_channels_recovery(&conn).unwrap();
        migrate_webhook_channels_recovery(&conn).unwrap();
        for (table, column) in [
            ("webhook_rules", "channels"),
            ("webhook_rules", "recovery_backoff_seconds"),
            ("webhook_rules", "circuit_opened_at"),
            ("webhook_deliveries", "channel"),
        ] {
            assert!(column_exists(&conn, table, column).unwrap());
        }
        conn.execute(
            "INSERT INTO webhook_rules (id, name, url, created_at, updated_at)
             VALUES ('legacy-multi', 'Legacy', 'https://example.test', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO webhook_deliveries (id, rule_id, created_at, updated_at)
             VALUES ('legacy-delivery', 'legacy-multi', 1, 1)",
            [],
        )
        .unwrap();
        let channels: String = conn
            .query_row(
                "SELECT channels FROM webhook_rules WHERE id = 'legacy-multi'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let backoff: i64 = conn
            .query_row(
                "SELECT recovery_backoff_seconds FROM webhook_rules WHERE id = 'legacy-multi'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let circuit: i64 = conn
            .query_row(
                "SELECT circuit_opened_at FROM webhook_rules WHERE id = 'legacy-multi'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let channel: String = conn
            .query_row(
                "SELECT channel FROM webhook_deliveries WHERE id = 'legacy-delivery'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(channels, "[\"http\"]");
        assert_eq!(backoff, 300);
        assert_eq!(circuit, 0);
        assert_eq!(channel, "http");
    }

    #[test]
    fn event_log_records_validates_and_lists() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        set_event_schema(
            &conn,
            "note.created",
            r#"{"required":["note"],"properties":{"note":{"type":"string"},"count":{"type":"number"}}}"#,
            true,
        )
        .unwrap();
        let accepted = record_event_log(
            &conn,
            "note.created",
            &serde_json::json!({"note": "hello", "count": 3}),
            "test",
            "device-a",
        )
        .unwrap();
        assert_eq!(accepted.status, "accepted");
        assert!(accepted.schema_version > 0);
        assert_eq!(accepted.event, "note.created");

        let rejected = record_event_log(
            &conn,
            "note.created",
            &serde_json::json!({"note": 42}),
            "test",
            "device-a",
        )
        .unwrap();
        assert_eq!(rejected.status, "rejected");
        assert!(
            rejected.rejected_reason.contains("must be string"),
            "{}",
            rejected.rejected_reason
        );

        let missing = record_event_log(
            &conn,
            "note.created",
            &serde_json::json!({"count": 1}),
            "test",
            "device-a",
        )
        .unwrap();
        assert_eq!(missing.status, "rejected");
        assert!(
            missing
                .rejected_reason
                .contains("Missing required field 'note'"),
            "{}",
            missing.rejected_reason
        );

        let all = list_event_logs(&conn, 100, "").unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(
            list_event_logs(&conn, 100, "note.created").unwrap().len(),
            3
        );
        let stats = get_event_bus_stats(&conn).unwrap();
        assert_eq!(stats.total, 3);
        assert_eq!(stats.accepted, 1);
        assert_eq!(stats.rejected, 2);
    }

    #[test]
    fn event_bus_config_defaults_roundtrip_and_clamp() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let defaults = get_event_bus_config(&conn).unwrap();
        assert!(!defaults.forward_enabled);
        assert_eq!(defaults.retention_days, 30);
        assert_eq!(defaults.max_logs, 500);
        assert!(defaults.schema_strict);

        let saved = set_event_bus_config(
            &conn,
            true,
            "https://events.example.test/ingest",
            "evt-token",
            0,
            100_001,
            false,
        )
        .unwrap();
        assert!(saved.forward_enabled);
        assert_eq!(saved.forward_url, "https://events.example.test/ingest");
        assert_eq!(saved.forward_token, "evt-token");
        assert_eq!(saved.retention_days, 1);
        assert_eq!(saved.max_logs, 100_000);
        assert!(!saved.schema_strict);
        assert!(saved.updated_at > 0);
        let roundtrip = get_event_bus_config(&conn).unwrap();
        assert_eq!(roundtrip.forward_url, "https://events.example.test/ingest");
        assert_eq!(roundtrip.max_logs, 100_000);
    }

    #[test]
    fn event_forward_queue_lifecycle() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let log = record_event_log(
            &conn,
            "sync.completed",
            &serde_json::json!({"ok": true}),
            "test",
            "device-a",
        )
        .unwrap();
        let forward = enqueue_event_forward(
            &conn,
            &log.id,
            "https://peer.example.test/events",
            "peer-token",
        )
        .unwrap();
        assert_eq!(forward.status, "queued");
        assert_eq!(forward.attempts, 0);
        assert_eq!(forward.target_token, "peer-token");
        assert!(forward.next_attempt_at <= now_millis() + 1);

        let now = now_millis();
        let claimed = claim_due_event_forwards(&conn, now, 8).unwrap();
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].status, "delivering");
        complete_event_forward(
            &conn,
            &forward.id,
            "success",
            200,
            "HTTP 200 delivered",
            1,
            now,
        )
        .unwrap();
        assert_eq!(
            get_event_forward(&conn, &forward.id)
                .unwrap()
                .unwrap()
                .status,
            "success"
        );

        let retried = retry_event_forward(&conn, &forward.id).unwrap();
        assert_eq!(retried.status, "queued");
        assert_eq!(retried.attempts, 0);
        let stats = get_event_bus_stats(&conn).unwrap();
        assert_eq!(stats.total, 1);
        assert_eq!(stats.accepted, 1);
        assert_eq!(stats.pending, 1);
        assert_eq!(stats.forwarded, 0);

        delete_event_forward(&conn, &forward.id).unwrap();
        assert!(get_event_forward(&conn, &forward.id).unwrap().is_none());
        let cleared = clear_event_logs(&conn, "").unwrap();
        assert_eq!(cleared, 1);
    }

    #[test]
    fn fsm_node_lifecycle_persists() {
        let dir = std::env::temp_dir().join(format!("aiwb-fsm-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let run_id = uid();
        let trace_id = generate_trace_id();
        let conn = init_connection(&db_path).unwrap();
        let returned = create_fsm_run(&conn, &run_id, &trace_id).unwrap();
        assert_eq!(returned, run_id);

        let node = create_fsm_node(
            &conn,
            &run_id,
            "clarify",
            Some("recap_agent"),
            "pending",
            r#"{"step":1}"#,
        )
        .unwrap();
        assert_eq!(node.status, "pending");
        assert_eq!(node.trace_id.as_deref(), Some(trace_id.as_str()));
        assert!(node.temp_file_paths.is_empty());

        let updated = update_fsm_node_status(&conn, &node.id, "complete").unwrap();
        assert_eq!(updated.status, "complete");
        assert!(updated.updated_at >= updated.created_at);

        let nodes = list_fsm_nodes(&conn, &run_id).unwrap();
        assert_eq!(nodes.len(), 2);
        assert!(nodes.iter().any(|n| n.node_key == "root"));
        let persisted = nodes.iter().find(|n| n.id == node.id).unwrap();
        assert_eq!(persisted.status, "complete");
        assert_eq!(persisted.updated_at, updated.updated_at);
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let reloaded = list_fsm_nodes(&conn, &run_id).unwrap();
        assert_eq!(reloaded.len(), 2);
        assert!(reloaded
            .iter()
            .any(|n| n.id == node.id && n.status == "complete"));
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn fsm_node_status_missing_id_errors() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        assert!(update_fsm_node_status(&conn, "missing-id", "running").is_err());
        assert!(update_fsm_node_context(&conn, "missing-id", "{}").is_err());
    }

    #[test]
    fn active_runs_detects_nonterminal() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        let run_id = uid();
        let trace_id = generate_trace_id();
        create_fsm_run(&conn, &run_id, &trace_id).unwrap();

        assert!(list_active_fsm_runs(&conn).unwrap().contains(&run_id));

        for node in list_fsm_nodes(&conn, &run_id).unwrap() {
            update_fsm_node_status(&conn, &node.id, "complete").unwrap();
        }
        assert!(!list_active_fsm_runs(&conn).unwrap().contains(&run_id));
    }

    #[test]
    fn workspace_summary_aggregates_all_core_assets() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        migrate_thought_last_referenced(&conn).unwrap();

        create_project(&conn, "Summary Project", "/tmp/summary").unwrap();
        create_task(&conn, "Summary Task", true, None, false).unwrap();
        create_thought(&conn, "Summary Thought", "#test", "inbox").unwrap();
        create_session(&conn, "Summary Session", "openai").unwrap();
        create_provider(
            &conn,
            "Summary Provider",
            "http://localhost",
            "key",
            "model",
        )
        .unwrap();

        let summary = get_workspace_summary(&conn).unwrap();
        assert_eq!(summary.projects.len(), 1);
        assert_eq!(summary.tasks.len(), 1);
        assert_eq!(summary.thoughts.len(), 1);
        assert_eq!(summary.sessions.len(), 1);
        assert_eq!(summary.providers.len(), 1);
    }

    #[test]
    fn delivery_runs_persist_update_and_list_newest_first() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();

        let gate = serde_json::json!({
            "status": "FAILED",
            "errors": ["error A"],
            "levels": []
        });
        let first = DeliveryRun {
            run_id: "delivery-1".to_string(),
            project_path: "/project".to_string(),
            command: String::new(),
            exit_code: None,
            started_at: 100,
            finished_at: Some(150),
            gate_result: Some(gate),
            fix_round: 0,
        };
        let second = DeliveryRun {
            run_id: "delivery-2".to_string(),
            project_path: "/project".to_string(),
            command: "claude".to_string(),
            exit_code: Some(0),
            started_at: 200,
            finished_at: Some(250),
            gate_result: None,
            fix_round: 1,
        };

        let saved = record_delivery_run(&conn, &first).unwrap();
        assert_eq!(saved.run_id, "delivery-1");
        assert_eq!(
            saved.gate_result.as_ref().unwrap()["status"],
            serde_json::Value::String("FAILED".to_string())
        );

        record_delivery_run(&conn, &second).unwrap();
        let updated = DeliveryRun {
            run_id: "delivery-2".to_string(),
            exit_code: Some(1),
            fix_round: 2,
            ..second
        };
        record_delivery_run(&conn, &updated).unwrap();

        let runs = list_delivery_runs(&conn, 10).unwrap();
        assert_eq!(runs.len(), 2);
        assert_eq!(runs[0].run_id, "delivery-2");
        assert_eq!(runs[0].exit_code, Some(1));
        assert_eq!(runs[0].fix_round, 2);
        assert_eq!(runs[1].run_id, "delivery-1");
        assert!(get_delivery_run(&conn, "missing").unwrap().is_none());
    }

    #[test]
    fn agent_catalog_import_is_idempotent_and_persists() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-agent-catalog-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let inputs = vec![
            AgentCatalogInput {
                division: "Product".to_string(),
                name: "Product Lead".to_string(),
                slug: "product-lead".to_string(),
                description: "Owns PRD".to_string(),
                emoji: "🧭".to_string(),
                color: "ocean".to_string(),
                developer_instructions: "Draft PRD".to_string(),
                tools: vec!["read".to_string()],
                source_url: "https://example.com/product-lead".to_string(),
            },
            AgentCatalogInput {
                division: "Engineering".to_string(),
                name: "Rust Architect".to_string(),
                slug: "rust-architect".to_string(),
                description: "Owns architecture".to_string(),
                emoji: "🦀".to_string(),
                color: "emerald".to_string(),
                developer_instructions: "Design modules".to_string(),
                tools: vec!["read".to_string(), "write".to_string()],
                source_url: "https://example.com/rust-architect".to_string(),
            },
        ];
        let imported = import_agent_catalog(&conn, &inputs).unwrap();
        assert_eq!(imported.len(), 2);
        assert!(imported
            .iter()
            .any(|agent| agent.slug == "rust-architect" && agent.tools.len() == 2));

        let mut product = inputs[0].clone();
        product.description = "Owns PRD v2".to_string();
        import_agent_catalog(&conn, &[product]).unwrap();
        let catalog = list_agent_catalog(&conn).unwrap();
        assert_eq!(catalog.len(), 2);
        assert!(catalog
            .iter()
            .any(|agent| agent.slug == "product-lead" && agent.description == "Owns PRD v2"));
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        assert_eq!(list_agent_catalog(&conn).unwrap().len(), 2);
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn team_presets_and_cli_tool_detections_persist() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-team-preset-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let preset = create_team_preset(
            &conn,
            "产品评审团",
            &["product-lead".to_string(), "ui-designer".to_string()],
        )
        .unwrap();
        assert_eq!(preset.agent_slugs.len(), 2);

        let updated = update_team_preset(
            &conn,
            &preset.id,
            "产品评审团 v2",
            &["product-lead".to_string()],
        )
        .unwrap();
        assert_eq!(updated.agent_slugs.len(), 1);

        let tools = vec![CliToolDetection {
            bin: "claude".to_string(),
            label: "Claude Code".to_string(),
            detected: true,
            last_checked_at: 0,
        }];
        let saved = save_cli_tool_detections(&conn, &tools).unwrap();
        assert_eq!(saved.len(), 1);
        assert!(saved[0].detected);

        delete_team_preset(&conn, &preset.id).unwrap();
        assert!(list_team_presets(&conn).unwrap().is_empty());
        assert!(delete_team_preset(&conn, &preset.id).is_err());
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let cli = list_cli_tools(&conn).unwrap();
        assert_eq!(cli.len(), 1);
        assert_eq!(cli[0].bin, "claude");
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
