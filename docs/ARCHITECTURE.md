# Architecture

## 形态

本地优先的 AI 工作台桌面应用：Tauri 2 + React + TypeScript + Tailwind CSS v4，Rust 后台负责 SQLite、密钥、AI 请求与系统能力。

## 分层

```text
UI 层（React Components + Zustand）
        |
        |
IPC 层（Tauri invoke / events）
        |
        |
Rust 服务层（SQLite、Keyring、AI Gateway、Git 上下文）
        |
        |
外部边界（OpenAI / Ollama / Codex CLI / 本地文件系统）
```

## 5 大主视图

- AI Studio：多模型对话与 MOA。
- Projects：项目管理与 Vibe Coding。
- Knowledge & Inbox：闪念与 Markdown 知识。
- Actions & Schedule：今日 Focus、任务、习惯、日程。
- System & Automation：Provider、剪贴板、日志、自动化。

## UI 动态效果层

- 主切换与交互反馈上限 150ms，只使用 `transform`、`opacity`、`filter`。
- `AppInspector` 为固定宽度右侧浮层，使用 `translateX` 滑入，不做宽度动画。
- BentoCard 使用流体材质伪层与 hover lift，尺寸稳定，无布局抖动。
- 所有连续动画遵守 `prefers-reduced-motion`，JS 动画使用 `matchMedia` 主动降级。
- 习惯/日程卡片支持 pointer tilt（<=7deg）、check-pop 与进度条 `scaleX`，参考 `octopus-kaogong-workbench` 的动效语言但不照搬 3D 轮播。
- UI 改造必须走 `docs/meetings/*-ui-dynamics-design-review.md` 设计评审与 `docs/plans/sprint-*-ui-dynamics.md` 验收清单。

## Tauri IPC 协议

- 命令命名：`snake_case`，例如 `list_tasks`、`create_task`、`list_habits`、`toggle_habit`。
- 事件命名：`snake_case` 事件名，例如 `stream_chunk`、`agent_trace`。
- 所有命令返回 `Result<T, String>`，错误信息不包含密钥。
- API Key 只通过 OS Keyring 存取，SQLite 只保存 Keyring 引用名。

Sprint 3 新增命令：`list_habits`、`create_habit`、`toggle_habit`、`list_schedule_events`、`create_schedule_event`、`toggle_event_done`。

Sprint 4 新增命令：`list_clipboard`、`list_error_logs`、`capture_clipboard`、`report_frontend_error`。

Sprint 5 新增命令：`stream_ai_message`，事件 `stream-chunk`。

Sprint 6 新增命令：`search_thoughts`、`get_rag_index_status`。

Sprint 8 新增命令：`cancel_ai_stream`；事件 `stream-chunk` 增加 `cancelled` 字段。

Sprint 9 新增命令：`index_vault`、`get_knowledge_index_status`。

Sprint 10 新增命令：`check_provider_health`。

Sprint 11 新增命令：`save_chat_message`、`list_chat_messages`。

Sprint 12 新增命令：`rename_session`、`delete_session`。

Sprint 14 新增命令：`update_chat_message`、`truncate_chat_messages`。

Sprint 28 新增命令：`start_vault_watch`、`stop_vault_watch`、`get_vault_watch_status`；事件 `vault-watch-update`。

Sprint 29 新增命令：`apply_commit`、`create_remote_pr`。

Sprint 30 新增 accent 语义类：`.accent-bg-*`、`.accent-text*`、`.accent-border*`、`.accent-ring`、`.accent-dot*`，组件层蓝色字面量清零。

Sprint 31 新增命令：`rebase_branch`、`abort_rebase`。

Sprint 32 新增命令：`run_provider_stream_smoke_test`；流式核心重构为 `stream_openai_compatible_with` / `stream_ollama_with`（sink 注入式）。

Sprint 33 新增命令：`push_sync_snapshot`、`pull_sync_snapshot`；`build_sync_snapshot` / `merge_sync_snapshot` 从文件导入导出中拆出，供 HTTP 远端同步与本地文件同步复用。

Sprint 34 新增命令：`resolve_rebase_conflicts`；支持 `ours`（保留被 rebase 分支）/ `theirs`（保留目标分支）/ `union`（三方并集合并），解决后 `GIT_EDITOR=true git rebase --continue` 自动续跑。

Sprint 35 新增命令：`index_vault_ex`；Vault 扫描改为收集路径后最多 4 线程并行读取解析，支持目录名与 `**` / `*` ignore 规则，`IndexResult` 返回 `{ files, ignored }`。

Sprint 36 新增命令：`start_vault_watch_ex`；watch 启动索引与增量事件统一经过 `sync_vault_event` 的 ignore 过滤，忽略目录下的新增/修改/删除不再污染 RAG。

Sprint 37 新增前端同步配置：`getSyncAutoConfig` / `setSyncAutoConfig` 持久化 `{ enabled, intervalMs, remoteUrl }`；System Auto sync 启用时立即执行 pull → push 双向同步，并按 10s / 30s / 60s / 5m 间隔定时续跑，Token 不落盘。

Sprint 38 扩展同步协议：`SyncResult.conflicts` 返回 `SyncConflictItem` 明细（kind / 两端 updatedAt / resolvedTo / preview），System card 展示自动解决方向与冲突数量。

Sprint 39 新增命令：`resolve_sync_conflict`；`SyncConflictItem` 携带 `localContent` / `remoteContent`，System card 对每条冲突提供 Keep local / Keep remote 人工仲裁，仲裁后写回内容并以当前时间戳标记，使裁决在下次同步中胜出。

Sprint 40 新增命令：`list_sync_conflicts`、`clear_resolved_sync_conflicts`；`sync_conflicts` 表持久化冲突明细与仲裁历史，System card 支持查看与清理已解决记录，重启后仍保留。

Sprint 41 新增命令：`get_vault_watch_config` / `set_vault_watch_config`；Vault watch 的路径、ignore 与开关状态持久化，应用启动或 Knowledge 视图挂载时自动恢复。

Sprint 42 扩展 `index_vault_ex`：新增 `concurrency` 参数（1~16 自动 clamp），Vault Index 卡片提供并发数输入，默认 4 保持兼容。

Sprint 43 新增命令：`resolve_sync_conflicts`；`resolve_conflicts` 用单事务批量执行逐条仲裁，System Sync card 提供 Keep all local / Keep all remote 一键裁决。

Sprint 44 新增命令：`list_vault_watch_targets` / `upsert_vault_watch_target` / `delete_vault_watch_target`；watch 状态升级为多实例并行，`stop_vault_watch` 支持按路径停止，Knowledge card 提供多 vault 目标列表。

Sprint 45 新增命令：`list_sync_audit` / `clear_sync_audit`；`sync_audit_log` 表持久化 merge / resolve / history.clear 事件，System Sync card 新增审计面板。

Sprint 46 新增命令：`recommend_index_concurrency`；Knowledge Vault Index 提供 Auto 开关，按设备并行度推荐 1~16 并发并允许手动覆盖。

Sprint 47 新增命令：`list_vault_target_stats`；`knowledge_files` 记录每份文档归属的 vault path，Knowledge 每个 vault 目标显示独立文件数，按目标区分索引统计。

Sprint 48 扩展 `list_sync_audit`：新增 `event` 筛选参数；新增 `export_sync_audit`，支持按筛选结果导出 JSON / CSV，System Sync audit 面板提供筛选下拉框与导出按钮。

Sprint 49 约定 `index_vault_ex` 的 `concurrency = 0` 表示 Auto：Rust 按文件数量与大型文件占比动态规划实际并发，`IndexResult` 返回 `concurrency_used`，Knowledge Vault Index 显示实际工作线程数。

Sprint 50 新增命令：`resolve_sync_conflict_union` / `resolve_sync_conflicts_union`；冲突按行并集合并写回，System Sync card 提供单个 Merge 与 Merge all，审计新增 union 事件。

Sprint 51 扩展 `list_sync_audit` / `export_sync_audit`：新增 `since` / `device_id` 组合筛选；System Sync audit 提供时间范围与设备下拉框，列表与导出共用过滤条件。

Sprint 52 扩展 `vault_watch_targets`：新增 `last_event_at` / `event_count` 事件统计；watch 写回成功后埋点，Knowledge 每个目标显示累计事件数。

Sprint 61 新增命令：`list_vault_watch_events` / `clear_vault_watch_events`；watch 事件写入 `vault_watch_events` 时间线，Knowledge 每个 vault 目标可展开查看真实文件路径与事件类型。

Sprint 62 新增命令：`get_error_log_summary`；Error logs 按 UTC 日 / 周聚合 error / warning / info，System 错误日志卡片新增趋势图与严重度过滤。

Sprint 63 新增命令：`list_knowledge_files`；Knowledge 新增 Document status 面板，按 vault 过滤展示每份索引文档的路径、标签与索引时间。

Sprint 64 扩展 `list_knowledge_files`：每条记录新增 `exists` / `stale`，磁盘文件缺失或索引后过期会在 Document status 面板显示徽标。

## Knowledge RAG

- Rust 后台对 `thoughts` 建立本地 BM25 索引：按词项切分、统计 IDF 与文档长度归一化，不依赖外部 Embedding 模型。
- `search_thoughts(query, limit)` 返回相关笔记与 score；`get_rag_index_status` 返回文档数与 indexed 状态。
- 前端 Knowledge 视图提供 RAG 搜索框，结果可点击进入 Markdown 预览；浏览器 fallback 使用关键词命中。

## Vault 跨文件索引

- SQLite 新增 `knowledge_files` 表（path 唯一、title、tags、content、indexed_at），`index_vault(vault_path)` 递归扫描 `.md` 文件并解析 frontmatter，按 path upsert。
- `get_knowledge_index_status` 返回已索引文件数；`search_thoughts` 同时检索 thoughts 与 knowledge_files，文件命中以 `type: doc` 返回。
- `start_vault_watch` 先用全量索引建立基线，再通过 `notify` 递归监听；新增/修改自动 upsert，删除自动清理，变更经 `vault-watch-update` 事件推送状态。
- Knowledge 视图提供 Vault 路径输入、Index 按钮与 Watch/Stop 开关，文件数与 Watch 状态 badge 实时展示；AI Studio RAG 注入自动覆盖本地 Markdown 文件。
- 浏览器 fallback 用 localStorage 模拟 Vault 文件，保证 UI 验证可运行。

## AI Studio RAG 上下文注入

- AI Studio 发送消息前调用 `search_thoughts(text, 5)`，命中时在 API messages 前注入一条 `system` 上下文（`Knowledge context:\n- <content>`）。
- 模型切换条附近提供 RAG 开关，默认开启；关闭时跳过检索，不注入上下文。
- 命中后消息输入区上方显示 `RAG +N` badge 与来源摘要；发送结束后 Inspector 展示 RAG context 与 Source 列表。
- 注入逻辑为纯前端实现，复用 Sprint 6 的 `search_thoughts` 命令，无新增 Rust 命令。

## AI 流式输出

- Rust 后台调用 OpenAI 兼容接口与 Ollama 时使用 `stream: true`，逐块解析 SSE / NDJSON。
- 每个块通过 `stream-chunk` 事件推送：`{ id, delta, done, error, cancelled }`，`id` 为前端生成的 `runId`。
- MOA 模式按 Provider 顺序聚合为单流；无论成功失败，最终都会 emit `done` 事件收尾。
- 前端 AI Studio 监听 `stream-chunk`，assistant 消息增量追加；浏览器 fallback 用分块模拟流，保证 UI 验证可运行。

## AI 流式取消 / 中断

- Rust 后台维护 `StreamCancellation` 状态，`cancel_ai_stream(run_id)` 命令登记取消标记；流式函数逐块检查标记，命中后停止 emit。
- `stream-chunk` 的 done 事件在取消时带 `cancelled: true`，结束后清理该 run 的取消标记。
- AI Studio busy 时输入区显示 Stop 按钮，点击后调用取消命令、立即标记消息 `[stopped]`，并忽略旧 run 的后续块。
- 浏览器 fallback 使用本地取消集合中断分块模拟流，保证 UI 验证可运行。

## 系统采集

- Rust 后台启动 `spawn_clipboard_monitor` 线程，每 1.5 秒轮询系统剪贴板。
- 剪贴板内容变化时写入 `clipboard_history`，并 emit `clipboard-updated` 事件。
- 前端全局监听 `error` 与 `unhandledrejection`，通过 `report_frontend_error` 写入 `error_logs`。
- System 视图每 3 秒刷新剪贴板与日志，监听事件时立即刷新。

## Provider 健康度监控

- Rust `check_provider_health(provider_id)` 按类型探测：Ollama 请求 `/api/tags`，OpenAI 兼容节点请求 `/models`，返回 `{ ok, latencyMs, message }`。
- `is_ollama_provider(name, url)` 收敛 Ollama 判定，供健康检查与消息路由复用。
- System Provider 卡片展示健康点、状态与延迟；进入视图自动检查，支持单个 Check 与 Check all。
- 浏览器 fallback 模拟健康结果，保证 UI 验证可运行。

## AI Studio 多会话持久化

- SQLite 新增 `chat_messages` 表（id、session_id、role、content、created_at），`sessions` 复用为会话目录；`save_chat_message(session_id, role, content)` 写入消息，`list_chat_messages(session_id)` 按时间序返回历史。
- AI Studio 左侧会话栏提供 New chat 与会话列表，点击会话加载对应历史；发送时自动创建会话并保存 user 消息，流式结束或取消后保存 assistant 消息。
- 浏览器 fallback 用 localStorage 保存 sessions 与 chatMessages，刷新后自动恢复首个会话历史，保证 UI 验证可运行。
- 前端按 runId 维护独立流内容与消息索引，多条流互不串扰；取消流时立即落库 `[stopped]` 消息。

## AI Studio 会话管理

- `rename_session(id, title)` 更新会话标题；`delete_session(id)` 删除会话，`chat_messages` 通过外键级联清理。
- 会话栏顶部提供搜索框，按标题与模型过滤；会话项 hover 显示重命名与删除，重命名使用内联编辑，删除需二次确认。
- 空会话不再被自动复用为消息容器：发送新消息时若当前会话无历史，则新建会话并以首条消息命名。
- 浏览器 fallback 同步维护 localStorage 中的 sessions 与 chatMessages，保证 UI 验证可运行。

## Provider 自动路由

- AI Studio 模式切换条新增 Auto：发送前对启用节点并行执行健康检查，过滤失败节点后选择首个健康 Provider；全部不可用时返回 `no healthy provider available`。
- 顶部徽标展示实际路由结果（`auto → name`），Inspector 记录 Router 与 Fallback from 轨迹。
- 浏览器 fallback 用模拟健康检查驱动路由，UI 验证可稳定断言禁用 OpenAI 后自动回退到 Ollama。

## 消息编辑与重新生成

- `update_chat_message(id, content)` 更新消息内容；`truncate_chat_messages(session_id, keep_message_id)` 删除 keep 消息之后的所有消息，用于重新生成前清理旧回复。
- user 消息 hover 提供 Edit 与 Regenerate；编辑采用内联 textarea 保存，重新生成复用当前 Provider/Auto/MOA 模式重新流式输出并落库。
- 前端在发送时同步生成消息 id 并落库，保证编辑/重新生成可稳定定位到具体消息；`save_chat_message` 支持外部传入 id。
- 浏览器 fallback 同步更新 localStorage，UI 验证可断言编辑内容替换与重新生成后新回复出现。

## 数据流

1. 前端通过 Zustand 维护视图状态。
2. 持久化数据通过 IPC 调用 Rust 命令。
3. Rust 负责 SQLite 迁移、示例数据与事务。
4. AI 流式响应通过 Tauri Event 推送到前端。
5. AI Studio 发送前先检索本地 thoughts，把命中内容作为 system 上下文注入请求。
6. AI Studio 每条消息写入 `chat_messages`，会话切换与重启后按 session 恢复历史。

## 环境隔离

- 开发模式：允许 Dev overlay 与调试面板。
- 生产模式：禁止 Dev Issues 浮标与任何开发遮罩。

## Sprint 53：vault 索引进度事件

- `start_vault_index` 命令在后台线程异步索引并返回 `runId`，通过 `vault-index-progress` 事件推送 `{ runId, path, done, total, files, ignored, concurrencyUsed, status }`，完成或错误时发送终态。
- `index_vault_files_inner` 每写入 5 个文件或全部写完时调用进度回调；`index_vault_files` 保持同步兼容包装。
- Knowledge Vault Index 显示进度条与完成状态，完成后刷新文件数、RAG 状态与目标统计；浏览器 fallback 用 3 步模拟进度。

## Sprint 54：可取消 vault 索引任务

- `VaultIndexState` 维护 cancelled runId 集合，`cancel_vault_index(run_id)` 命令幂等标记，后台线程每个文件前检查取消标记。
- `index_vault_files_inner` 新增 `should_cancel` 回调，取消时返回 `Vault index cancelled`，`start_vault_index` 映射为 `status = cancelled` 终态并携带最近进度，完成后清理标记。
- Knowledge 进度条运行中显示 Cancel 按钮，取消后显示 `Cancelled`；浏览器 fallback 用 Set 模拟取消，6 步分块推送进度。

## Sprint 55：结构化字段级合并

- `structured_merge_content` 优先识别 JSON 对象/数组：对象按键递归合并，数组按 JSON 序列化去重并集，标量冲突取更新时间较新一侧；Markdown frontmatter 按字段合并，逗号列表取并集，正文沿用行级 union，纯文本回退 union。
- 新增 `resolve_sync_conflict_structured` / `resolve_sync_conflicts_structured` 命令，审计事件 `sync.resolve.structured` / `sync.resolve.structured.batch`。
- System 冲突卡片与批量区新增 `Merge fields` 入口；浏览器 fallback 与 Rust 共用同一合并语义。

## Sprint 56：自定义审计日期范围

- `list_sync_audit_range` / `export_sync_audit_range` 支持 `since` + `until`，SQL 增加 `created_at <= until`；`until` 为 `None` 时沿用原查询路径。
- System Sync audit 新增 `Custom` 选项与起止日期输入，列表与导出共用 `resolveAuditRange` 语义。
- 浏览器 fallback 按 `createdAt >= since && createdAt <= until` 过滤，与 Rust 语义一致。

## Sprint 57：watch 事件类型细分

- `vault_watch_targets` 新增 `created_events` / `modified_events` / `removed_events`，`touch_vault_watch_event` 按 `event_kind` 累计，`event_count` 保持总数。
- lib.rs watcher 将 notify 的 `Create / Modify / Remove` 映射为事件类型；`vault_target_stats` 透传三类计数。
- Knowledge 目标行新增 `+N` / `~N` / `-N` 徽标；浏览器 fallback 启动 watch 时模拟一次 created 事件。

## Sprint 58：结构化合并对象数组按 key 去重

- `canonical_json` 递归排序对象 key 生成稳定字符串，`merge_json_value` 数组分支用它去重，`{id,label}` 与 `{label,id}` 不再重复保留。
- TS fallback 新增 `canonicalJson`，与 Rust 同一语义；输出仍保持原始 item 顺序与内容。

## Sprint 59：Vault Index 串行任务队列

- `VaultIndexState` 升级为 `active + VecDeque 队列 + cancelled 集合`：`claim_next` 原子认领下一个请求，`finish_active` 在任务结束后清空 active，保证同一时间只有一个索引 worker。
- `start_vault_index` 先入队并发出 `queued` / `running` 进度；worker 结束后自动调度队列中的下一个任务。
- 新增 `get_vault_index_queue_status` 命令与 `vault-index-queue` 事件，快照包含 active 与排队任务的 position；`cancel_vault_index` 对排队任务直接出队。
- TS fallback 镜像同一队列语义；Knowledge 显示 active + queued 队列条，排队任务也可取消。

## Sprint 60：审计按日/周聚合图表

- 新增 `get_sync_audit_summary` 命令：按 `day` / `week` 聚合 `sync_audit_log`，周以周一 UTC 00:00 起算，bucket 数 <= 62 时补零，返回 total + buckets。
- System Sync audit 区域新增 Activity 图：Day / Week 分段切换、总数徽标、柱状条按 `bucket.count` 渲染；列表、导出与图表共用同一过滤条件。
- 浏览器 fallback 用 `summarizeSyncAudit` 镜像同一 UTC 日 / 周语义。

## Sprint 61：watch 事件时间线

- 新增 `vault_watch_events` 表（`id, vault_path, file_path, event_kind, created_at`），索引 `(vault_path, created_at DESC)`，每个目标保留最近 500 条。
- `sync_vault_event` 返回实际变更的绝对路径数组；watcher 对每条路径调用 `touch_vault_watch_event(vault_path, file_path, event_kind)`，created / modified / removed 写入 `+` / `~` / `-` 时间线。
- 新增 Tauri 命令 `list_vault_watch_events(vault_path?, limit)` / `clear_vault_watch_events(vault_path?)`；`delete_vault_watch_target` 级联清理该 vault 的事件。
- Knowledge 每个 vault 目标新增 Timeline 按钮与可展开事件列表，提供 Clear 动作；浏览器 fallback 用 `ai-workbench:vault-watch-events:v1` 保存同一时间线。

## Sprint 62：错误日志趋势与聚合

- 新增 `error_log_summary` 聚合：按 `updated_at` 的 UTC 日 / 周分组 `error_logs`，支持可选 source / severity 过滤，bucket 内拆分 error / warning / info，缺失区间补零。
- 新增 Tauri 命令 `get_error_log_summary(granularity, source?, severity?)`，返回 `ErrorLogSummary { granularity, total, buckets }`。
- System Error logs 卡片新增 Day / Week 分段切换、严重度下拉与分层柱状图；浏览器 fallback 用 `summarizeErrorLogs` 镜像同一语义。

## Sprint 63：RAG 文档状态面板

- 新增 `list_knowledge_files(vault_path?, limit?)` 命令：按 `indexed_at DESC, path ASC` 返回 `KnowledgeFileRecord`，limit clamp 1~200，支持空路径 legacy 记录。
- Knowledge Vault Index 卡片新增 Document status 区：数量徽标、vault 过滤下拉与文档列表，watch / 索引完成后自动刷新。
- 浏览器 fallback 按 watch target 路径前缀推断文档归属 vault，与 Rust 目标级语义一致。

## Sprint 64：文档存在性与过期检测

- `list_knowledge_files` 每条记录计算 `exists`（`Path::exists`）与 `stale`（mtime 比 `indexed_at` 晚超过 1 秒）。
- Document status 面板新增 ok / stale / missing 状态徽标与 missing / stale 计数；浏览器 fallback 返回 `exists: true, stale: false`。

## Sprint 65：文档健康一键清理与重新索引

- 新增 Tauri 命令 `cleanup_knowledge_files(vault_path?)`：missing 文档删除索引记录，stale 文档重读磁盘 frontmatter 与正文后 upsert，返回 `{ removed, reindexed, failed }`。
- 清理按当前 vault 过滤生效：传入 `vault_path` 只处理该 vault，不传则全量；fresh 文档保持不动，读取失败计入 `failed`。
- Document status 面板头部新增 Clean 按钮与 `removed / reindexed` 结果徽标，完成后自动刷新文档列表、vault 统计与 RAG 状态。
- 浏览器 fallback 在 localStorage 上执行同一清理语义，`VaultFileRecord` 支持 `exists` / `stale` 模拟状态，保证 UI 验证可运行。

## Sprint 66：Vault 索引任务队列持久化

- 新增 `vault_index_queue` 表（run_id 主键、path、ignore_patterns JSON、concurrency、status、created_at、updated_at），`start_vault_index` 入队即落库。
- worker 完成 / 取消 / 出错后删除持久化记录；取消排队任务同步删除；`restore_vault_index_queue` 在 setup 启动时读取 pending 记录，`running` 重置为 `queued` 重新入队并继续调度。
- 浏览器 fallback 用 `ai-workbench:vault-index-queue:v1` 保存同一队列，重载后自动恢复并 drain；Knowledge 视图队列条行为不变。

## Sprint 67：Git 活动看板

- `GitContext` 新增 `last_commit_at`：从 `logs/HEAD` 末行的第 5 列解析 epoch 秒并乘以 1000，latest commit 消息去掉 `commit:` 前缀。
- 新增 `get_git_activity` 命令：遍历 projects 调用 `get_project_git_context`，按 `last_commit_at DESC` 排序，汇总 `totalProjects / totalCommits / dirtyProjects / items`；`dirty` 由 changes 非空判定，`changedFiles` 为 changes 数量。
- Projects 顶部新增 Git activity 卡片：总数徽标 + 每项目 branch / commits / dirty 状态与最新提交；浏览器 fallback 基于 localStorage projects 镜像同一聚合语义。

## Sprint 68：错误日志来源 / 设备组合筛选

- `error_logs` 新增 `device_id`（默认空串），`migrate_error_log_device` 幂等补列；`ErrorLog` / `report_frontend_error` / `list_error_logs` / `merge_error_log` 全程携带设备归属，同步快照合并后仍可区分日志来源设备。
- `get_error_log_summary` 新增 `device_id?`，与 source / severity 组合过滤；System Error logs 卡片新增来源下拉与设备下拉，趋势图、总数徽标与明细列表共用同一过滤条件。
- 前端 `reportFrontendError` 自动读取当前 sync device id 并随命令写入；浏览器 fallback 在 localStorage 上镜像同一过滤语义。

## Sprint 69：文档健康自动定时巡检

- `db.ts` 新增 `DocHealthAutoConfig { enabled, intervalMs, lastRunAt, lastResult }` 与 `getDocHealthAutoConfig` / `setDocHealthAutoConfig`，配置持久化到 `ai-workbench:doc-health-auto:v1`。
- Knowledge Document status 新增 Auto toggle 与 5m / 15m / 30m / 1h / 6h 间隔；启用后立即执行一次 `cleanup_knowledge_files`，之后按间隔自动巡检，停止时清理定时器。
- 每次巡检刷新文档列表、vault 统计与 RAG 状态，并展示上次运行时间与 `removed / reindexed` 结果；刷新后恢复开关、间隔与上次结果。

## Sprint 70：Git 看板时间范围与提交人过滤

- `GitContext` 与 `GitActivityItem` 新增 `committer`，从 reflog 末行解析提交人姓名（按时间戳 / 时区倒推 email 列，兼容姓名含空格）。
- `get_git_activity` 新增 `sinceMs? / untilMs? / committer?`：先按 `lastCommitAt` 与 committer（大小写不敏感）过滤，再聚合与排序；`GitActivityBoard` 新增全量去重 `committers` 供下拉使用。
- Projects Git activity 卡片新增时间范围（All / 24h / 7d / 30d）与提交人下拉，切换后刷新统计与行列表；浏览器 fallback 基于 localStorage projects 镜像同一过滤语义。

## Sprint 71：索引队列优先级与失败重试

- `vault_index_queue` 新增 `priority / attempts / last_error`，`migrate_vault_index_queue_priority` 幂等补列；`list_vault_index_queue` 按 `priority DESC, created_at ASC` 返回。
- 内存队列按 `priority DESC` 插队、同优先级保持 FIFO；`start_vault_index` 新增 `priority` 参数，worker 失败后若 `attempts < 3` 保留优先级重新入队并记录 `last_error`，否则删除记录；重试间隔 800ms 防热循环。
- Knowledge Vault Index 新增 Normal / High 优先级选择，队列行展示优先级与重试次数，进度区展示最终错误；浏览器 fallback 镜像同一插队与最多 3 次重试语义。

## Sprint 72：自动巡检运行历史与通知提醒

- `db.ts` 新增 `DocHealthRunRecord` 与 `getDocHealthRunHistory` / `appendDocHealthRun`，历史持久化到 `ai-workbench:doc-health-history:v1`，最多保留 50 条；新增 `getDocHealthAlertDismissedAt` / `setDocHealthAlertDismissedAt`，Dismiss 时间写入 `ai-workbench:doc-health-alert-dismissed:v1`。
- `runDocHealthAutoInspect` 与手动 Clean 均追加 `{ ranAt, removed, reindexed, failed, triggeredBy }` 运行记录；最近一次自动巡检发现问题时，Knowledge Document status 展示提醒横幅，Dismiss 后持久化，刷新不重现。
- Document status 新增最近 5 次运行历史；`verify:ui` / `verify:preview` 新增 `docHealthHistory` / `docHealthDismissPersist` lane，断言 removed=1 / reindexed=1 / triggeredBy=auto 与 Dismiss 持久化。

## Sprint 73：Git 活动看板 dirty 文件预览与提交趋势

- `git_change_paths` 剥离 `git status --short` 的 XY 状态前缀并处理 rename 箭头，`GitActivityItem` 新增 `changed_paths`；Projects 的 dirty 行支持 Preview 展开 / 收起实际文件列表。
- `build_commit_trend` 聚合 reflog 全部时间戳为 UTC 日粒度 `commit_trend`，最多保留最近 7 个有提交的日桶；Git activity 卡片新增 7 日趋势条。
- TS fallback 镜像同一预览与趋势语义；`verify:ui` / `verify:preview` 新增 `gitDirtyPreview` / `gitCommitTrend` lane。

## Sprint 74：索引队列指数退避

- `vault_index_retry_delay_ms(attempts)` 以 500ms 为基数、2 倍增长、4000ms 封顶；worker 按 `retry.attempts` 计算并 sleep，替代固定 800ms。
- `VaultIndexQueueEntry` 新增 `retry_delay_ms`，active / queued 快照均携带；Knowledge 队列行显示 `retry N · NNNms` 并暴露 `retry-delay` 数据属性。
- TS fallback 用同一 `indexRetryDelayMs` 公式调度与展示；`verify:ui` / `verify:preview` 的 `indexQueueRetry` 断言 500 / 1000ms，新增 `indexQueueBackoff` lane。

## Sprint 75：AI Studio 日常 Quick Prompts

- 新增 `src/lib/quickPrompts.ts`：`QuickPrompt { id, label, category: life/work, text }`，内置 6 个生活与工作高频模板。
- AI Studio composer 上方新增 Quick Prompt 芯片行，点击后把结构化提示词填入输入框并聚焦；芯片带 `data-quick-prompt` / `data-quick-prompt-label` / `data-quick-prompt-category`。
- `verify:ui` / `verify:preview` 新增 `quickPrompts` lane：断言 >=4 个芯片、life/work 两类齐全、点击后输入框内容正确。

## Sprint 76：Actions 今日进度总览

- ActionsView 聚合今日 Focus / Habits / Schedule 的完成数、总数、总进度与下一个未完成日程；`Today progress` 12 列宽卡片置顶展示。
- 进度卡带 `data-daily-progress` / `data-daily-focus` / `data-daily-habits` / `data-daily-schedule` / `data-daily-progress-bar` / `data-daily-next-event` 数据属性。
- `verify:ui` / `verify:preview` 新增 `dailyProgress` lane：seed 态断言 Focus 0/3、Habits 0/3、Schedule 0/2、Next 含“每日复盘”。

## Sprint 77：Quick Prompt 自定义与本地持久化

- `quickPrompts.ts` 新增 `CustomQuickPrompt` 与 `loadQuickPrompts` / `listCustomQuickPrompts` / `addCustomQuickPrompt` / `deleteCustomQuickPrompt`，自定义项持久化到 `ai-workbench:quick-prompts:v1`。
- AI Studio 芯片行新增 Manage 面板：可填写 label / category / text 新增自定义 prompt，也可删除；内置模板不可删除，自定义项与内置项合并渲染。
- `verify:ui` / `verify:preview` 新增 `quickPromptManager` / `quickPromptPersist` lane：新增后立即可见、刷新后仍在、删除后消失。

## Sprint 79：Quick Prompt 按使用频次排序

- `quickPrompts.ts` 新增 `getQuickPromptUsage` / `recordQuickPromptUsage` / `loadQuickPromptsByUsage`，使用次数持久化到 `ai-workbench:quick-prompt-usage:v1`。
- AI Studio 芯片初始与刷新均按使用次数降序稳定排序，同次数保持内置默认顺序；点击芯片即累计次数、重排并显示次数角标，芯片带 `data-quick-prompt-usage`。
- `verify:ui` / `verify:preview` 新增 `quickPromptUsage` / `quickPromptUsagePersist` lane：清空计数后点击 2 次 daily-recap、3 次 wind-down，断言 wind-down 排第一、daily-recap 次数为 2，重载后顺序保持。

## Sprint 80：AI 生成式今日复盘

- 新增 `src/lib/dailyRecap.ts`：`buildDailyRecapContext` 聚合 Focus / Habits / Schedule 完成数与总体进度，`buildDailyRecapPrompt` 组装包含进度、任务、习惯与日程的结构化中文提示词。
- AI Studio 新增“今日复盘”按钮（`data-ai-daily-recap`），读取 workbench store 数据后复用 `sendText` 走既有 RAG / 流式 / 会话链路；`send` 拆出 `sendText(text)` 供普通发送与复盘共用。
- `verify:ui` / `verify:preview` 新增 `aiDailyRecap` lane：断言用户消息包含今日 Focus / 习惯 / 日程样例与 Overall 进度，流式回复可见且结束后自动 New chat 复位。

## Sprint 81：Git 批量提交内容预览

- ProjectsView 新增 `batchDiff` / `batchLoading` 状态与 `loadBatchPreview`：逐个复用 `db.getGitFileDiff` 拉取全部 dirty 文件，合并为带文件名标题的批量内容。
- dirty 预览顶部新增 Preview all 按钮（`data-git-batch-preview`），展开后以 `<pre>` 展示 `data-git-batch-preview-content`，再次点击收起；加载中重复点击由 `batchLoading` 守卫拦截。
- `verify:ui` / `verify:preview` 新增 `gitBatchPreview` lane：断言至少 2 块 `diff --git`、两个 dirty 文件均可见，收起后内容消失。

## Sprint 82：一键提交选中文件

- Rust 新增 `commit_git_files(path, files, message)`：空 message / 空 files 报错，`git add -- <files>` 只暂存选中文件后 `git commit -m`，返回 `GitCommitResult`；已注册 Tauri 命令，`apply_commit` 与它共用 `finalize_commit`。
- ProjectsView 新增 `selectedFiles` 状态与 `toggleSelectFile`，dirty 文件前有 checkbox（`data-git-select-file`）；Commit selected 按钮（`data-git-commit-selected`）自动生成或复用 draft message，提交后清空勾选并刷新 Git activity。
- `verify:ui` / `verify:preview` 新增 `gitCommitSelected` lane；Rust 单测覆盖只提交选中文件与空选择报错。

## Sprint 78：Git dirty 逐文件 diff 预览

- Rust 新增 `GitFileDiff { path, status, diff }` 与 `get_git_file_diff(path, file)`：未跟踪文件用 `git status --porcelain` 判定后读磁盘转成 `+` 新增行；已跟踪文件优先 `git diff --unified=3`，为空再走 `git diff --cached` 覆盖暂存改动。
- Projects 的 dirty 预览中每个文件新增 Diff 开关，点击后调用 `db.getGitFileDiff` 渲染 `<pre>` unified diff，可再次点击收起。
- `db.ts` 新增 `GitFileDiff` / `getGitFileDiff`，浏览器 fallback 返回含 `diff --git`、`+added line`、`-removed line` 的 mock diff；`verify:ui` / `verify:preview` 新增 `gitDirtyDiff` lane。

## Sprint 83：Webhook 真实投递

- Rust 新增 `WebhookDeliveryResult { ok, status, durationMs, message }` 与 `deliver_webhook(url, payload, method?, token?)` Tauri 命令：默认 POST，支持 POST / PUT / PATCH / GET / DELETE；POST / PUT / PATCH 发送 `Content-Type: application/json`，token 非空时带 `Authorization: Bearer`，payload 必须是合法 JSON。
- `db.ts` 新增 `WebhookDeliveryResult` 与 `deliverWebhook`，浏览器 fallback 返回确定性 `HTTP 200` mock；System 视图新增 Webhook delivery 卡片（`data-webhook-deliver` / `data-webhook-result`）。
- `verify:ui` / `verify:preview` 新增 `webhookDelivery` lane；Rust 本地 TCP 单测覆盖真实 POST、JSON body、Authorization header 与非 2xx 状态回显。

## Sprint 84：Webhook 定时器 / 触发器规则

- 新增 `webhook_rules` 表与 `WebhookRule` 数据模型；`list_webhook_rules` / `create_webhook_rule` / `set_webhook_rule_enabled` / `delete_webhook_rule` / `get_webhook_rule` / `list_due_webhook_rules` / `mark_webhook_rule_run` 覆盖 CRUD、due 判定与状态回写。
- 新增 Tauri 命令并启动 `spawn_webhook_scheduler` 后台线程：每秒检查 enabled 规则，`now - last_run_at >= interval_seconds * 1000` 时真实投递并写回 `last_run_at / last_status / last_message`。
- `db.ts` 新增 `WebhookRule` 与 CRUD / `runWebhookRule`，fallback 持久化到 `ai-workbench:webhook-rules:v1`；System Webhook delivery 卡片新增 Scheduled rules 区（创建 / 开关 / Run now / 删除）。
- `verify:ui` / `verify:preview` 新增 `webhookRules` lane；Rust 单测覆盖 CRUD、due 选择与真实投递状态回写。

## Sprint 85：Git 暂存 / 未暂存分组与提交前 lint 门禁

- Rust 新增 `GitChangeGroup { path, status, group }` 与 `git_change_groups`：解析 `git status --short` 的两位状态前缀（保留空格以区分 staged / unstaged），归类为 `staged` / `unstaged` / `untracked` / `both`，rename 箭头取目标路径；`GitActivityItem` 新增 `change_groups`。
- Rust 新增 `GitLintIssue { file, line, message }` 与 `run_commit_lint_gate` Tauri 命令：逐文件扫描 `<<<<<<<` / `>>>>>>>` 冲突标记，`.json` 文件校验 `serde_json` 合法性；`commit_git_files` 提交前先执行门禁，失败返回 `Lint gate failed` 并拒绝提交。
- Projects dirty 预览按四个分组渲染（`data-git-change-group` / `data-git-change-group-header`）；Commit selected 前先调 `db.runCommitLintGate`，失败时展示 `data-git-lint-gate` / `data-git-lint-gate-issues`。
- `db.ts` 新增 `GitChangeGroup` / `GitLintIssue` / `changeGroups` / `runCommitLintGate`；浏览器 fallback 对 broken / conflict 文件返回确定性问题，其余文件放行。
- `verify:ui` / `verify:preview` 新增 `gitStagedUnstaged` / `gitCommitLintGate` lane；Rust 单测覆盖 XY 分组与冲突标记 / 非法 JSON 拦截。
