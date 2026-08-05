# DATABASE

Local SQLite，路径与位置由 Rust 后台初始化时确定。Sprint 1 使用 5 张核心表，Sprint 3 新增习惯与日程 3 张表，Sprint 4 新增系统采集 2 张表，共 10 张表。

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

`tags` 格式：`#work,#life`。`type`：`inbox`、`note`、`doc`。`content` 支持 Markdown，前端用 react-markdown 渲染。

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

## 6. habits

```sql
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    week_goal INTEGER DEFAULT 5,
    current_streak INTEGER DEFAULT 0,
    color TEXT DEFAULT 'emerald',
    created_at INTEGER
);
```

`color`：`emerald`、`blue`、`amber`、`rose`。`current_streak` 为连续打卡天数。

## 7. habit_logs

```sql
CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    date TEXT NOT NULL,
    checked_at INTEGER,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
```

`date` 为本地日期 `YYYY-MM-DD`。当天有记录表示该习惯今日已打卡。

## 8. schedule_events

```sql
CREATE TABLE IF NOT EXISTS schedule_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    tag TEXT DEFAULT 'general',
    created_at INTEGER
);
```

`start_time` 为 `HH:MM`，前端按时间排序展示日程时间线。

## 9. clipboard_history

```sql
CREATE TABLE IF NOT EXISTS clipboard_history (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT DEFAULT 'system',
    timestamp INTEGER
);
```

Rust 后台每 1.5 秒轮询系统剪贴板，内容变化时写入，并通过 `clipboard-updated` 事件推送前端。

## 10. error_logs

```sql
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    severity TEXT DEFAULT 'error',
    timestamp INTEGER
);
```

`source` 区分 `frontend` 与 `tauri`。前端 `error` / `unhandledrejection` 通过 `report_frontend_error` 入库。

## 索引

- `tasks(is_today, status)`
- `thoughts(type, created_at)`
- `sessions(project_id, created_at)`
- `habit_logs(habit_id, date)`
- `schedule_events(start_time)`
- `clipboard_history(timestamp)`
- `error_logs(timestamp)`

## 迁移

启动时执行 `CREATE TABLE IF NOT EXISTS`，迁移脚本放在 Rust 后台初始化流程中。示例数据仅在各表为空时写入：`projects`、`tasks`、`thoughts`、`providers`、`sessions`、`habits`、`schedule_events`、`clipboard_history`、`error_logs` 独立判断，避免已有库跳过新表 seed，也不覆盖真实采集记录。

## Sprint 23：Departments & Agents

一个部门可以拥有多个 Agent，Agent 可选绑定 Provider。

```sql
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
```

命令：`list_departments` / `list_agents` / `create_department` / `create_agent`。

## Sprint 24：Team 编排与 system_prompt

- `agents.system_prompt` 由种子数据提供（每个部门 Agent 都有职责化 Prompt），并支持运行时更新。
- 命令：`update_agent_system_prompt(id, system_prompt)`，更新后返回完整 Agent。
- AI Studio Team 模式按部门并行派发最多 3 个 Agent，各自注入自己的 system_prompt；单 Agent 派发同样注入。浏览器 localStorage fallback 与 Tauri SQLite 行为一致。

## Sprint 27：Agent Prompt 版本

```sql
CREATE TABLE IF NOT EXISTS agent_prompt_versions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    content TEXT,
    created_at INTEGER,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_agent ON agent_prompt_versions(agent_id, created_at);
```

更新 `agents.system_prompt` 时自动保存旧 Prompt 为版本；恢复版本前也会把当前 Prompt 再留档。命令：`list_agent_prompt_versions` / `restore_agent_prompt`。

## Sprint 28：Vault 自动文件监听同步

`knowledge_files` 不再只依赖手动全量扫描。`start_vault_watch(vault_path)` 先全量索引一次，再用 `notify` 递归监听目录；新增/修改 `.md` 自动 `upsert_knowledge_file`，删除自动清理，每次变更通过 `vault-watch-update` 事件推送最新状态。

新增命令：`start_vault_watch` / `stop_vault_watch` / `get_vault_watch_status`。`stop_vault_watch` 停止监听线程但保留已索引文件，RAG 搜索继续可用。
