use rusqlite::{params, Connection, Result};
use serde::Serialize;
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
    timestamp INTEGER
);
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    severity TEXT DEFAULT 'error',
    timestamp INTEGER
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
pub struct Provider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub is_active: bool,
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: String,
    pub content: String,
    pub source: String,
    pub timestamp: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLog {
    pub id: String,
    pub source: String,
    pub message: String,
    pub stack: Option<String>,
    pub severity: String,
    pub timestamp: i64,
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
    seed_if_empty(&conn)?;
    Ok(conn)
}

fn seed_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
    if count > 0 {
        seed_habits_if_empty(conn)?;
        seed_events_if_empty(conn)?;
        seed_system_if_empty(conn)?;
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
        "INSERT INTO clipboard_history (id, content, source, timestamp) VALUES (?1, ?2, 'terminal', ?3)",
        params![uid(), "pnpm run dev", now - 5000],
    )?;
    conn.execute(
        "INSERT INTO clipboard_history (id, content, source, timestamp) VALUES (?1, ?2, 'editor', ?3)",
        params![uid(), "bg-[#18181C] border-white/10 rounded-2xl", now - 4000],
    )?;
    Ok(())
}

fn seed_logs_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM error_logs", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp) VALUES (?1, 'tauri', 'DB initialized', NULL, 'info', ?2)",
        params![uid(), now_millis() - 7000],
    )?;
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
        "SELECT COUNT(*) FROM clipboard_history WHERE content = ?1 AND timestamp > ?2",
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
        "INSERT INTO clipboard_history (id, content, source, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params![id, trimmed, source, timestamp],
    )?;
    Ok(ClipboardItem {
        id,
        content: trimmed.to_string(),
        source: source.to_string(),
        timestamp,
    })
}

pub fn list_clipboard(conn: &Connection) -> Result<Vec<ClipboardItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, content, source, timestamp FROM clipboard_history ORDER BY timestamp DESC LIMIT 30",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ClipboardItem {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            timestamp: row.get(3)?,
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
        "INSERT INTO error_logs (id, source, message, stack, severity, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, source, message, stack, severity, timestamp],
    )?;
    Ok(ErrorLog {
        id,
        source: source.to_string(),
        message: message.to_string(),
        stack: stack.map(|s| s.to_string()),
        severity: severity.to_string(),
        timestamp,
    })
}

pub fn list_error_logs(conn: &Connection) -> Result<Vec<ErrorLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, source, message, stack, severity, timestamp FROM error_logs ORDER BY timestamp DESC LIMIT 30",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ErrorLog {
            id: row.get(0)?,
            source: row.get(1)?,
            message: row.get(2)?,
            stack: row.get(3)?,
            severity: row.get(4)?,
            timestamp: row.get(5)?,
        })
    })?;
    rows.collect()
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
    conn.execute(
        "UPDATE chat_messages SET content = ?1 WHERE id = ?2",
        params![content, id],
    )?;
    Ok(())
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
