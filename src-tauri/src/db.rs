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
CREATE INDEX IF NOT EXISTS idx_tasks_today ON tasks(is_today, status);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, created_at);
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
pub struct Provider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub is_active: bool,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_and_persist_task() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        seed_if_empty(&conn).unwrap();
        let task = create_task(&conn, "Today task", true).unwrap();
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
    }
}
