use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    is_today INTEGER DEFAULT 0,
    due_date TEXT,
    created_at INTEGER
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
    created_at INTEGER
);
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
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
    updated_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_today ON tasks(is_today, status);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_events_time ON schedule_events(start_time);
CREATE INDEX IF NOT EXISTS idx_clipboard_timestamp ON clipboard_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE TABLE IF NOT EXISTS knowledge_files (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT,
    tags TEXT,
    content TEXT NOT NULL,
    vault_path TEXT NOT NULL DEFAULT '',
    indexed_at INTEGER
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
    event_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    device_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit_log(created_at DESC);
"#;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub is_today: bool,
    pub due_date: Option<String>,
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
pub struct Thought {
    pub id: String,
    pub content: String,
    pub tags: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub model: String,
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
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleEvent {
    pub id: String,
    pub title: String,
    pub start_time: String,
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
pub struct RagSearchResult {
    pub id: String,
    pub content: String,
    pub tags: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub score: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagIndexStatus {
    pub documents: i64,
    pub indexed: bool,
    pub last_indexed_at: i64,
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
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn today_local() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() as i64;
    let days = secs.div_euclid(86_400);
    let civil = days + 719_468;
    let era = civil.div_euclid(146_097);
    let doe = civil.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn init_connection(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    migrate_updated_at(&conn)?;
    migrate_version_parent(&conn)?;
    migrate_vault_watch_targets(&conn)?;
    migrate_vault_watch_event_stats(&conn)?;
    migrate_knowledge_vault_path(&conn)?;
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

fn migrate_version_parent(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "message_versions", "parent_version_id")? {
        conn.execute_batch("ALTER TABLE message_versions ADD COLUMN parent_version_id TEXT;")?;
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
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at) VALUES (?1, ?2, 'in_progress', 1, NULL, ?3)",
        params![uid(), "Ship App Shell", now],
    )?;
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at) VALUES (?1, ?2, 'todo', 1, NULL, ?3)",
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
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '晨间阅读', 5, 3, 'emerald', ?2)",
        params![uid(), now],
    )?;
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '深水工作', 4, 2, 'blue', ?2)",
        params![uid(), now],
    )?;
    conn.execute(
        "INSERT INTO habits (id, name, week_goal, current_streak, color, created_at) VALUES (?1, '运动 30 分钟', 3, 5, 'amber', ?2)",
        params![uid(), now],
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
        "INSERT INTO schedule_events (id, title, start_time, done, tag, created_at) VALUES (?1, '每日复盘', '09:30', 0, 'routine', ?2)",
        params![uid(), now],
    )?;
    conn.execute(
        "INSERT INTO schedule_events (id, title, start_time, done, tag, created_at) VALUES (?1, 'Sprint 3 验收', '14:00', 0, 'work', ?2)",
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
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at) VALUES (?1, 'tauri', 'DB initialized', NULL, 'info', ?2, ?3)",
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
    let mut stmt = conn.prepare("SELECT id, title, status, is_today, due_date, created_at FROM tasks ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            status: row.get(2)?,
            is_today: row.get::<_, i64>(3)? != 0,
            due_date: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn create_task(conn: &Connection, title: &str, is_today: bool) -> Result<Task> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO tasks (id, title, status, is_today, due_date, created_at) VALUES (?1, ?2, 'todo', ?3, NULL, ?4)",
        params![id, title, is_today as i64, now],
    )?;
    Ok(Task {
        id,
        title: title.to_string(),
        status: "todo".to_string(),
        is_today,
        due_date: None,
        created_at: now,
    })
}

pub fn update_task_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET status = ?1 WHERE id = ?2",
        params![status, id],
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

pub fn list_providers(conn: &Connection) -> Result<Vec<Provider>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, base_url, api_key, is_active FROM providers ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Provider {
            id: row.get(0)?,
            name: row.get(1)?,
            base_url: row.get(2)?,
            api_key: row.get(3)?,
            is_active: row.get::<_, i64>(4)? != 0,
        })
    })?;
    rows.collect()
}

pub fn get_provider(conn: &Connection, id: &str) -> Result<Option<Provider>> {
    let mut stmt =
        conn.prepare("SELECT id, name, base_url, api_key, is_active FROM providers WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Provider {
            id: row.get(0)?,
            name: row.get(1)?,
            base_url: row.get(2)?,
            api_key: row.get(3)?,
            is_active: row.get::<_, i64>(4)? != 0,
        })
    })?;
    rows.next().transpose()
}

pub fn create_provider(
    conn: &Connection,
    name: &str,
    base_url: &str,
    api_key: &str,
) -> Result<Provider> {
    let id = uid();
    conn.execute(
        "INSERT INTO providers (id, name, base_url, api_key, is_active) VALUES (?1, ?2, ?3, ?4, 0)",
        params![id, name, base_url, api_key],
    )?;
    Ok(Provider {
        id,
        name: name.to_string(),
        base_url: base_url.to_string(),
        api_key: api_key.to_string(),
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

pub fn list_habits(conn: &Connection) -> Result<Vec<Habit>> {
    let mut stmt = conn.prepare(
        "SELECT h.id, h.name, h.week_goal, h.current_streak, h.color, h.created_at,
                COALESCE(hl.id IS NOT NULL, 0)
         FROM habits h
         LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ?1
         ORDER BY h.created_at ASC",
    )?;
    let today = today_local();
    let rows = stmt.query_map(params![today], |row| {
        Ok(Habit {
            id: row.get(0)?,
            name: row.get(1)?,
            week_goal: row.get(2)?,
            current_streak: row.get(3)?,
            color: row.get(4)?,
            created_at: row.get(5)?,
            done_today: row.get::<_, i64>(6)? != 0,
        })
    })?;
    rows.collect()
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

pub fn list_schedule_events(conn: &Connection) -> Result<Vec<ScheduleEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, start_time, done, tag, created_at FROM schedule_events ORDER BY start_time ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ScheduleEvent {
            id: row.get(0)?,
            title: row.get(1)?,
            start_time: row.get(2)?,
            done: row.get::<_, i64>(3)? != 0,
            tag: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn create_schedule_event(
    conn: &Connection,
    title: &str,
    start_time: &str,
    tag: &str,
) -> Result<ScheduleEvent> {
    let id = uid();
    let now = now_millis();
    conn.execute(
        "INSERT INTO schedule_events (id, title, start_time, done, tag, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5)",
        params![id, title, start_time, tag, now],
    )?;
    Ok(ScheduleEvent {
        id,
        title: title.to_string(),
        start_time: start_time.to_string(),
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
) -> Result<ErrorLog> {
    let id = uid();
    let timestamp = now_millis();
    conn.execute(
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, source, message, stack, severity, timestamp, timestamp],
    )?;
    Ok(ErrorLog {
        id,
        source: source.to_string(),
        message: message.to_string(),
        stack: stack.map(|s| s.to_string()),
        severity: severity.to_string(),
        timestamp,
        updated_at: timestamp,
    })
}

pub fn list_error_logs(conn: &Connection) -> Result<Vec<ErrorLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, source, message, stack, severity, timestamp, updated_at FROM error_logs ORDER BY updated_at DESC LIMIT 30",
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
    for conflict in &conflicts {
        persist_conflict(conn, conflict)?;
    }
    let _ = append_sync_audit(
        conn,
        "sync.merge",
        &format!(
            "clips +{} / updated {} / logs +{} / updated {} / conflicts {}",
            clipboard_added,
            clipboard_updated,
            logs_added,
            logs_updated,
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
    let mut stmt = conn
        .prepare(
            "SELECT id, event, detail, device_id, created_at
             FROM sync_audit_log
             WHERE (?1 IS NULL OR event = ?1)
               AND (?2 IS NULL OR created_at >= ?2)
               AND (?3 IS NULL OR device_id = ?3)
             ORDER BY created_at DESC, id DESC LIMIT ?4",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![event, since, device_id, limit], |row| {
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
    let entries = list_sync_audit(conn, 10_000, event, since, device_id)?;
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
        "SELECT path, ignore_patterns, enabled, updated_at, last_event_at, event_count
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
        ))
    })?;
    let mut targets = Vec::new();
    for row in rows {
        let (path, raw, enabled, updated_at, last_event_at, event_count) = row?;
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
        });
    }
    Ok(targets)
}

fn get_vault_watch_target(conn: &Connection, path: &str) -> Result<Option<VaultWatchTarget>> {
    let row = conn.query_row(
        "SELECT path, ignore_patterns, enabled, updated_at, last_event_at, event_count
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
            ))
        },
    );
    match row {
        Ok((path, raw, enabled, updated_at, last_event_at, event_count)) => {
            Ok(Some(VaultWatchTarget {
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
            }))
        }
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
         (path, ignore_patterns, enabled, updated_at, last_event_at, event_count)
         VALUES (?1, ?2, ?3, ?4, 0, 0)
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
    })
}

pub fn touch_vault_watch_event(conn: &Connection, path: &str) -> Result<()> {
    let now = now_millis();
    conn.execute(
        "INSERT INTO vault_watch_targets
         (path, ignore_patterns, enabled, updated_at, last_event_at, event_count)
         VALUES (?1, '', 0, ?2, ?2, 1)
         ON CONFLICT(path) DO UPDATE SET
           last_event_at = excluded.last_event_at,
           event_count = event_count + 1",
        params![path, now],
    )?;
    Ok(())
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
                "UPDATE error_logs SET source = ?1, message = ?2, stack = ?3, severity = ?4, timestamp = ?5, updated_at = ?6 WHERE id = ?7",
                params![log.source, log.message, log.stack, log.severity, log.timestamp, log.updated_at, log.id],
            )?;
            Ok(MergeOutcome::Updated {
                local_updated_at: local_updated,
                local_content,
            })
        }
        None => {
            conn.execute(
                "INSERT INTO error_logs (id, source, message, stack, severity, timestamp, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![log.id, log.source, log.message, log.stack, log.severity, log.timestamp, log.updated_at],
            )?;
            Ok(MergeOutcome::Added)
        }
    }
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
                if seen.insert(item.to_string()) {
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
    let content = union_merge_content(&conflict.local_content, &conflict.remote_content);
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
    conn.execute(
        "INSERT INTO knowledge_files (id, path, title, tags, content, vault_path, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(path) DO UPDATE SET
           title = excluded.title,
           tags = excluded.tags,
           content = excluded.content,
           vault_path = excluded.vault_path,
           indexed_at = excluded.indexed_at",
        params![uid(), path, title, tags, content, vault_path, now_millis()],
    )?;
    Ok(())
}

pub fn vault_target_stats(conn: &Connection) -> Result<Vec<VaultTargetStats>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT f.vault_path, COUNT(*), MAX(f.indexed_at),
                    COALESCE(MAX(t.last_event_at), 0), COALESCE(MAX(t.event_count), 0)
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
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (path, files, last_indexed_at, last_event_at, event_count) =
            row.map_err(|e| e.to_string())?;
        out.push(VaultTargetStats {
            path,
            files,
            last_indexed_at: last_indexed_at.unwrap_or(0),
            last_event_at,
            event_count,
        });
    }
    Ok(out)
}

pub fn delete_knowledge_file(conn: &Connection, path: &str) -> Result<()> {
    conn.execute("DELETE FROM knowledge_files WHERE path = ?1", params![path])?;
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

pub fn search_thoughts(conn: &Connection, query: &str, limit: i64) -> Result<Vec<RagSearchResult>> {
    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        return Ok(Vec::new());
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
    let mut docs: Vec<(String, String, String, String, Vec<String>)> = rows
        .filter_map(Result::ok)
        .map(|(id, content, tags, kind)| {
            let tokens = tokenize(&content);
            (id, content, tags, kind, tokens)
        })
        .collect();
    let mut file_stmt = conn.prepare("SELECT id, content, tags FROM knowledge_files")?;
    let file_rows = file_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    for file in file_rows.flatten() {
        let (id, content, tags) = file;
        let tokens = tokenize(&content);
        docs.push((id, content, tags, "doc".to_string(), tokens));
    }
    if docs.is_empty() {
        return Ok(Vec::new());
    }
    let doc_count = docs.len() as f64;
    let avg_len = docs.iter().map(|d| d.3.len() as f64).sum::<f64>() / doc_count;

    let mut scored: Vec<(f64, RagSearchResult)> = Vec::new();
    for (id, content, tags, kind, tokens) in &docs {
        let doc_freq: f64 = docs
            .iter()
            .filter(|d| d.4.iter().any(|t| query_tokens.contains(t)))
            .count() as f64;
        let idf = ((doc_count - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0).ln();
        let mut score = 0.0;
        for term in &query_tokens {
            let tf = tokens.iter().filter(|t| *t == term).count() as f64;
            if tf > 0.0 {
                let norm = tokens.len() as f64;
                score +=
                    idf * (tf * 1.5) / (tf + 1.5 * (1.0 - 0.75 + 0.75 * (norm / avg_len.max(1.0))));
            }
        }
        if score > 0.0 {
            scored.push((
                score,
                RagSearchResult {
                    id: id.clone(),
                    content: content.clone(),
                    tags: tags.clone(),
                    kind: kind.clone(),
                    score,
                },
            ));
        }
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
        "SELECT id, project_id, title, model, created_at FROM sessions ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            model: row.get(3)?,
            created_at: row.get(4)?,
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
        drop(conn);

        std::fs::remove_dir_all(&dir).unwrap();
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
    fn habits_and_schedule_persist_across_reopen() {
        let dir = std::env::temp_dir().join(format!("aiwb-db-habit-test-{}", uid()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("workbench.db");

        let conn = init_connection(&db_path).unwrap();
        let habit = create_habit(&conn, "早睡", 5, "emerald").unwrap();
        assert!(!habit.done_today);
        let toggled = toggle_habit(&conn, &habit.id).unwrap();
        assert!(toggled.done_today);
        let event = create_schedule_event(&conn, "发布 Sprint 3", "20:00", "work").unwrap();
        assert!(!event.done);
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

        let events = list_schedule_events(&conn).unwrap();
        let saved_event = events
            .iter()
            .find(|e| e.id == event.id)
            .expect("created event should be listed");
        assert!(saved_event.done);
        assert_eq!(saved_event.start_time, "20:00");

        let untoggled = toggle_habit(&conn, &habit.id).unwrap();
        assert!(!untoggled.done_today);
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
        let log =
            report_frontend_error(&conn, "frontend", "boom", Some("at line 1"), "error").unwrap();
        drop(conn);

        let conn = init_connection(&db_path).unwrap();
        let items = list_clipboard(&conn).unwrap();
        assert!(items.iter().any(|i| i.id == item.id));
        let logs = list_error_logs(&conn).unwrap();
        assert!(logs.iter().any(|l| l.id == log.id));
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
        report_frontend_error(&conn_a, "a", "log from A", None, "info").unwrap();
        export_sync_snapshot(&conn_a, &snapshot_path).unwrap();

        let conn_b = init_connection(&device_b).unwrap();
        capture_clipboard(&conn_b, "from device B", "test").unwrap();
        report_frontend_error(&conn_b, "b", "log from B", None, "error").unwrap();

        let result = import_sync_snapshot(&conn_b, &snapshot_path).unwrap();
        assert!(result.clipboard_added >= 1);
        assert!(result.logs_added >= 1);
        let clips = list_clipboard(&conn_b).unwrap();
        assert!(clips.iter().any(|c| c.content == "from device A"));
        assert!(clips.iter().any(|c| c.content == "from device B"));
        let logs = list_error_logs(&conn_b).unwrap();
        assert!(logs.iter().any(|l| l.message == "log from A"));
        assert!(logs.iter().any(|l| l.message == "log from B"));
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
        };
        let third = merge_sync_snapshot(&conn, remote_equal).unwrap();
        assert_eq!(third.conflicts.len(), 0);
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
        let log = report_frontend_error(&conn, "test", "local log", None, "error").unwrap();
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
            }],
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

        upsert_vault_watch_target(&conn, "D:/work", &[], false).unwrap();
        let targets = list_vault_watch_targets(&conn).unwrap();
        assert_eq!(targets.len(), 2);
        assert_eq!(targets[1].path, "D:/work");
        assert!(!targets[1].enabled);

        touch_vault_watch_event(&conn, "D:/work").unwrap();
        touch_vault_watch_event(&conn, "D:/work").unwrap();
        let touched = list_vault_watch_targets(&conn).unwrap();
        let work = touched.iter().find(|t| t.path == "D:/work").unwrap();
        assert_eq!(work.event_count, 2);
        assert!(work.last_event_at > 0);

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
        touch_vault_watch_event(&conn, "C:/a").unwrap();

        let stats = vault_target_stats(&conn).unwrap();
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[0].path, "C:/a");
        assert_eq!(stats[0].files, 2);
        assert!(stats[0].last_indexed_at > 0);
        assert_eq!(stats[0].event_count, 1);
        assert!(stats[0].last_event_at > 0);
        assert_eq!(stats[1].path, "D:/b");
        assert_eq!(stats[1].files, 1);
        assert_eq!(stats[1].event_count, 0);

        upsert_knowledge_file(&conn, "C:/a/c.md", "C", "", "c", "C:/a").unwrap();
        let stats = vault_target_stats(&conn).unwrap();
        assert_eq!(stats[0].files, 3);

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
}
