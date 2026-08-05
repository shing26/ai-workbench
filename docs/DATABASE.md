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

## Sprint 46：索引并发自动调优

无表结构变更。新增 `recommend_index_concurrency` 命令，按设备可用并行度返回推荐并发（1~16）；`index_vault_ex` 的 concurrency 参数 clamp 语义不变，Knowledge UI 的 Auto 开关只是把推荐值透传给索引命令。

## Sprint 47：目标级索引统计

```sql
ALTER TABLE knowledge_files ADD COLUMN vault_path TEXT NOT NULL DEFAULT '';
```

- `init_connection` 对旧库执行幂等迁移：`column_exists(knowledge_files, vault_path)` 为 false 时执行 `ALTER TABLE`，重复启动安全。
- `upsert_knowledge_file` 新增 `vault_path` 参数并写入新列；`index_vault_files`、`upsert_markdown_path`、`sync_vault_path` 与 watch 事件同步携带目标路径。
- 新增 `vault_target_stats(conn)`：按 `vault_path <> ''` 分组返回 `{ path, files, last_indexed_at }`，旧记录（空路径）不进入统计。
- 新增 Tauri 命令 `list_vault_target_stats`，Knowledge UI 每个 vault 目标行显示独立文件数；浏览器 fallback 按目标前缀统计 `readVaultFiles()`。

## Sprint 48：同步审计筛选与导出

无表结构变更。`list_sync_audit` 增加可选 `event` 参数，按事件精确过滤后按 `created_at DESC, id DESC` 返回；`export_sync_audit(format, event)` 复用同一过滤逻辑，JSON 输出美化数组，CSV 输出 `id,event,detail,device_id,created_at` 表头并对逗号、双引号、CR/LF 转义。

## Sprint 49：按文件规模动态索引并发

无表结构变更。`index_vault_ex` 的 `concurrency = 0` 表示 Auto：`index_vault_files` 扫描后按 `plan_index_concurrency`（≤32 文件用 1，≤256 或大文件 ≥8 用 4 上限，其余按核数）选择实际工作线程；`IndexResult` 新增 `concurrency_used` 返回实际值。

## Sprint 50：同步冲突三方合并

无表结构变更。`sync_conflicts.resolved_choice` 新增 `union` 取值：`resolve_conflict_union` 按行并集写回 clipboard/log 并标记 union；`resolve_conflicts_union` 单事务批量执行；审计新增 `sync.resolve.union` 与 `sync.resolve.union.batch`。

## Sprint 51：审计时间与设备组合筛选

无表结构变更。`list_sync_audit` 新增 `since` / `device_id` 参数，与既有 `event` 组合过滤；`export_sync_audit` 透传相同条件，确保导出与列表一致。

## Sprint 52：watch 目标级事件统计

```sql
ALTER TABLE vault_watch_targets ADD COLUMN last_event_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_watch_targets ADD COLUMN event_count INTEGER NOT NULL DEFAULT 0;
```

- `migrate_vault_watch_event_stats` 幂等执行两列迁移；`touch_vault_watch_event` UPSERT 累加 `event_count` 并更新 `last_event_at`。
- watch 事件写回成功后埋点；`vault_target_stats` 通过 `LEFT JOIN vault_watch_targets` 返回 `last_event_at` / `event_count`。

## Sprint 43：同步冲突批量仲裁

新增 `resolve_conflicts(conn, conflicts, choice)`：用 `unchecked_transaction` 在单事务内批量调用 `resolve_conflict`，任一冲突裁决失败则事务回滚，成功后返回解决数量。由于 `Connection` 只持有不可变引用，事务改用 `unchecked_transaction` 实现。

- Tauri 命令 `resolve_sync_conflicts(conflicts, choice)` 透传冲突明细数组与选择，返回 `Result<usize, String>`。
- 浏览器 fallback 逐条调用 `resolveSyncConflict`，写入 `ai-workbench:sync-conflicts:v1` 的 resolved_choice / resolved_at，与 Rust 语义一致。
- 表结构与数据迁移不变；批量仲裁复用 Sprint 40 的持久化冲突记录与历史。

## Sprint 53：vault 索引进度事件

无表结构变更。索引进度通过 Tauri Event 推送，`start_vault_index` 返回 `runId` 供前端追踪，不新增持久化字段。

## Sprint 54：可取消 vault 索引任务

无表结构变更。取消状态仅保存在运行期 `VaultIndexState` 内存集合中，随任务终态清理，不落库。

## Sprint 55：结构化字段级合并

无表结构变更。`sync_conflicts.resolved_choice` 新增 `structured` 取值；合并逻辑为纯函数，不新增字段或迁移。

## Sprint 56：自定义审计日期范围

无表结构变更。`sync_audit_log` 查询新增 `until` 条件，仅使用已有 `created_at` 列。

## Sprint 57：watch 事件类型细分

```sql
ALTER TABLE vault_watch_targets ADD COLUMN created_events INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_watch_targets ADD COLUMN modified_events INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_watch_targets ADD COLUMN removed_events INTEGER NOT NULL DEFAULT 0;
```

- `migrate_vault_watch_event_stats` 按列存在性幂等补三列；`touch_vault_watch_event(path, event_kind)` 分别累计三类计数。

## Sprint 58：结构化合并对象数组按 key 去重

无表结构变更。去重逻辑为纯函数，仅在内存中对 JSON 数组项做规范化标记。

## Sprint 59：Vault Index 串行任务队列

无表结构变更。队列状态保存在 `VaultIndexState` 内存中（active 请求 + FIFO 队列 + cancelled 集合），`vault-index-progress` / `vault-index-queue` 事件仅做前端状态同步。

## Sprint 60：审计按日/周聚合图表

无表结构变更。`get_sync_audit_summary` 在内存中按 `created_at` 的 UTC 日（86400000ms 对齐）或周（周一 00:00）分组，统计 merge / resolve / other 三类；bucket 数 <= 62 时补齐缺失日期/周。浏览器 fallback 在 `ai-workbench:sync-audit:v1` 上执行同一聚合。

## Sprint 61：watch 事件时间线

```sql
CREATE TABLE IF NOT EXISTS vault_watch_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vault_watch_events_vault_created
    ON vault_watch_events(vault_path, created_at DESC);
```

- `touch_vault_watch_event(vault_path, file_path, event_kind)` 每次写回成功插入一条时间线，再按 `id DESC` 裁剪到最新 500 条；`event_kind` 仅接受 `created` / `modified` / `removed`。
- `list_vault_watch_events(vault_path?, limit)` 按 `created_at DESC, id DESC` 返回；`clear_vault_watch_events(vault_path?)` 支持按 vault 或全量清空。
- `delete_vault_watch_target` 删除目标时级联清理该 vault 的事件，避免孤儿记录。
- 浏览器 fallback 用 `ai-workbench:vault-watch-events:v1` 保存同一时间线。

## Sprint 62：错误日志趋势与聚合

无表结构变更。`error_log_summary` 在内存中按 `error_logs.updated_at` 的 UTC 日（86400000ms 对齐）或周（周一 00:00）分组，支持可选 `source` / `severity` 过滤；bucket 内按 `error` / `warning` / `info` 拆分计数，bucket 数 <= 62 时补齐缺失区间。浏览器 fallback 在 `ai-workbench:db:v1` 的 `logs` 上执行同一聚合。

## Sprint 63：RAG 文档状态面板

无表结构变更。`list_knowledge_files` 读取 `knowledge_files` 既有列（`id / path / title / tags / vault_path / indexed_at`），按 `indexed_at DESC, path ASC` 排序；`vault_path` 为空字符串的记录表示未归属任何 vault 的 legacy 文档，仍可单独过滤。

## Sprint 64：文档存在性与过期检测

无表结构变更。`exists` / `stale` 为运行时计算字段：`exists` 由 `Path::exists` 判定，`stale` 在文件存在且 mtime 比 `indexed_at` 晚超过 1 秒时为 true；不写入数据库。

## Sprint 65：文档健康一键清理与重新索引

无表结构变更。`cleanup_knowledge_files` 复用 `knowledge_files` 既有列：missing 文档执行 `DELETE`，stale 文档重读磁盘内容后按 `path` upsert 并刷新 `indexed_at`；浏览器 fallback 在 `ai-workbench:vault:v1` 上写回 `exists` / `stale` 模拟状态与清理结果。

## Sprint 66：Vault 索引任务队列持久化

```sql
CREATE TABLE IF NOT EXISTS vault_index_queue (
    run_id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    ignore_patterns TEXT NOT NULL DEFAULT '[]',
    concurrency INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

- `persist_vault_index_queue` 按 run_id upsert，`ignore_patterns` 以 JSON 数组序列化；`list_vault_index_queue` 按 `created_at ASC, rowid ASC` 返回 pending 记录。
- `delete_vault_index_queue` 在任务完成、出错或排队取消时删除记录；启动恢复时 `running` 记录重置为 `queued` 重新入队。
- 浏览器 fallback 用 `ai-workbench:vault-index-queue:v1` 保存同一队列，重载后自动恢复并 drain。

## Sprint 67：Git 活动看板

无表结构变更。`get_git_activity` 复用 `projects` 表既有列，Git 状态来自磁盘 `.git/HEAD` 与 `logs/HEAD` 的运行时解析；`last_commit_at` / `dirty` / `changed_files` 均为运行时计算字段，不落库。

## Sprint 68：错误日志来源 / 设备组合筛选

```sql
ALTER TABLE error_logs ADD COLUMN device_id TEXT NOT NULL DEFAULT '';
```

- `migrate_error_log_device` 按列存在性幂等补列，旧库升级不丢记录；`report_frontend_error` 与 `merge_error_log` 写入 / 更新 device_id。
- `error_log_summary` 在内存中按 `device_id` 组合过滤，不新增额外表；浏览器 fallback 在 `ai-workbench:db:v1` 的 logs 上执行同一过滤。

## Sprint 69：文档健康自动定时巡检

无表结构变更。自动巡检配置（开关、间隔、上次运行时间与结果）仅保存在前端 `ai-workbench:doc-health-auto:v1`；巡检复用 `cleanup_knowledge_files` 命令，不新增持久化字段。

## Sprint 70：Git 看板时间范围与提交人过滤

无表结构变更。`get_git_activity` 继续复用 `projects` 表既有列；`sinceMs / untilMs / committer` 均为运行时过滤参数，`committer` 与 `committers` 来自 `logs/HEAD` 运行时解析，不落库。

## Sprint 71：索引队列优先级与失败重试

```sql
ALTER TABLE vault_index_queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_index_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vault_index_queue ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
```

- `migrate_vault_index_queue_priority` 按列存在性幂等补列，旧库升级不丢记录；`persist_vault_index_queue` 改为接收 `VaultIndexQueueRecord`，保留 `created_at` 供同优先级 FIFO 排序。

## Sprint 72：自动巡检运行历史与通知提醒

无表结构变更。运行历史与提醒 Dismiss 状态保存在前端 `ai-workbench:doc-health-history:v1`（最多 50 条）与 `ai-workbench:doc-health-alert-dismissed:v1`；巡检仍复用 `cleanup_knowledge_files` 命令。

## Sprint 73：Git 活动看板 dirty 文件预览与提交趋势

无表结构变更。`changed_paths` 与 `commit_trend` 均为运行时计算字段：前者来自 `git status --short` 输出，后者来自 `.git/logs/HEAD` 全部行的时间戳，不新增持久化字段。

## Sprint 74：索引队列指数退避

无表结构变更。`retry_delay_ms` 为运行时计算字段，由 `attempts` 按 500ms 基数、2 倍增长、4000ms 封顶推导；`vault_index_queue` 仍只持久化 `attempts / last_error`。

## Sprint 75：AI Studio 日常 Quick Prompts

无表结构变更。Quick Prompt 模板为前端静态常量，不落库；点击后仅填充输入框，不新增持久化字段。

## Sprint 76：Actions 今日进度总览

无表结构变更。今日进度为 ActionsView 基于 `tasks / habits / schedule_events` 的运行时聚合，不新增持久化字段。

## Sprint 77：Quick Prompt 自定义与本地持久化

无表结构变更。自定义 Quick Prompt 保存在前端 `ai-workbench:quick-prompts:v1`，每条含 `id / label / category / text / custom`，不写入 SQLite。

## Sprint 78：Git dirty 逐文件 diff 预览

无表结构变更。`get_git_file_diff` 复用 `projects` 表的 path 字段，diff 内容来自工作区磁盘与 Git 索引的运行时读取，不新增持久化字段；浏览器 fallback 由 `db.ts` 直接生成 mock diff，同样不落库。

## Sprint 79：Quick Prompt 按使用频次排序

无表结构变更。Quick Prompt 使用次数保存在前端 `ai-workbench:quick-prompt-usage:v1`，以 `prompt id -> count` 映射存储，不写入 SQLite；排序完全由前端运行时计算。

## Sprint 80：AI 生成式今日复盘

无表结构变更。复盘上下文由 AIStudioView 从 `tasks / habits / schedule_events` 运行时聚合，提示词只作为聊天消息写入既有 `chat_messages`，不新增持久化字段。

## Sprint 81：Git 批量提交内容预览

无表结构变更。批量预览内容来自 `get_git_file_diff` 的运行时读取，仅在组件内存中合并展示，不新增持久化字段。

## Sprint 82：一键提交选中文件

无表结构变更。`commit_git_files` 只操作 Git 工作区与索引，提交结果仍为运行时返回，不新增持久化字段。

## Sprint 83：Webhook 真实投递

无表结构变更。`deliver_webhook` 直接发起运行时 HTTP 请求，结果只在 System 视图回显，不新增持久化字段或表。

## Sprint 84：Webhook 定时器 / 触发器规则

```sql
CREATE TABLE IF NOT EXISTS webhook_rules (
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
);
CREATE INDEX IF NOT EXISTS idx_webhook_rules_enabled ON webhook_rules(enabled, interval_seconds);
```

- 新表由 `SCHEMA` 自动创建，无旧库迁移；浏览器 fallback 使用 `ai-workbench:webhook-rules:v1` 保存同一模型。

## Sprint 85：Git 暂存 / 未暂存分组与提交前 lint 门禁

无表结构变更。`change_groups` 与 lint 门禁结果均为运行时计算：前者来自 `git status --short` 的 XY 前缀，后者来自提交前对工作区文件的读取，不新增持久化字段或表。

## Sprint 86：AI 复盘结果一键保存为知识笔记

无表结构变更。复盘笔记复用既有 `thoughts` 表（Rust 侧）或 `ai-workbench:db:v1` 的 `thoughts` 数组（浏览器 fallback），新增记录为 `type='note'`、`tags='#daily,#recap'`，不新增字段或表。

## Sprint 87：自定义 Quick Prompt 与使用次数多端同步

```sql
CREATE TABLE IF NOT EXISTS quick_prompts (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    text TEXT NOT NULL,
    custom INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quick_prompt_usage (
    id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
```

- 新表由 `SCHEMA` 自动创建，无旧库迁移；浏览器 fallback 继续使用 `ai-workbench:quick-prompts:v1` / `ai-workbench:quick-prompt-usage:v1`。
- `quick_prompt_usage.id` 覆盖内置与自定义 prompt；`record_quick_prompt_usage` 以 `ON CONFLICT(id) DO UPDATE SET count = count + 1` 累加，同步合并取两端较大 count。

## Sprint 88：Quick Prompt 编辑与拖拽排序

```sql
-- Sprint 87 建表后，旧库由 migrate_quick_prompt_order 补充该列
ALTER TABLE quick_prompts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE quick_prompts SET sort_order = rowid WHERE sort_order = 0;
```

- 新库的 `quick_prompts` 建表语句已直接包含 `sort_order INTEGER NOT NULL DEFAULT 0`；`QuickPrompt.order` 经 serde 命名映射为 JSON `order`，随 Sync Snapshot 同步。
- `update_custom_quick_prompt` 只允许 `custom = 1` 的行，保留 `created_at` 与 `sort_order`；`reorder_custom_quick_prompts` 单事务把传入 id 依次重编号为 0..n-1。

## Sprint 89：行内着色 diff 与整文件对比

无表结构变更。`get_git_file_versions` 为运行时命令：旧内容来自 `git show HEAD:file`，新内容来自工作区磁盘读取，status 来自 `git status --porcelain`，不新增持久化字段或表；浏览器 fallback 仍由既有 `getGitFileDiff` mock 派生，不涉及 localStorage 新 key。

## Sprint 90：Webhook 签名与自动重试

```sql
-- Sprint 84 建表后，旧库由 migrate_webhook_secret_retries 补充这两列
ALTER TABLE webhook_rules ADD COLUMN secret TEXT NOT NULL DEFAULT '';
ALTER TABLE webhook_rules ADD COLUMN retries INTEGER NOT NULL DEFAULT 1;
```

- 新库的 `webhook_rules` 建表语句已直接包含 `secret TEXT NOT NULL DEFAULT ''` 与 `retries INTEGER NOT NULL DEFAULT 1`；`WebhookRule.secret` / `retries` 经 serde 映射为 JSON `secret` / `retries`。
- `create_webhook_rule` 通过 `WebhookRuleInput` 写入 secret / retries；调度器与 `run_webhook_rule` 读取该字段驱动签名与重试，浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1` 保存同一模型。

## Sprint 91：RAG 命中人工确认

无表结构变更。命中确认是 AI Studio 会话内的前端状态：`ragConfirmMode` / `pendingSend` / `pendingSelected` 均不持久化，也不新增 localStorage key 或 SQLite 字段。

## Sprint 92：Sync E2E 加密

无表结构变更。E2E 加密只作用于同步 payload：Rust 侧在内存中完成 PBKDF2 + AES-GCM，浏览器侧使用 `ai-workbench:sync-encrypted:v1` 保存加密 envelope，不新增 SQLite 表或字段，也不把 salt / nonce / 口令写入数据库。

## Sprint 93：UI 动效残留补全

无表结构变更。Project 轮播是前端视图状态（`orbit` / `fan` 模式、当前索引、autoplay 开关均不持久化）；Material 设置保存在前端 `ai-workbench:material-settings:v1`，只改 CSS 变量，不新增 SQLite 表或字段。

## Sprint 94：本地向量 RAG

```sql
-- Sprint 94 建表后，旧库由 migrate_knowledge_embedding 补充该列
ALTER TABLE knowledge_files ADD COLUMN embedding TEXT DEFAULT '';
```

- 新库的 `knowledge_files` 建表语句已直接包含 `embedding TEXT DEFAULT ''`；`migrate_knowledge_embedding` 按列存在性幂等补列并把 `NULL` 回写为空串，已加入 `init_connection` 迁移链。
- `upsert_knowledge_file` 在写入文档内容时同步生成 256 维确定性向量并序列化为 JSON 存入 `embedding`；`search_thoughts` 读取该列，为空时回退按内容即时计算。
- 向量不参与同步快照：`SyncSnapshot` 结构与协议不变，跨设备仍只同步文档内容，检索端各自生成等价 embedding。

## Sprint 95：Provider 模型配置

```sql
-- Sprint 95 建表后，旧库由 migrate_provider_model 补充该列
ALTER TABLE providers ADD COLUMN model TEXT DEFAULT '';
```

- 新库的 `providers` 建表语句已直接包含 `model TEXT DEFAULT ''`；`migrate_provider_model` 按列存在性幂等补列并把 `NULL` 回写为空串，已加入 `init_connection` 迁移链。
- `list_providers` / `get_provider` / `create_provider` 均读写 `model`；新增 `update_provider_model` Tauri 命令用于编辑既有 Provider 的模型名。
- `model` 属于本地 Provider 配置，不进入 `SyncSnapshot`：同步协议无变化，浏览器 fallback 继续保存在 `ai-workbench:db:v1` 的 `providers` 数组中。

## Sprint 96：Webhook 事件触发器与投递队列

```sql
-- Sprint 84 建表后，旧库由 migrate_webhook_trigger_event 补充该列
ALTER TABLE webhook_rules ADD COLUMN trigger_event TEXT NOT NULL DEFAULT '';

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
```

- 新库的 `webhook_rules` 建表语句已直接包含 `trigger_event TEXT NOT NULL DEFAULT ''`；`migrate_webhook_trigger_event` 按列存在性幂等补列，已加入 `init_connection` 迁移链。
- `webhook_deliveries` 是投递队列的事实来源：定时与事件规则都由 `enqueue_webhook_delivery` 写入，worker 用 `claim_due_webhook_deliveries` 认领并回写 `attempts / status / last_status / last_message / next_attempt_at`。
- `status` 取值：`queued`（待投递）、`delivering`（已认领）、`success`（投递成功）、`dead`（超过 `retries + 1` 次仍失败）；`retry_webhook_delivery` 重置为 `queued / attempts 0 / next_attempt_at = now`。
- `delete_webhook_rule` 会级联 `DELETE FROM webhook_deliveries WHERE rule_id = ?`；`clear_webhook_deliveries` 支持按 status 过滤或清空全表。
- 浏览器 fallback 使用 `ai-workbench:webhook-deliveries:v1` 保存同一模型，不写入 SQLite。

## Sprint 97：Provider /models 探测

无表结构变更。`list_provider_models` 是运行时探测：结果不落库，模型仍由 `providers.model` 保存；浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `providers` 数组，不新增 localStorage key。

## Sprint 98：Webhook payload 模板渲染

无表结构变更。模板渲染发生在入队 / 投递时：`webhook_rules.payload` 保存模板原文，`webhook_deliveries.payload` 保存渲染后的最终 JSON；浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1` 与 `ai-workbench:webhook-deliveries:v1`，不新增字段或 key。

## Sprint 99：系统事件总线与投递刷新

无表结构变更。系统事件不新增表或字段：`webhook_rules.trigger_event` 继续作为事件匹配键，`webhook_deliveries` 承接事件投递；`workbench:webhook-deliveries-updated` 只是前端刷新信号，不落库。浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1` 与 `ai-workbench:webhook-deliveries:v1`。

## Sprint 100：会话置顶与消息数

`sessions` 新增 `pinned INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 建表语句已直接包含该列，旧库由 `migrate_session_pinned` 幂等补列，已加入 `init_connection` 迁移链。`message_count` 不落库，由 `list_sessions` 子查询 `COUNT(*) FROM chat_messages WHERE session_id = sessions.id` 实时计算；`duplicate_session` 复制会话与消息，返回新会话的消息数。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `sessions` 与 `chatMessages`，旧数据在读取时自动补 `pinned=false`。

## Sprint 101：真实 MOA 并行

无表结构变更。MOA 并行是运行时行为：同一个 `runId` 下对前 3 个启用 Provider 并发流式请求，数据仍由 `chat_messages` 落库，不新增表或字段。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `providers` / `chatMessages`，不新增 localStorage key。
