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
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
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
    model TEXT DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1
);
```

`api_key` 仅保存 OS Keyring 引用名，不保存明文密钥。

## Sprint 106：Provider 优先级

`providers` 新增 `priority INTEGER NOT NULL DEFAULT 0`：新库建表语句已直接包含该列，旧库由 `migrate_provider_priority` 幂等补列并把 `NULL` 回写为 0，已加入 `init_connection` 迁移链。

`list_providers` / `get_provider` / `create_provider` 均读写 `priority`；新增 `set_provider_priority` Tauri 命令，`priority` 最小值钳制为 0。Provider 排序统一为 `priority DESC, rowid ASC`，MOA 取前 3 个启用 Provider、Auto 路由与浏览器 fallback 也按优先级排序。

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

## Sprint 111：错误日志时间范围与峰值告警

无表结构变更。`error_log_summary` 新增 hour 粒度（UTC 整点对齐）与可选 `since_ms` / `until_ms` 过滤，SQL 在 `source` / `severity` / `device_id` 基础上追加 `updated_at` 区间条件；浏览器 fallback 在 localStorage logs 上按 `updatedAt` 过滤后执行同一分桶。System 卡片按 24h / 7d / 30d 传入窗口，峰值告警由前端在返回的 buckets 上计算，不落库。

## Sprint 112：MOA 链式路由

无表结构变更。链式路由是运行时行为：`stream_ai_message(moa_chain=true)` 按优先级串行请求前 3 个启用 Provider，后续请求的上下文以内存追加的 user 消息承载（`[Previous agent output from X]`），最终仍由 `chat_messages` 落库，不新增表、索引或字段。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `providers` / `chatMessages`，不新增 localStorage key。

## Sprint 113：审计跨时间轴图

无表结构变更。跨时间轴图是纯前端渲染：merge / resolve / other 分段与累计趋势线都由 `get_sync_audit_summary` 返回的既有 buckets 计算，不新增表、索引或字段；浏览器 fallback 继续复用 `ai-workbench:sync-audit:v1`。

## Sprint 114：AI 复盘结果一键保存更多入口

无表结构变更。复盘草稿保存在前端 `ai-workbench:recap-draft:v1`（date / content / saved / savedAt），实际笔记仍由 `thoughts` 表与 `ai-workbench:db:v1` 的 `thoughts` 保存，不新增表、索引或字段。

## Sprint 115：Provider 端到端流式联调

无表结构变更。`run_provider_e2e_stream` 是运行时命令：复用既有 `stream_openai_compatible_with` / `stream_ollama_with` 真实流式链路，结果仅在内存返回（ok / chunks / chars / durationMs / message），不落库；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `providers` 配置，不新增 localStorage key。

## Sprint 116：Focus 周视图与完成归档

`tasks` 表新增 `completed_at INTEGER`：新库 SCHEMA 直接建列，旧库由幂等 `migrate_task_completed_at` 补列。`update_task_status` 在状态变为 `done` 时写入当前毫秒时间戳，非 `done` 清空；`set_task_due_date` 更新既有 `due_date TEXT`（`YYYY-MM-DD`）。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `tasks` 数组，任务对象新增 `completedAt` 字段，不新增 localStorage key。

## Sprint 117：Projects 收益与进度汇总导出

无表结构变更。Portfolio summary 与 Markdown 导出是纯前端计算：从 `projects` 表（`revenue` / `status` / `name` / `path`）与 Git 活动聚合结果读取数据，导出内容不落库；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `projects` 与既有 Git mock，不新增 localStorage key。

## Sprint 118：Knowledge 标签分类视图

无表结构变更。Tag Library 是纯前端派生视图：`tagStats` / `tagEntries` 在运行时聚合 `thoughts.tags`（逗号分隔）的 count 与类型分布，不新增表、索引或字段；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts`，不新增 localStorage key。

## Sprint 119：习惯连续天数与 14 天热力条

无表结构变更。`habits.current_streak` 列与 `habit_logs` 表自早期 Sprint 已存在；本 Sprint 将 `current_streak` 改为运行时按连续日期计算，`recent_logs` 是查询派生字段、不落库，`toggle_habit` 仍只写 `habit_logs`。浏览器 fallback 在既有 `ai-workbench:db:v1` 内新增 `habitLogs` 数组（`id / habitId / date / checkedAt`），不新增 localStorage key。

## Sprint 120：Projects 项目状态与收益编辑

无表结构变更。复用 `projects` 既有 `status` / `revenue` 列：新增 `update_project` 命令仅接受 active / paused 状态并对负收益钳制为 0；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `projects` 数组，不新增 localStorage key。

## Sprint 121：Knowledge 笔记标签编辑

无表结构变更。复用 `thoughts` 既有 `tags` 列：新增 `update_thought_tags` 命令仅更新标签，浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts` 数组，不新增 localStorage key。

## Sprint 122：Actions 习惯删除与周目标编辑

无表结构变更。`update_habit_week_goal` 复用 `habits.week_goal`（钳制 1~31）；`delete_habit` 先删除 `habit_logs` 中该习惯日志再删除习惯行，与既有 `ON DELETE CASCADE` 语义一致。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `habits` / `habitLogs`，不新增 localStorage key。

## Sprint 123：AI Studio 会话归档与恢复

`sessions` 新增 `archived INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 建表语句已直接包含该列，旧库由 `migrate_session_archived` 幂等补列，已加入 `init_connection` 迁移链。`search_sessions` 默认过滤 `archived = 0`，归档会话不进入搜索与 active 列表；`create_session` / `duplicate_session` 生成 active 会话。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `sessions`，旧数据读取时自动补 `archived=false`，不新增 localStorage key。

## Sprint 124：Knowledge 笔记正文编辑

无表结构变更。`update_thought_content` 复用 `thoughts.content` 既有列，仅更新正文并返回最新 Thought；RAG 搜索在 `search_thoughts` 查询时对 `thoughts.content` 实时生成向量，正文修改后无需额外重建索引。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts` 数组，不新增 localStorage key。

## Sprint 125：Projects 项目删除

无表结构变更。`delete_project` 复用 `projects` 既有表：删除前将 `sessions.project_id` 置空以解除会话关联，再删除项目行；缺失 id 返回 `QueryReturnedNoRows`。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `projects` / `sessions` 数组，删除时同步清理项目并解除会话关联，不新增 localStorage key。

## Sprint 126：System Provider 批量 E2E 测试

无表结构变更。批量 E2E 是运行时链路：`runProviderE2EStream` 复用既有 Provider 配置与 `stream_ai_message` 冒烟路径，汇总结果仅保存在前端状态，reload 后按各卡片既有 E2E 结果恢复；浏览器 fallback 不新增 localStorage key。

## Sprint 127：Knowledge 笔记删除与类型转换

无表结构变更。`update_thought_type` 复用 `thoughts.type` 既有列更新类型，`delete_thought` 直接删除 `thoughts` 行；`thoughts` 无外键依赖，删除无需级联。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts` 数组，更新或删除后写回同一 key，不新增 localStorage key。

## Sprint 128：AI Studio 会话分组

无表结构变更。会话分组是运行时计算：按 `sessions.created_at` 生成 today / yesterday / 7d / older 分组，`pinned` 仍复用既有 `pinned` 列；折叠状态仅保存在前端组件状态，不写入 SQLite。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `sessions` 数组，不新增 localStorage key。

## Sprint 129：Projects 收益趋势

```sql
CREATE TABLE IF NOT EXISTS project_revenue_history (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    revenue REAL NOT NULL,
    recorded_at INTEGER NOT NULL
);
```

- 新库 SCHEMA 直接包含该表，旧库由 `CREATE TABLE IF NOT EXISTS` 幂等补建；`create_project` / `update_project` 在写项目后追加收益快照，`delete_project` 同步删除该项目历史。
- `list_project_revenue_history(project_id, limit)` 按 `recorded_at DESC, rowid DESC` 取最近 N 条后升序返回；浏览器 fallback 在 `ai-workbench:db:v1` 下新增 `projectRevenueHistory` 数组并维护同一语义。

## Sprint 130：Actions 周目标统计与快速归档

无表结构变更。周统计是运行时派生数据：Week Review 复用 `tasks` 既有字段（`dueDate` / `isToday` / `status` / `completedAt`），快速归档通过既有 `set_task_today` / `set_task_due_date` 命令把完成任务的 `isToday` 置 false 并清空 `dueDate`，不新增表、索引或字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `tasks` 数组，不新增 localStorage key。

## Sprint 131：Webhook 事件规则冷却期

```sql
ALTER TABLE webhook_rules ADD COLUMN cooldown_seconds INTEGER NOT NULL DEFAULT 0;
```

- 新库 SCHEMA 的 `webhook_rules` 建表语句直接包含该列，旧库由 `migrate_webhook_cooldown` 幂等补列；冷却期只作用于事件型规则（`trigger_event != ''`），定时规则仍由 `interval_seconds` 控制。
- `last_run_at` 在事件触发命中时更新为当前时间，`list_event_webhook_rules` 按 `now - last_run_at >= cooldown_seconds * 1000` 过滤；浏览器 fallback 在 `ai-workbench:webhook-rules:v1` 上维护同一 `lastRunAt` 语义，不新增 localStorage key。

## Sprint 132：AI Studio 会话导出到知识库

无表结构变更。导出按钮复用 `thoughts` 表与 `create_thought` 命令，把 `buildSessionMarkdown` 生成的 Markdown 作为 `content`，tags 为 `#chat,#session`，type 为 `note`；浏览器 fallback 写入 `ai-workbench:db:v1` 的 `thoughts` 数组，不新增表、字段或 localStorage key。

## Sprint 133：Projects 收益历史 CSV 导出

无表结构变更。CSV 是运行时派生数据：`ProjectsView` 把 `projects` 与 `project_revenue_history`（前端 `revenueTrends`）汇总为文本，预览 / 复制 / 下载都不落库；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `projects` / `projectRevenueHistory`，不新增 localStorage key。

## Sprint 134：Webhook 投递保留策略

```sql
CREATE TABLE IF NOT EXISTS webhook_retention_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    retention_days INTEGER NOT NULL DEFAULT 30,
    max_records INTEGER NOT NULL DEFAULT 200,
    auto_cleanup INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 0
);
```

- 新表由 SCHEMA 自动创建，无旧库迁移；`get_webhook_retention_config` 空行回退默认值，`set_webhook_retention_config` 以单行 upsert 持久化。
- `prune_webhook_deliveries` 只按年龄删除 `status IN ('success','dead')` 的过期记录，条数裁剪也只作用于终态记录；queued / delivering 不受保留策略影响，避免误删待投递工作。
- 浏览器 fallback 使用 `ai-workbench:webhook-retention:v1` 保存同一模型，不写入 SQLite。

## Sprint 135：Knowledge 笔记双链与回溯

无表结构变更。双链图是运行时派生数据：`db.ts` 从 `thoughts` 的 `content` 中解析 `[[...]]`，按首行标题匹配生成 outgoing / incoming，不新增表、索引或字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts` 数组，不新增 localStorage key。

## Sprint 136：Projects 收益端聚合展示

无表结构变更。收益聚合是运行时派生数据：ProjectsView 复用 `projects.revenue` 与 `project_revenue_history`（前端 `projectRevenueHistory`）计算最新值、趋势点数、7d / 30d 变化与状态拆分，不新增表、索引或字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `projects` / `projectRevenueHistory`，不新增 localStorage key。

## Sprint 138：Webhook 自动熔断

```sql
ALTER TABLE webhook_rules ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_rules ADD COLUMN auto_disable_after INTEGER NOT NULL DEFAULT 3;
```

- 新库 SCHEMA 的 `webhook_rules` 建表语句直接包含这两列，旧库由 `migrate_webhook_circuit_breaker` 幂等补列并加入 `init_connection` 迁移链。
- `record_webhook_rule_outcome` 以真实投递终态更新规则：2xx 把 `consecutive_failures` 清零，非 2xx / 网络错误累加；当 `auto_disable_after > 0` 且累计值达到阈值时把 `enabled` 置 0，并把 `last_message` 写成 `Auto-disabled after N consecutive failures`。
- `set_webhook_rule_enabled(true)` 同时把 `consecutive_failures` 清零；`auto_disable_after = 0` 表示只累计不自动停用。浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1` 保存同一模型，不新增 localStorage key。

## Sprint 139：Webhook 规则执行日志与失败告警

```sql
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
```

- 新表由 SCHEMA 自动创建，无旧库迁移；`record_webhook_rule_run` 写入后按 `rule_id` 裁剪保留最近 50 条，`list_webhook_rule_runs` 按 `created_at DESC` 返回。
- `run_webhook_rule_inner` 写 `manual` 运行，delivery worker 终态写 `scheduled` / `event` 运行；浏览器 fallback 使用 `ai-workbench:webhook-rule-runs:v1` 保存同一模型，不写入 SQLite。

## Sprint 141：Actions 周计划模板

```sql
ALTER TABLE schedule_events ADD COLUMN date TEXT NOT NULL DEFAULT '';
```

- 新库 SCHEMA 的 `schedule_events` 建表语句直接包含 `date` 列，旧库由 `migrate_schedule_event_date` 按列存在性幂等补列并加入 `init_connection` 迁移链。
- `create_schedule_event` / `list_schedule_events` 全程携带 `date`，列表按 `date ASC, start_time ASC` 排序；浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `scheduleEvents` 数组，新增事件写入 `date` 字段，旧数据缺省视为空日期。
- 周计划模板本身只保存在 `ai-workbench:week-plan-templates:v1`，不写入 SQLite。

## Sprint 143：Webhook 多通道投递与熔断恢复指数退避

```sql
ALTER TABLE webhook_rules ADD COLUMN channels TEXT NOT NULL DEFAULT '["http"]';
ALTER TABLE webhook_rules ADD COLUMN recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300;
ALTER TABLE webhook_rules ADD COLUMN circuit_opened_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_deliveries ADD COLUMN channel TEXT NOT NULL DEFAULT 'http';

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
```

- 新库 SCHEMA 的 `webhook_rules` / `webhook_deliveries` 建表语句直接包含新列，`webhook_channel_config` 由 SCHEMA 直接建表；旧库由 `migrate_webhook_channels_recovery` 按列存在性幂等补列并加入 `init_connection` 迁移链。
- `webhook_rules.channels` 保存 JSON 数组（`["http"]` / `["http","email","notification"]`），`parse_webhook_channels` 读取时过滤非法通道并回退 `["http"]`；`webhook_deliveries.channel` 记录每条投递的实际通道。
- `webhook_channel_config` 是单行配置表（id=1）：`get_webhook_channel_config` 空行回退默认值（smtp_port 587、notification_title 默认标题），`set_webhook_channel_config` 以 `WebhookChannelConfigInput` 收敛参数并对 smtp_port 1~65535、标题非空钳制后 upsert。
- `record_webhook_rule_outcome` 达到熔断阈值时写 `circuit_opened_at = now`；`list_circuit_open_webhook_rules` 只返回 `enabled=0 AND auto_disable_after>0 AND consecutive_failures>=auto_disable_after AND circuit_opened_at>0` 的规则，`set_webhook_rule_enabled(true)` 同时清零失败计数与 `circuit_opened_at`。
- 浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1`（规则新增 `channels` / `recoveryBackoffSeconds` / `circuitOpenedAt`，旧数据读取时默认补值）与 `ai-workbench:webhook-deliveries:v1`（投递新增 `channel`，旧数据默认 `http`），通道配置使用新 key `ai-workbench:webhook-channel-config:v1`。

## Sprint 146：语义聚类与文档去重

```sql
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
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_members_doc
    ON knowledge_cluster_members(doc_id);

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
CREATE INDEX IF NOT EXISTS idx_knowledge_dedup_status
    ON knowledge_dedup_candidates(status);
```

- 新库 SCHEMA 直接建表；旧库 `migrate_knowledge_clusters` 只播种 `knowledge_cluster_config` 默认值（cluster 0.62 / dedup 0.92），无需 ALTER。
- `knowledge_clusters.centroid` 保存归一化质心 JSON，`representative` 保存簇内最长文档前 500 字符；`knowledge_cluster_members.similarity` 是文档与簇质心的余弦相似度。
- `knowledge_dedup_candidates.doc_a / doc_b` 存知识文件 id，`status` 为 `open` / `dismissed` / `merged`；合并时删除 `doc_b` 对应文件并刷新分片统计，推荐保留 `doc_a`。
- 浏览器 fallback 使用 `ai-workbench:knowledge-clusters:v1` / `ai-workbench:knowledge-cluster-config:v1` / `ai-workbench:knowledge-dedup:v1` 持久化同一模型，不写入 SQLite。

## Sprint 145：真实 Embedding、增量重建与分片索引

```sql
ALTER TABLE knowledge_files ADD COLUMN shard_id TEXT NOT NULL DEFAULT '0';
ALTER TABLE knowledge_files ADD COLUMN embedding_model TEXT NOT NULL DEFAULT '';
ALTER TABLE knowledge_files ADD COLUMN embedding_dim INTEGER NOT NULL DEFAULT 256;
ALTER TABLE knowledge_files ADD COLUMN embedding_status TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE knowledge_files ADD COLUMN embedding_error TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_knowledge_files_shard
    ON knowledge_files(shard_id, embedding_status);

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
    updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vector_shards (
    shard_id TEXT PRIMARY KEY,
    model TEXT NOT NULL DEFAULT '',
    dimension INTEGER NOT NULL DEFAULT 256,
    documents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idle',
    updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
);
```

- 新库 SCHEMA 的 `knowledge_files` 建表语句直接包含新列与索引，`embedding_config` / `vector_shards` 由 SCHEMA 直接建表；旧库由 `migrate_vector_index` 按列存在性幂等补列并播种分片，已加入 `init_connection` 迁移链。
- `embedding_config` 是单行配置表（id=1）：`mode` 为 `local` / `openai` / `ollama`，`shard_count` 钳制 1~64，`dimension` 钳制 64~4096；`get_embedding_config` 空行回退默认值，`set_embedding_config` upsert 后重播种分片并刷新统计。
- `knowledge_files.embedding` 保存 JSON 向量数组，`embedding_status` 为 `indexed` / `pending` / `failed`，`shard_id` 由路径 FNV-1a 哈希对 `shard_count` 取模；`vector_shards.documents` 只统计 `embedding_status = 'indexed'` 的文件，`status` 有文档为 `ready`、否则 `idle`。
- `rebuild_vector_index` 按 `embedding_status != indexed OR embedding = '' OR embedding_model != target OR force` 选取候选，单批最多 25 个；浏览器 fallback 使用 `ai-workbench:vault:v1` 的扩展字段与 `ai-workbench:embedding-config:v1` / `ai-workbench:vector-shards:v1` 持久化。

## Sprint 144：事件总线持久化、Schema 校验与跨设备转发

```sql
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
```

- 四张表由新库 SCHEMA 直接创建，旧库打开时同样走 SCHEMA 建表，因此不需要 ALTER 迁移函数。
- `event_logs.status` 取值 `accepted / rejected`，`rejected_reason` 保留校验失败原文；`event_forwards.status` 取值 `queued / delivering / success / failed / dead`，`next_attempt_at` 与 due 索引供 worker 认领。
- 浏览器 fallback 使用 `ai-workbench:event-logs:v1` / `ai-workbench:event-schemas:v1` / `ai-workbench:event-forwards:v1` / `ai-workbench:event-bus-config:v1` 持久化同一模型，写入时按 `retention_days` / `max_logs` 修剪。

## Sprint 142：Webhook 复杂触发器条件与签名校验收发端

```sql
ALTER TABLE webhook_rules ADD COLUMN trigger_condition TEXT NOT NULL DEFAULT '';
```

- 新库 SCHEMA 的 `webhook_rules` 建表语句直接包含 `trigger_condition` 列，旧库由 `migrate_webhook_trigger_condition` 按列存在性幂等补列并加入 `init_connection` 迁移链。
- `trigger_condition` 保存条件 DSL 原文（事件匹配 / context 比较 / `and or not` / `cron(...)`），创建时非空先由 `webhook_condition::validate_condition` 校验；条件过滤发生在 `spawn_webhook_delivery_worker` 与 `trigger_webhook_event` 运行时，不入库额外索引。
- 签名校验是纯运行时计算，不新增表或字段：Tauri `verify_webhook_signature` 复用 HMAC-SHA256，浏览器 fallback 用 Web Crypto 计算同一 `expected`；浏览器 fallback 继续使用 `ai-workbench:webhook-rules:v1`，规则对象新增 `triggerCondition` 字段，旧数据读取时默认补空串。

## Sprint 140：Knowledge 双链补全编辑器提示

无表结构变更。双链补全候选由 `db.ts` 从 `thoughts` 的 `content` 首行标题与 `tags` 运行时派生，不新增 SQLite 表、索引或字段；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `thoughts` 数组，不新增 localStorage key。

## Sprint 137：AI Studio 会话摘要与关键词

无表结构变更。会话摘要是运行时派生数据：`buildSessionSummary` 复用 `chat_messages`（前端 `chatMessages`）的 role / content 生成问题数、关键词与问答要点；`buildSessionMarkdown` 只是导出文本，摘要不新增 SQLite 字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `chatMessages`，不新增 localStorage key。

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

## Sprint 102：ESLint/Prettier 与 husky/lint-staged

无表结构变更。本 Sprint 只新增前端工程配置（`eslint.config.js` / `.prettierrc.json` / `.husky/pre-commit`）与开发依赖，不涉及 SQLite 表、索引或字段；浏览器 fallback 不新增 localStorage key。

## Sprint 103：会话搜索增强

无表结构变更。`search_sessions` 是运行时查询：复用 `sessions` 与 `chat_messages` 表，在内存中按标题 / 模型 / 消息内容评分并过滤时间范围，不新增表、索引或字段。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `sessions` / `chatMessages`，不新增 localStorage key。

## Sprint 104：MOA 三路共识摘要

无表结构变更。`MoaConsensus` 是运行时派生数据：由三路流式输出在内存中计算共识关键词、分歧首行与结论，随 `chat_messages` 主消息一起落库，不新增表、索引或字段。浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `providers` / `chatMessages`，不新增 localStorage key。

## Sprint 105：会话消息跳转与高亮

无表结构变更。`SessionSearchHit.message_id` 是运行时派生字段：`search_sessions` 复用 `chat_messages.id` 作为命中定位锚点，不新增表、索引或字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `sessions` / `chatMessages`，不新增 localStorage key。

## Sprint 107：拼音/中文分词模糊搜索

无表结构变更。拼音匹配在运行时由 `search_sessions` 对原文生成全拼 / 首字母紧凑串后评分，不新增表、索引或字段。浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `sessions` / `chatMessages`，不新增 localStorage key。

## Sprint 108：搜索历史与跨会话聚合统计

无表结构变更。搜索历史保存在前端 `ai-workbench:session-search-history:v1`（每条含 `query / at / hits`），聚合统计由 `summarizeSearchHits` 在运行时对当前命中结果计算，不写入 SQLite；浏览器 fallback 继续复用 `ai-workbench:db:v1` 的 `sessions` / `chatMessages`。

## Sprint 109：多 Provider 自动降级

无表结构变更。自动降级是运行时链路：`stream-fallback` 事件与 `[auto fallback: A → B]` 文本块不新增持久化字段，Provider 仍由 `providers` 表与 `ai-workbench:db:v1` 保存；浏览器 fallback 不新增 localStorage key。

## Sprint 110：跨流 Token 预算

无表结构变更。预算配置保存在前端 `ai-workbench:token-budget:v1`（含 `monthlyLimit / monthKey / usedTokens / autoDegrade`），不写入 SQLite；浏览器 fallback 与 Tauri 共用同一 localStorage 模型，月度 key 变化自动清零。

## Sprint 147：Projects 轮播排序

```sql
ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
```

- 新库 SCHEMA 的 `projects` 建表语句已直接包含 `sort_order INTEGER NOT NULL DEFAULT 0`；旧库由幂等 `migrate_project_sort_order` 补列并按 `created_at` 倒序回填（最新项目 sort_order=0），已加入 `init_connection` 迁移链。
- `list_projects` 按 `sort_order ASC, created_at DESC` 返回；`create_project` 以 `MAX(sort_order)+1` 追加到末尾；`reorder_projects(ids)` 按传入 id 顺序把 sort_order 重编号为 0..n-1。
- 浏览器 fallback 继续使用 `ai-workbench:db:v1` 的 `projects` 数组，项目对象新增可选 `sortOrder`，reorder 时按传入 id 顺序重排并写回；速度偏好单独存 `ai-workbench:carousel-speed:v1`，不写入 SQLite。
