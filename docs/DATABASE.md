# DATABASE

Local SQLite，路径与位置由 Rust 后台初始化时确定。Sprint 1 使用 5 张核心表。

## 1. projects

```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT,
    revenue REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',
    created_at INTEGER
);
```

## 2. tasks

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    is_today INTEGER DEFAULT 0,
    due_date TEXT,
    created_at INTEGER
);
```

`status`：`todo`、`in_progress`、`done`。`is_today = 1` 表示今日 Focus。

## 3. thoughts

```sql
CREATE TABLE IF NOT EXISTS thoughts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    tags TEXT,
    type TEXT DEFAULT 'inbox',
    created_at INTEGER
);
```

`tags` 格式：`#work,#life`。`type`：`inbox`、`note`、`doc`。

## 4. sessions

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    model TEXT,
    created_at INTEGER
);
```

`project_id` 关联 Projects，用于 AI Studio 与 Vibe Coding 上下文绑定。

## 5. providers

```sql
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    is_active INTEGER DEFAULT 1
);
```

`api_key` 仅保存 OS Keyring 引用名，不保存明文密钥。

## 索引

- `tasks(is_today, status)`
- `thoughts(type, created_at)`
- `sessions(project_id, created_at)`

## 迁移

启动时执行 `CREATE TABLE IF NOT EXISTS`，迁移脚本存放在 Rust 后台初始化流程中。示例数据仅在空库时写入。

