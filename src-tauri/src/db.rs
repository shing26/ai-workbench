use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflictItem {
    pub id: String,
    pub kind: String,
    pub local_updated_at: i64,
    pub remote_updated_at: i64,
    pub resolved_to: String,
    pub preview: String,
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
    seed_if_empty(&conn)?;
    Ok(conn)
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
            MergeOutcome::Updated { local_updated_at } => {
                clipboard_updated += 1;
                conflicts.push(SyncConflictItem {
                    id: item.id.clone(),
                    kind: "clipboard".to_string(),
                    local_updated_at,
                    remote_updated_at: item.updated_at,
                    resolved_to: "remote".to_string(),
                    preview: item.content.chars().take(120).collect(),
                });
            }
            MergeOutcome::Skipped { local_updated_at } => {
                if local_updated_at > item.updated_at {
                    conflicts.push(SyncConflictItem {
                        id: item.id.clone(),
                        kind: "clipboard".to_string(),
                        local_updated_at,
                        remote_updated_at: item.updated_at,
                        resolved_to: "local".to_string(),
                        preview: item.content.chars().take(120).collect(),
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
            MergeOutcome::Updated { local_updated_at } => {
                logs_updated += 1;
                conflicts.push(SyncConflictItem {
                    id: log.id.clone(),
                    kind: "log".to_string(),
                    local_updated_at,
                    remote_updated_at: log.updated_at,
                    resolved_to: "remote".to_string(),
                    preview: log.message.chars().take(120).collect(),
                });
            }
            MergeOutcome::Skipped { local_updated_at } => {
                if local_updated_at > log.updated_at {
                    conflicts.push(SyncConflictItem {
                        id: log.id.clone(),
                        kind: "log".to_string(),
                        local_updated_at,
                        remote_updated_at: log.updated_at,
                        resolved_to: "local".to_string(),
                        preview: log.message.chars().take(120).collect(),
                    });
                }
            }
        }
    }
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

enum MergeOutcome {
    Added,
    Updated { local_updated_at: i64 },
    Skipped { local_updated_at: i64 },
}

fn merge_clipboard_item(conn: &Connection, item: &ClipboardItem) -> Result<MergeOutcome> {
    let local_updated: Option<i64> = conn
        .query_row(
            "SELECT updated_at FROM clipboard_history WHERE id = ?1",
            params![item.id],
            |row| row.get(0),
        )
        .optional()?;
    match local_updated {
        Some(local) if local >= item.updated_at => Ok(MergeOutcome::Skipped {
            local_updated_at: local,
        }),
        Some(local) => {
            conn.execute(
                "UPDATE clipboard_history SET content = ?1, source = ?2, timestamp = ?3, updated_at = ?4 WHERE id = ?5",
                params![item.content, item.source, item.timestamp, item.updated_at, item.id],
            )?;
            Ok(MergeOutcome::Updated {
                local_updated_at: local,
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
    let local_updated: Option<i64> = conn
        .query_row(
            "SELECT updated_at FROM error_logs WHERE id = ?1",
            params![log.id],
            |row| row.get(0),
        )
        .optional()?;
    match local_updated {
        Some(local) if local >= log.updated_at => Ok(MergeOutcome::Skipped {
            local_updated_at: local,
        }),
        Some(local) => {
            conn.execute(
                "UPDATE error_logs SET source = ?1, message = ?2, stack = ?3, severity = ?4, timestamp = ?5, updated_at = ?6 WHERE id = ?7",
                params![log.source, log.message, log.stack, log.severity, log.timestamp, log.updated_at, log.id],
            )?;
            Ok(MergeOutcome::Updated {
                local_updated_at: local,
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
) -> Result<()> {
    conn.execute(
        "INSERT INTO knowledge_files (id, path, title, tags, content, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(path) DO UPDATE SET
           title = excluded.title,
           tags = excluded.tags,
           content = excluded.content,
           indexed_at = excluded.indexed_at",
        params![uid(), path, title, tags, content, now_millis()],
    )?;
    Ok(())
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
