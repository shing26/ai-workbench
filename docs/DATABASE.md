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

## Sprint 33：跨设备云端同步传输

同步快照合并逻辑从本地文件导入导出中拆出为两个纯函数：

- `build_sync_snapshot(conn)`：读取设备 id、导出时间、`clipboard_history` 与 `error_logs`，生成 `SyncSnapshot`。
- `merge_sync_snapshot(conn, snapshot)`：按记录 id 判断新增或更新，`updated_at` 较新的一方胜出，返回 `SyncResult`。

`export_sync_snapshot` / `import_sync_snapshot` 继续复用上述函数，行为不变。新增 Tauri 命令：

- `push_sync_snapshot(remote_url, token?)`：构建快照后 PUT JSON 到远端，可选 `Authorization: Bearer <token>`。
- `pull_sync_snapshot(remote_url, token?)`：GET 远端 JSON 后按同一合并规则写入本地 SQLite。

远端同步不改变本地表结构，剪贴板与错误日志的冲突语义与 Sprint 19 一致：同 id 记录按 `updated_at` 新旧合并。

## Sprint 35：Vault 并行扫描与 ignore 列表

`knowledge_files` 表结构不变。`index_vault_files` 升级为两阶段：先递归收集 `.md` 路径（跳过 ignore 命中项），再用 `thread::scope` 最多 4 个工作线程并行读取与解析 frontmatter，主线程统一 upsert。`IndexResult` 新增 `ignored` 计数，返回实际索引数与跳过条目数。

新增命令：

- `index_vault_ex(vault_path, ignore_patterns)`：支持目录名（匹配任意层级）与 `**` / `*` glob；命中目录整体跳过。
- `index_vault(vault_path)`：默认空 ignore，保持旧行为兼容。

watch 状态下的增量监听 ignore 语义见 Sprint 36。

## Sprint 36：Vault watch 遵守 ignore 列表

watch 场景与全量扫描对齐 ignore 语义。新增 `start_vault_watch_ex(vault_path, ignore_patterns)`：启动时初始全量索引应用 ignore，后续增量事件经 `sync_vault_event` 先计算相对路径并执行 `should_ignore_path`，命中路径跳过 upsert/delete。

`start_vault_watch(vault_path)` 保持空 ignore 兼容。`knowledge_files` 表结构不变，`vault-watch-update` 事件与前端 watch 状态协议不变。

## Sprint 38：同步冲突明细

`SyncResult` 新增 `conflicts` 数组，元素为 `SyncConflictItem { id, kind, localUpdatedAt, remoteUpdatedAt, resolvedTo, preview }`。`merge_sync_snapshot` 在合并时记录每条同 id 记录的冲突方向：

- 远端 `updated_at` 更新 → `resolvedTo: "remote"`，内容被远端覆盖。
- 本地 `updated_at` 更新 → `resolvedTo: "local"`，远端旧版本被跳过。
- 两端时间戳相等 → 不产生冲突。

表结构与数据迁移不变；该字段只影响同步结果协议与 System UI 展示。

## Sprint 39：同步冲突人工仲裁

`SyncConflictItem` 新增 `localContent` / `remoteContent`，`merge_sync_snapshot` 在产生冲突时保留双方完整内容，作为人工仲裁依据。

新增仲裁逻辑：

- `resolve_conflict(conn, conflict, choice)`：`"local"` / `"remote"` 将对应内容写回 `clipboard_history.content` 或 `error_logs.message`，并更新 `updated_at` 为当前时间戳，使该裁决在下次同步中胜出；未知 choice 返回明确错误。
- Tauri 命令 `resolve_sync_conflict(conflict, choice)`：透传冲突明细与选择，返回 `Resolved <kind> conflict <id> with <choice>`。

浏览器 fallback 与 Rust 行为一致：按 kind 写回内容并更新时间戳。表结构与数据迁移不变。

## Sprint 40：冲突明细持久化与历史仲裁记录

```sql
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
```

- `merge_sync_snapshot` 将每条冲突明细持久化：同 id/kind 已有未解决记录时更新内容与时间戳，否则插入新记录。
- `resolve_conflict` 裁决后把 `resolved_choice` / `resolved_at` 写回对应未解决记录，保留历史。
- 新命令：`list_sync_conflicts(status)` 支持 `unresolved` / `resolved` / `all`；`clear_resolved_sync_conflicts` 只清理已解决记录。
- 浏览器 fallback 用 `ai-workbench:sync-conflicts:v1` 模拟同一行为。

## Sprint 41：Vault watch 配置持久化

```sql
CREATE TABLE IF NOT EXISTS vault_watch_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    path TEXT NOT NULL DEFAULT '',
    ignore_patterns TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
```

- `set_vault_watch_config` 以单行 upsert 保存 path、ignore_patterns（换行分隔）、enabled 与 updated_at；`get_vault_watch_config` 在无记录时返回空配置。
- `start_vault_watch_ex` 成功后写入 enabled=true；`stop_vault_watch` 保留 path/ignore 并写入 enabled=false。
- Tauri 启动时读取配置，若 enabled 且路径存在则自动重启 watch；浏览器 fallback 用 `ai-workbench:vault-watch:v1` 保存同一配置。

## Sprint 44：多 vault 并行 watch

```sql
CREATE TABLE IF NOT EXISTS vault_watch_targets (
    path TEXT PRIMARY KEY,
    ignore_patterns TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
```

- `init_connection` 自动把旧 `vault_watch_config` 单行迁移为 `vault_watch_targets` 的第一个目标（`INSERT OR IGNORE`，重复运行安全），旧表与 `get/set_vault_watch_config` 保留兼容。
- 新命令：`list_vault_watch_targets` 按 path 排序返回全部目标；`upsert_vault_watch_target` 按 path upsert；`set_vault_watch_target_enabled` 更新启用状态；`delete_vault_watch_target` 删除目标并返回是否删除。
- Rust 运行层 `VaultWatchState.active` 改为 watcher 列表，启动时只替换同路径实例，停止支持单路径与全停；应用启动时遍历 enabled 目标逐个恢复。
- 浏览器 fallback 用 `ai-workbench:vault-watch-targets:v1` 保存目标数组，并同步旧单行键保证兼容。

## Sprint 45：同步审计与事件日志

```sql
CREATE TABLE IF NOT EXISTS sync_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    device_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit_log(created_at DESC);
```

- `merge_sync_snapshot` 成功后写入 `sync.merge`：detail 含 clips/logs 新增与更新数、冲突数，device_id 取快照来源。
- `resolve_conflict` 写入 `sync.resolve`（kind + id + choice）；`resolve_conflicts` 事务提交后额外写入 `sync.resolve.batch`（数量 + choice）。
- `clear_resolved_sync_conflicts` 写入 `sync.history.cleared`（清理数量）。
- 新命令：`list_sync_audit(limit)` 按 created_at 倒序返回（limit clamp 1~200）；`clear_sync_audit` 清空全部审计。
- 浏览器 fallback 用 `ai-workbench:sync-audit:v1` 保存最近 200 条，与 Rust 语义一致。

## Sprint 43：同步冲突批量仲裁

新增 `resolve_conflicts(conn, conflicts, choice)`：用 `unchecked_transaction` 在单事务内批量调用 `resolve_conflict`，任一冲突裁决失败则事务回滚，成功后返回解决数量。由于 `Connection` 只持有不可变引用，事务改用 `unchecked_transaction` 实现。

- Tauri 命令 `resolve_sync_conflicts(conflicts, choice)` 透传冲突明细数组与选择，返回 `Result<usize, String>`。
- 浏览器 fallback 逐条调用 `resolveSyncConflict`，写入 `ai-workbench:sync-conflicts:v1` 的 resolved_choice / resolved_at，与 Rust 语义一致。
- 表结构与数据迁移不变；批量仲裁复用 Sprint 40 的持久化冲突记录与历史。
