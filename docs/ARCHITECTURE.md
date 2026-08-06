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

Sprint 111 扩展 `get_error_log_summary`：新增 hour 粒度与 `since_ms` / `until_ms` 时间范围过滤；System Error logs 卡片升级为 24h / 7d / 30d 范围切换，并新增峰值告警徽标。

Sprint 112 扩展 `stream_ai_message`：新增 `moa_chain` 链式路由，前 3 个启用 Provider 按优先级串行执行，后续请求携带上一路输出作为上下文；AI Studio 新增 Parallel / Chain 切换与链式徽标。

Sprint 113 升级 System Sync audit Activity 图：merge / resolve / other 分层堆叠 + 累计趋势线，图例与过滤条件联动。

Sprint 114 新增复盘草稿共享与多入口一键保存：AI Studio 消息级保存 + Knowledge Thought Inbox 存档。

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
- MOA 模式对前 3 个启用 Provider 并发请求，每路以 `## Provider` 标题分路聚合为单流；单路失败仅插入错误片段，全部结束后统一 emit `done` 事件收尾。
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

## Sprint 111：错误日志时间范围与峰值告警

- `error_log_summary` 新增 `hour` 粒度（UTC 整点对齐）与可选 `since_ms` / `until_ms`；`get_error_log_summary` 同步透传，Rust / 浏览器 fallback 同构。
- System Error logs 卡片把 Day / Week 切换升级为 24h / 7d / 30d 时间范围，24h 自动使用 hour 粒度、7d / 30d 使用 day 粒度；总数徽标、趋势图与明细列表共用同一窗口。
- 峰值告警：最高桶 count >= 3 且超过全量桶均值 3 倍时，显示 `data-error-peak` 徽标（峰值桶、计数与倍率）；切换范围后按新分桶即时重算。

## Sprint 112：MOA 链式路由

- Rust `stream_ai_message` 新增 `moa_chain`：前 3 个启用 Provider 按优先级顺序串行执行，每路先 emit `## {name}`；后续请求在原始 messages 后追加 `{role:"user", content:"[Previous agent output from {name}]\n{output}"}`，失败只插入错误片段并继续。
- `src/lib/db.ts` 新增 `appendMoaChainContext`，`sendAiMessageStream` 的 `moaChain` 分支串行消费真实 SSE / NDJSON；取消语义与并行 MOA 一致，最终统一 emit `done`。
- AI Studio MOA 新增 `data-moa-chain-mode` Parallel / Chain 切换；Chain 时头部展示 `data-moa-chain-badge`（`Alpha AI → Beta AI → Gamma AI`），MOA badge 状态显示 chain，Inspector 展示 Chain / Final。
- `verify:ui` / `verify:preview` 新增 `moaChain` lane：断言请求顺序、`maxActive <= 1`、上下文传递与链式徽标。

## Sprint 113：审计跨时间轴图

- Sync audit Activity 图每个日 / 周 bucket 按 merge / resolve / other 三色堆叠，`data-sync-audit-segment` 带 `data-audit-kind` / `data-audit-count`；保留 `data-sync-audit-bar` 桶总数锚点。
- 图例 `data-sync-audit-legend` 展示三类合计；桶数 > 1 时 `data-sync-audit-trend-line` 累计折线叠加在时间轴上方，Day / Week 与过滤条件联动不变。
- `verify:ui` / `verify:preview` 的 `syncAuditChart` lane 新增分段 / 图例合计与趋势线存在性断言。

## Sprint 114：AI 复盘结果一键保存更多入口

- 新增 `src/lib/recapDraft.ts`：`loadRecapDraft` / `saveRecapDraft` / `markRecapDraftSaved`，localStorage key `ai-workbench:recap-draft:v1` 保存最近复盘日期 / 内容 / 保存状态。
- AI Studio 复盘流完成后自动写入草稿，assistant 消息新增 `data-ai-recap-message-save` 按钮直接保存该消息；Quick Prompt 行按钮与消息按钮共享已保存状态。
- Knowledge Thought Inbox 新增 `data-knowledge-recap-save` 复盘草稿一键存档，保存后状态变 saved 并在 AI Studio 回显。
- `verify:ui` / `verify:preview` 新增 `recapSaveEntries` / `recapSaveKnowledge` / `recapSaveMessageState` lane 断言。

## Sprint 115：Provider 端到端流式联调

- Rust 新增 Tauri 命令 `run_provider_e2e_stream(provider_id)`：按 Provider 类型复用 `stream_openai_compatible_with` / `stream_ollama_with` 真实流式链路，逐块计数 chunk / chars 并计时，返回 `ProviderE2eResult { ok, chunks, chars, durationMs, message }`。
- `src/lib/db.ts` 新增同构 `runProviderE2EStream`：真实 Provider 走 `streamProviderLive`（新增 `onChunk` 计数回调），无真实链路时返回确定性 mock，浏览器与 Rust 指标一致。
- System Provider 卡片新增 `data-provider-e2e-test` 按钮与 `data-provider-e2e-result` 结果展示（`ok · chunks · chars · ms`）。
- `verify:ui` / `verify:preview` 新增 `providerE2EStream` lane：本地 SSE mock 覆盖完整链路并断言 chunk / chars / duration。

## Sprint 116：Focus 周视图与完成归档

- `tasks` 表新增 `completed_at`：旧库通过幂等 `migrate_task_completed_at` 补列，Rust `Task` 与浏览器 `Task` 同构新增 `completedAt: number | null`。
- Rust 新增 `set_task_due_date(id, due_date)` Tauri 命令；`update_task_status` 在状态变为 `done` 时写入 `completed_at`，取消完成时清空；浏览器 `db.ts` 同构实现。
- Actions Today Focus 卡片新增 7 天条带 `data-focus-week-day`（每日计数 / 完成态 / 今日标记）与 `data-focus-week-bar` 周进度；每张焦点任务卡提供 `data-task-next-day` 一键改派次日。
- 完成归档 `data-focus-archive` 展示最近完成项（标题 + 完成时间），`data-focus-archive-restore` 恢复为待办并回到今日焦点。
- `verify:ui` / `verify:preview` 新增 `focusWeekArchive` / `focusWeekPersisted` lane：创建任务、改派次日、完成、归档、恢复、切换回今天与 reload 持久化。

## Sprint 117：Projects 收益与进度汇总导出

- Projects 视图新增 `data-portfolio-summary` Portfolio summary 卡片：项目总数、总收益、Active / Paused 数、Git 提交总数、Dirty 项目数与 `data-portfolio-week-peak` 周提交峰值。
- `data-portfolio-export` 一键生成 Markdown 报告：组合统计、项目表（名称 / 状态 / 收益 / 路径）、Git 活动表（提交数 / 分支 / 脏状态 / 最新提交）与提交趋势摘要；`data-portfolio-export-preview` 内联预览，`data-portfolio-copy` 复制到剪贴板（含 legacy execCommand 兜底）。
- 报告为纯前端计算，复用 `projects` 与 `gitActivity` 现有数据，无新增后端命令或持久化字段。
- `verify:ui` / `verify:preview` 新增 `portfolioSummaryExport` lane：断言汇总数值、导出预览包含项目名与收益、复制成功状态。

## Sprint 118：Knowledge 标签分类视图

- Knowledge 新增 `data-knowledge-tag-library` Tag Library 卡片：标签 chips 按笔记数聚合 `#work` / `#life` / `#daily` / `#recap` 等标签，并展示 inbox / note / doc 类型分布与总标签数。
- 点击标签 chip 后 `selectedTag` 与侧栏 `filter` 同步，`data-knowledge-tag-notes` 展示该标签下的最近笔记预览；点击 All 恢复全部。
- Tag Library 为纯前端派生视图，复用 `thoughts.tags` 的逗号分隔标签，无新增后端命令或持久化字段。
- `verify:ui` / `verify:preview` 新增 `knowledgeTagLibrary` lane：断言标签计数、选中联动、侧栏过滤行数、预览列表与 All 恢复。

## Sprint 119：习惯连续天数与 14 天热力条

- Rust `list_habits` 改为从 `habit_logs` 实时计算 `current_streak` 与 `recent_logs`：今天未打卡时从昨天向前计数，今天已打卡则包含今天；新增 chrono 本地日期，与浏览器 fallback 的本地 `YYYY-MM-DD` 对齐。
- `toggle_habit` 继续写入 / 删除当天 `habit_logs`；浏览器 `LocalShape` 新增 `habitLogs` 数组，`listHabits` / `toggleHabit` 与 Rust 同构计算，旧 localStorage 读取时自动补空数组。
- Actions Habits 卡片新增 `data-habit-recent-days` 最近 14 天热力条：每个 `data-habit-day` 单元格带 `data-habit-day-checked`，打卡日按习惯色高亮；行内新增 `data-habit-streak` 与 `data-habit-week` 周目标进度。
- 习惯按钮新增 `data-habit-toggle` 锚点，验证不再误选任务行 Toggle。
- `verify:ui` / `verify:preview` 的 habit lane 新增种子 3/2/5 连续天数、14 天热力条、打卡后连续天数 +1、今日点亮、周进度与 reload 持久化断言；`focusWeekArchive` 验证顺序修正为 reload 后先验归档持久化，再恢复任务。

## Sprint 120：Projects 项目状态与收益编辑

- Rust 新增 `update_project(id, status, revenue)`：状态仅接受 active / paused，收益非负钳制，更新后返回最新 Project，已注册 Tauri 命令；`src/lib/db.ts` 新增同构 `updateProject`，localStorage fallback 同样钳制。
- `workbenchStore` 新增 `updateProject`，保存后刷新 `projects`；每个项目卡片新增 `data-project-edit` 设置区（`data-project-status` / `data-project-revenue` / `data-project-save` / `data-project-edit-result`）。
- 保存后 Portfolio summary、项目卡片 StatPill 与 Project carousel 详情同步显示新状态 / 收益。
- `verify:ui` / `verify:preview` 新增 `projectEdit` / `projectEditPersisted` / `projectEditRestored`：编辑 1234.56 / paused → reload 持久化 → 恢复 active / 0；`cargo test --lib` 增至 126 条。

## Sprint 121：Knowledge 笔记标签编辑

- Rust 新增 `update_thought_tags(id, tags)`：仅更新 `thoughts.tags`，返回最新 Thought，已注册 Tauri 命令；`src/lib/db.ts` 新增同构 `updateThoughtTags`，localStorage fallback 直接写回 `thoughts`。
- `workbenchStore` 新增 `updateThoughtTags`，保存后刷新 `thoughts`；Knowledge 详情面板新增 `data-thought-tags-edit` / `data-thought-tags-input` / `data-thought-tags-save` / `data-thought-tags-cancel` / `data-thought-tags-result`，仅对本地 thoughts 渲染。
- 保存时按逗号（含中文逗号）拆分、去空白、补 `#` 并去重，空标签不参与拼接；保存后详情徽标、侧栏与 Tag Library 同步刷新。
- `verify:ui` / `verify:preview` 新增 `thoughtTagEdit` / `thoughtTagEditPersisted` / `thoughtTagEditRestored`：编辑 → reload 持久化 → 恢复原标签；`cargo test --lib` 增至 127 条。

## Sprint 122：Actions 习惯删除与周目标编辑

- Rust 新增 `update_habit_week_goal(id, week_goal)` 与 `delete_habit(id)`：周目标钳制到 1~31，删除时先清理 `habit_logs` 再删 `habits`；`db.ts` / `workbenchStore` 新增同构 `updateHabitWeekGoal` / `deleteHabit`，localStorage fallback 同步清理日志。
- Actions Habits 卡片每行新增 `data-habit-week-edit` / `data-habit-week-input` / `data-habit-week-save` / `data-habit-week-cancel` / `data-habit-edit-result`，删除采用二次确认（`data-habit-delete` / `data-habit-delete-confirm` / `data-habit-delete-cancel`）。
- 周目标保存后行内周进度、今日进度汇总与热力条同步；删除后习惯行消失且今日进度汇总同步减少。
- `verify:ui` / `verify:preview` 新增 `habitManage` / `habitManagePersisted` / `habitManageRestored` / `habitDeleteCheck`：编辑 7 → reload 持久化 → 恢复 5，并创建后删除测试习惯；`cargo test --lib` 增至 128 条。

## Sprint 123：AI Studio 会话归档与恢复

- `sessions` 新增 `archived INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 直接建列，旧库 `migrate_session_archived` 幂等补列；`list_sessions` 返回 `archived`，`search_sessions` 默认只搜索 active 会话。
- Rust 新增 `set_session_archived(id, archived)` 命令并返回最新 Session；`create_session` / `duplicate_session` 默认生成 active 会话。
- `db.ts` 新增同构 `setSessionArchived`，localStorage fallback 读取旧数据时自动补 `archived=false`。
- AI Studio 会话侧栏新增 Active / Archived 切换（`data-session-archive-tab`）与归档/恢复行操作（`data-session-archive` / `data-session-restore`）；归档当前会话自动切到下一个 active，恢复后回到 active tab，搜索与选中逻辑跟随当前 tab。
- `verify:ui` / `verify:preview` 新增 `sessionArchive` / `sessionArchivePersisted` / `sessionArchiveRestored`：归档 → reload 持久化 → 恢复；`cargo test --lib` 增至 130 条。

## Sprint 124：Knowledge 笔记正文编辑

- Rust 新增 `update_thought_content(id, content)` 命令：仅更新 `thoughts.content`，返回最新 Thought；`db.ts` / `workbenchStore` 新增同构 `updateThoughtContent`，localStorage fallback 同步写回 `thoughts`。
- Knowledge 详情面板新增 `data-thought-body-edit` / `data-thought-body-input` / `data-thought-body-save` / `data-thought-body-cancel` / `data-thought-body-result` / `data-thought-body-preview`，支持 Edit / Preview 切换且切换不丢草稿。
- 保存后 Markdown 预览、笔记列表与 RAG 搜索内容同步更新（thoughts 向量在 `search_thoughts` 查询时实时计算）。
- `verify:ui` / `verify:preview` 新增 `thoughtBodyEdit` / `thoughtBodyEditPersisted` / `thoughtBodyEditRestored`：编辑 → reload 持久化 → 恢复原文；`cargo test --lib` 增至 131 条。

## Sprint 125：Projects 项目删除

- Rust 新增 `delete_project(id)`：删除前将关联 `sessions.project_id` 置空，再删除项目，缺失 id 返回 `QueryReturnedNoRows`；`db.ts` / `workbenchStore` 新增同构 `deleteProject`，localStorage fallback 同步清理项目并解除会话关联。
- Projects 项目设置区新增 `data-project-delete` / `data-project-delete-confirm` / `data-project-delete-cancel`，删除采用二次确认，取消不触发删除。
- 删除后项目卡片、Portfolio summary 与 Project carousel 同步刷新，reload 后保持删除结果。
- `verify:ui` / `verify:preview` 新增 `projectDelete` / `projectDeletePersisted` / `projectDeleteCancel`：删除 → reload 持久化 → 取消不删除；`cargo test --lib` 增至 132 条。

## Sprint 126：System Provider 批量 E2E 测试

- SystemView 新增 `runAllProviderE2E()`：对全部 active Provider 并行执行 `runProviderE2EStream`，单个异常捕获为失败项（`ok=false`）不中断整批。
- Providers 操作区新增 `data-provider-batch-test` 按钮与 busy 状态，完成后显示 `data-provider-batch-result` 汇总（`N/M ok`，失败时追加失败数），结果同步写入各 Provider 卡片 `data-provider-e2e-result`。
- `verify:ui` / `verify:preview` 新增 `providerBatchE2E` lane：点击批量按钮后断言 `2/2 ok` 与卡片结果数；`cargo test --lib` 保持 132 条。

## Sprint 127：Knowledge 笔记删除与类型转换

- Rust 新增 `update_thought_type(id, type)`（仅接受 inbox / note / doc）与 `delete_thought(id)`（缺失 id 返回 `QueryReturnedNoRows`）命令；`db.ts` / `workbenchStore` 新增同构 `updateThoughtType` / `deleteThought`，localStorage fallback 同步更新或移除 `thoughts`。
- Knowledge 详情头部新增 `data-thought-type-select` 分段控件（inbox / note / doc），切换后类型徽标、Tag Library 类型分布与 RAG 结果同步刷新；新增 `data-thought-delete` / `data-thought-delete-confirm` / `data-thought-delete-cancel` 删除二次确认，删除后清除编辑状态并自动落到下一条笔记。
- Thought Inbox 新增 `data-thought-inbox-input` / `data-thought-inbox-add`，RAG 结果行 `data-rag-result` 携带笔记 id，供双端验证定位。
- `verify:ui` / `verify:preview` 新增 `thoughtTypeConvert` / `thoughtTypeConvertPersisted` / `thoughtTypeConvertRestored` / `thoughtDelete` / `thoughtDeleteCancel` / `thoughtDeletePersisted`；`cargo test --lib` 增至 134 条。

## Sprint 128：AI Studio 会话分组

- AI Studio 会话侧栏新增分组视图：按 pinned / today / yesterday / 7d / older 顺序分组，pinned 置顶，组内保持原排序；Active / Archived tab 均按同一规则渲染。
- 分组头新增 `data-session-group-toggle` / `data-session-group-label` / `data-session-group-count` / `data-session-group-collapsed`，点击折叠/展开对应组并隐藏行。
- 输入查询或 RAG 命中时自动隐藏分组头退化为平铺列表，清空查询后分组恢复；会话行渲染抽为 `renderSessionRow` 复用。
- `verify:ui` / `verify:preview` 新增 `sessionGrouping` / `sessionGroupingToggle` / `sessionGroupingSearchFlat` 三条 lane。

## Sprint 129：Projects 收益趋势

- SQLite 新增 `project_revenue_history`（id / project_id / revenue / recorded_at），新库 SCHEMA 直接建表，旧库由 `CREATE TABLE IF NOT EXISTS` 幂等补建；`create_project` / `update_project` 自动写入收益快照，`delete_project` 同步清理该项目历史。
- Rust 新增 `list_project_revenue_history(project_id, limit)`：按 `recorded_at DESC, rowid DESC` 取最近 N 条后升序返回，Tauri 命令已注册；`db.ts` / localStorage 新增同构 `listProjectRevenueHistory`，创建 / 更新 / 删除同步维护 `projectRevenueHistory`。
- Projects 项目卡片设置区下方新增 `data-project-revenue-trend` 条形趋势，每个点带 `data-project-revenue-point` / `data-project-revenue-value` / `data-project-revenue-at`，reload 后按历史恢复。
- `verify:ui` / `verify:preview` 新增 `projectRevenueTrend` / `projectRevenueTrendPersisted` 两条 lane；`cargo test --lib` 增至 135 条。

## Sprint 130：Actions 周目标统计与快速归档

- Actions 新增 `data-week-review` Week Review 卡片：由 `tasks` 派生本周每日 planned / done、周完成率、最佳日与连续完成天数（空档日不断连），含 `data-week-review-total` / `data-week-review-rate` / `data-week-review-best` / `data-week-review-streak`。
- 7 个日按钮带 `data-week-review-day` / `data-week-review-day-total` / `data-week-review-day-done` / `data-week-review-day-selected`，点击联动 Today Focus 选中日；无 dueDate 的今日 Focus 任务按 `isToday` 归入今天。
- 新增 `data-week-review-archive` 一键快速归档：本周 done 任务顺序执行 `setTaskToday(false)` + `setTaskDueDate(null)`，结果写入 `data-week-review-archived`，reload 后保持归档结果。
- `verify:ui` / `verify:preview` 新增 `weekReviewStats` / `weekReviewArchive` / `weekReviewArchivePersisted` 三条 lane；纯前端改动，无新增 Rust 命令与表结构。

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

## Sprint 86：AI 复盘结果一键保存为知识笔记

- AIStudioView 新增 `recapReady` / `recapSaving` / `recapSaveResult` 与“保存复盘”按钮（`data-ai-recap-save`）：点击“今日复盘”并等待流式结束后按钮才可用，普通发送与 New chat 重置状态。
- 保存逻辑取最近一条非占位 assistant 回复，组装为 `# 今日复盘 YYYY-MM-DD\n\n回复`，通过 store `addThought(..., "#daily,#recap", "note")` 写入既有 thoughts 链路；成功回显 `data-ai-recap-save-result`，失败回显错误，保存期间防重复点击。
- 保存后 store 刷新 `thoughts`，Knowledge Thought Inbox 立即可见新笔记，RAG 文档数同步更新。
- `verify:ui` / `verify:preview` 新增 `aiRecapSave` / `aiRecapKnowledgeVisible` lane，断言 localStorage 内容（tags / type）与 Knowledge 视图可见性。

## Sprint 87：自定义 Quick Prompt 与使用次数多端同步

- Rust 新增 `quick_prompts` / `quick_prompt_usage` 表与 `QuickPrompt` / `QuickPromptUsageEntry` 模型；新增 Tauri 命令 `list_quick_prompts` / `add_custom_quick_prompt` / `delete_custom_quick_prompt` / `list_quick_prompt_usage` / `record_quick_prompt_usage`。
- `SyncSnapshot` 增加 `quickPrompts` / `quickPromptUsage`；`merge_sync_snapshot` 按 `updatedAt` 合并 prompt、按 max count 合并 usage，`quick_prompt` 冲突存两端完整 JSON，`resolve_conflict` / union / structured 均支持该 kind。
- `db.ts` 新增 `listQuickPrompts` / `listCustomQuickPrompts` / `loadQuickPromptsByUsage` / `getQuickPromptUsage` / `recordQuickPromptUsage` / `addCustomQuickPrompt` / `deleteCustomQuickPrompt` 异步 API；AIStudioView 迁移到 `db.*`，浏览器 fallback 沿用 `ai-workbench:quick-prompts:v1` / `ai-workbench:quick-prompt-usage:v1`。
- `verify:ui` / `verify:preview` 新增 `quickPromptSync` / `quickPromptSyncVisible` / `quickPromptSyncPersist` lane；Rust 单测覆盖同步合并与冲突仲裁。

## Sprint 88：Quick Prompt 编辑与拖拽排序

- `quick_prompts` 新增 `sort_order` 列（新库走 SCHEMA，旧库走 `migrate_quick_prompt_order`）；`QuickPrompt.order` 通过 serde 进入同步快照。
- 新增 Tauri 命令 `update_custom_quick_prompt`（仅 custom 行，回写 `updated_at`）与 `reorder_custom_quick_prompts`（单事务重编号 0..n-1）。
- `db.ts` 新增 `updateCustomQuickPrompt` / `reorderCustomQuickPrompts`；`loadQuickPromptsByUsage` 排序为使用次数降序 + `order` 升序。
- AIStudioView Manage 面板升级为 dnd-kit 行式列表：拖拽手柄、编辑、上下箭头、删除；编辑态复用顶部表单并显示 Save / Cancel。
- `verify:ui` / `verify:preview` 新增 `quickPromptEditSort` / `quickPromptEditSortPersist` lane；Rust 单测覆盖编辑与重排。

## Sprint 89：行内着色 diff 与整文件对比

- Rust 新增 `get_git_file_versions(path, file)` Tauri 命令：返回 `GitFileVersions { path, status, oldContent, newContent }`，tracked 文件 old 取 `git show HEAD:file`、new 读磁盘，untracked old 为空；已注册到 `invoke_handler` 并有两条单测覆盖。
- 新增 `src/lib/diffHighlight.tsx`：`parseDiffLines` 分类 file / hunk / add / del / context，`detectLanguage` 按扩展名识别语言，`highlightLine` 基于正则 token 对注释、字符串、数字、关键字输出 JSX span。
- `db.ts` 新增 `GitFileVersions` 与 `getGitFileVersions`；浏览器 fallback 从 `getGitFileDiff` mock 反解 old / new，保证 UI 验证不依赖真实 Git 仓库。
- ProjectsView diff 面板改为行式渲染（`data-git-diff-line` / `data-git-diff-line-type`），新增 `data-git-side-by-side-toggle` 与 HEAD / Working tree 双栏（`data-git-file-version=old|new`）。
- `verify:ui` / `verify:preview` 新增 `gitInlineDiffSideBySide` lane，断言行类型集合、高亮 span、双栏行号与往返切换。

## Sprint 90：Webhook 签名与自动重试

- `webhook_signature` 基于 sha2 实现 HMAC-SHA256（密钥块 + inner/outer pad），输出 `sha256=<hex>`；`deliver_webhook_http` 增加 secret / retries，非 2xx 或网络错误按 `50ms << attempt` 指数退避，结果新增 `attempts` / `signed`。
- `webhook_rules` 新增 `secret` / `retries` 列（新库走 SCHEMA，旧库走 `migrate_webhook_secret_retries`）；`WebhookRuleInput` 收敛 db 层参数。
- `deliver_webhook` 命令接受 secret / retries；`create_webhook_rule` 命令收敛为 `WebhookRuleRequest` 结构体，调度器与 `run_webhook_rule` 共用投递函数。
- `db.ts` 为 `deliverWebhook` / `createWebhookRule` 增加 secret / retries，返回 `attempts` / `signed`；浏览器 fallback 确定性模拟 `retries + 1` 次。
- SystemView Webhook 卡片新增 `data-webhook-secret` / `data-webhook-retries` / `data-webhook-attempts` / `data-webhook-signed` / `data-webhook-rule-retries` / `data-webhook-rule-secret`。
- `verify:ui` / `verify:preview` 新增 `webhookSignRetry` lane；Rust 单测覆盖 HMAC 已知答案、签名头、重试链路与迁移。

## Sprint 91：RAG 命中人工确认

- AIStudioView 新增 `ragConfirmMode` / `pendingSend` / `pendingSelected` 状态；`sendText` 拆分为检索与 `dispatchSend`，确认态不置 busy，确认后只注入勾选命中。
- 模式条新增 `data-rag-confirm-mode` 开关；确认面板带 `data-rag-confirm-panel` / `data-rag-confirm-hit` / `data-rag-confirm-send` / `data-rag-confirm-cancel`，Send 按钮 0 选中禁用。
- New chat 与会话切换清理待确认内容；普通发送、团队模式、复盘与 regenerate 路径不变。
- `verify:ui` / `verify:preview` 新增 `ragConfirmSend` lane，覆盖勾选、取消、badge 计数与关闭确认后的直发路径。

## Sprint 92：Sync E2E 加密

- Rust 新增 `encrypt_sync_payload` / `decrypt_sync_payload`：ring 实现 PBKDF2-HMAC-SHA256 100k 次派生 256 位密钥，16 字节 salt，12 字节 nonce，AES-256-GCM，JSON envelope 为 `{v:1, alg:"AES-256-GCM", salt, iv, ciphertext}`。
- 新增 Tauri 命令：`encrypt_sync_payload_command` / `decrypt_sync_payload_command` / `export_encrypted_sync_snapshot` / `import_encrypted_sync_snapshot`；`push_sync_snapshot` / `pull_sync_snapshot` 增加可选 `passphrase`，加密时走 `push_sync_payload_http` / `pull_sync_payload_http`。
- `db.ts` 新增 `SyncEnvelope` / `encryptSyncPayload` / `decryptSyncPayload` / `exportEncryptedSyncSnapshot` / `importEncryptedSyncSnapshot`；浏览器 fallback 用 Web Crypto 镜像同一算法，localStorage key 为 `ai-workbench:sync-encrypted:v1`。
- System Sync card 新增 `data-sync-e2e-toggle` / `data-sync-passphrase` / `data-sync-e2e-status`，export / import / push / pull / auto sync 全部支持口令加密；`syncErrorMessage` 兜底空 message 的 DOMException。
- `verify:ui` / `verify:preview` 新增 `syncE2e` lane：导出加密快照、envelope 无明文、加密导入、错误口令失败、加密 push 成功提示。

## Sprint 93：UI 动效残留补全

- 新增 `src/components/ui/ProjectCarousel.tsx`：Projects 视图 `data-project-carousel` 卡片，Orbit（3D 环形）与 Fan（扇形堆叠）双模式，支持按钮 / 滚轮 / 方向键导航，选中卡前景高亮。
- Autoplay 为显式开关：rAF 推进位置、hover / focus 暂停，`prefers-reduced-motion` 下自动关闭；交互与抽屉开合只用 `transform` / `opacity` / `filter` 且 <=150ms。
- 新增 `src/components/layout/MaterialDrawer.tsx`：Header 入口打开 `data-material-drawer`，实时调整 `data-material-preset` / `data-material-opacity` / `data-material-blur`，改写 `--material-opacity-base` / `--material-blur-base` 与 `data-material-global`，localStorage `ai-workbench:material-settings:v1` 持久化。
- Motion DoD 断言改为按 `aside.drawer-panel` 定位 Inspector，避免新增 Material `<aside>` 后误取。
- `verify:ui` / `verify:preview` 新增 `projectCarousel` / `projectCarouselReduced` / `materialDrawer` lane。

## Sprint 94：本地向量 RAG 与跨文件命中

- 新增 `src/lib/embed.ts`（浏览器）与 Rust `embed_text` / `cosine_similarity` / `serialize_embedding`（Tauri）镜像实现：256 维确定性 hash 向量，Unicode token + 1-4 char gram，离线可用且双端结果一致。
- `search_thoughts` 升级为混合评分 `bm25 + 1.2 * vector`，Rust 返回 `vector_score`，浏览器 fallback 用同构 `hybridRagScore`；`RagSearchResult` / `RagIndexStatus` 增加 `vectorScore` / `vectorIndexed`。
- `knowledge_files` 新增 `embedding TEXT`：新库建列，旧库 `migrate_knowledge_embedding` 幂等补列；`upsert_knowledge_file` 写 JSON 向量，迁移已加入 `init_connection`。
- Knowledge 搜索结果新增 `data-cross-file-hits` 文件选择器（来源文件数 >=2 时显示），chips 逐文件过滤，结果行带 `data-rag-file` / `data-rag-vector-score`，底部 `data-vector-status`。
- `verify:ui` / `verify:preview` 新增 `vectorRagCrossFile` lane；Rust 单测覆盖确定性、余弦排序、迁移补列与向量评分。

## Sprint 95：Provider 模型配置与端到端流式联调

- `providers` 新增 `model TEXT DEFAULT ''`：新库 SCHEMA 建列，旧库 `migrate_provider_model` 幂等补列；新增 `update_provider_model` Tauri 命令，`create_provider` 命令接受可选 `model`。
- System Providers 卡片支持模型编辑：`data-provider-model-input` 回车 / 失焦保存，`data-provider-model` 徽标显示 `live` / `fallback`；新建表单新增 `data-provider-model-new`。
- Rust 流式链路按 `provider.model` 请求：`stream_ai_message` / `run_provider_stream_smoke_test` / `call_provider` 空值回退 `gpt-4o-mini` / `qwen2.5:3b`；`stream_ollama` / `chat_ollama` 改用 `provider.base_url`。
- 浏览器 `sendAiMessageStream` 新增真实流式：配置 model 的 http(s) Provider 用 `fetch` 消费 OpenAI-compatible SSE 或 Ollama NDJSON，支持取消与错误回显；未配置 model 保持模拟流。
- `verify:ui` / `verify:preview` 新增 `providerLiveStream` lane；Rust 单测覆盖 model 迁移 / 持久化与请求体模型名。

## Sprint 96：Webhook 事件触发器与投递队列

- `webhook_rules` 新增 `trigger_event TEXT DEFAULT ''`：新库 SCHEMA 建列，旧库 `migrate_webhook_trigger_event` 幂等补列；`list_event_webhook_rules` 按事件匹配 enabled 规则，`list_due_webhook_rules` 只选 `trigger_event = ''` 的定时规则。
- 新增持久化投递队列 `webhook_deliveries`：`queued / delivering / success / dead` 状态、`attempts`、`next_attempt_at`，带 `(status, next_attempt_at)` 与 `(rule_id)` 索引；`delete_webhook_rule` 级联删除该规则投递记录。
- `spawn_webhook_scheduler` 重构为 `spawn_webhook_delivery_worker`：定时规则先入队，`claim_due_webhook_deliveries` 最多取 8 条消费；失败按 `1000ms << attempts` 指数退避，超过 `retries + 1` 次标记 dead。
- 新增 Tauri 命令 `trigger_webhook_event` / `list_webhook_deliveries` / `retry_webhook_delivery` / `delete_webhook_delivery` / `clear_webhook_deliveries`；`list_webhook_deliveries` limit 收敛到 1~200。
- SystemView 新增事件触发输入、快捷按钮与投递队列面板；浏览器 fallback 使用 `ai-workbench:webhook-deliveries:v1` 持久化同一模型。
- `verify:ui` / `verify:preview` 新增 `webhookQueueEvent` lane；Rust 单测覆盖迁移补列与队列全生命周期。

## Sprint 97：Provider /models 探测与下拉选择

- 新增 `list_provider_models` Tauri 命令：非 Ollama 请求 `{base_url}/models`（Bearer 鉴权），Ollama 请求 `{base_url}/api/tags`，8 秒超时；`parse_provider_models` 兼容 OpenAI `data[].id / owned_by` 与 Ollama `models[].name`。
- `db.ts` 新增 `ProviderModel` / `listProviderModels`：Tauri 走 invoke，浏览器 fallback 走同构 fetch 并带 8 秒 AbortController 超时。
- SystemView Provider 卡片新增探测按钮与下拉：`data-provider-models-detect`（带数量 badge）、`data-provider-model-options` / `data-provider-model-option`、`data-provider-model-error`；模型输入改为受控，选择后即时持久化。
- `verify:ui` / `verify:preview` 新增 `providerModels` lane；Rust 单测覆盖两种响应形状与空列表错误。

## Sprint 98：Webhook payload 模板变量与事件上下文

- Rust 新增 `render_webhook_payload`：`{{event}}` / `{{ts}}` / `{{context.<field>}}` 展开为 JSON 值，缺失 context 字段展开为 `null`，未知占位符保留；定时 worker、Run now、`trigger_webhook_event` 入队前统一渲染。
- `db.ts` 新增同构 `renderWebhookPayload`；`triggerWebhookEvent` 接受可选 context，Tauri 透传、浏览器 fallback 渲染后写入投递队列。
- SystemView 事件触发器行新增 Context JSON 输入与 Preview payload；投递队列行新增 `data-webhook-delivery-payload` 展示最终 payload。
- `verify:ui` / `verify:preview` 新增 `webhookPayloadTemplate` lane；Rust 单测覆盖变量渲染、缺失字段与无变量模板。

## Sprint 99：系统事件总线接入 Webhook 触发器

- `db.ts` 新增 `emitWorkbenchEvent(event, context?)` 统一事件入口，内部复用 `triggerWebhookEvent`；投递写入后派发 `workbench:webhook-deliveries-updated` CustomEvent，浏览器 fallback 与 Tauri 前端共用同一刷新信号。
- 已接入系统事件：`clipboard.captured`（`captureClipboard` + Tauri `clipboard-updated` 监听）、`error.reported`（`reportFrontendError`）、`sync.completed`（import / importEncrypted / push / pull）、`knowledge.indexed`（`indexVault`）。
- SystemView 监听 `workbench:webhook-deliveries-updated` 后立即重载投递队列，原 5 秒轮询保留为兜底；事件入队不再依赖最长 5 秒的 UI 刷新延迟。
- `verify:ui` / `verify:preview` 新增 `webhookSystemEvents` lane：先种子两条 enabled 规则，再通过真实 Pull 与真实 `ErrorEvent` 分别触发 `sync.completed` / `error.reported`，校验 DOM 中的最终 payload。

## Sprint 100：AI Studio 会话工作台

- `sessions` 新增 `pinned INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 直接建列，旧库 `migrate_session_pinned` 幂等补列；`list_sessions` 子查询返回 `message_count`，按 `pinned DESC, created_at DESC` 排序。
- Rust 新增 `set_session_pinned(id, pinned)` 与 `duplicate_session(id)`：复制会话生成 `(copy)` 标题并复制全部消息，返回新会话及消息数。
- `db.ts` 新增 `setSessionPinned` / `duplicateSession` / `buildSessionMarkdown`，浏览器 fallback 同一模型，旧数据自动补 `pinned=false` 与消息数。
- AI Studio 会话行新增置顶按钮、消息数元信息、复制与导出操作；导出面板用 `data-session-export-panel` / `data-session-export-preview` 提供预览、复制与下载 `.md`。
- `verify:ui` / `verify:preview` 新增 `sessionWorkspace` lane，覆盖置顶排序、消息数、复制会话、Markdown 导出与面板关闭。

## Sprint 101：真实 MOA 并行聚合

- Rust `stream_ai_message(moa=true)` 对 `selected.take(3)` 并发 `spawn_blocking`，每路先 emit `## {provider.name}` 再流式输出；单路失败只发送 `[{name} error: ...]`，不中断其他路，全部结束后统一 emit `done`。
- `db.ts` 浏览器 fallback 用 `Promise.allSettled` 并行真实 SSE / NDJSON 流；`streamProviderLive` 新增 `final` / `manageCancel` 选项，多路共享 runId 取消标记，最终 `done.cancelled` 反映取消状态。
- `verify:ui` / `verify:preview` 新增 `moaParallel` lane：3 个本地 SSE mock 断言 `maxActive >= 3` 并覆盖三个标题与回复。
- 验证脚本稳定性：`reloadAndWait` 改为 `Page.navigate` + URL marker 轮询，避免旧页面上下文误判就绪导致的 `Runtime.evaluate` 超时。

## Sprint 102：ESLint/Prettier 与 husky/lint-staged 质量门禁

- 新增 `eslint.config.js`：ESLint 10 flat config + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`；保留 `exhaustive-deps`，关闭 v7 激进规则，`npm run lint` 0 errors / 0 warnings。
- 新增 `.prettierrc.json` / `.prettierignore`：`printWidth: 100`、`singleQuote`、`trailingComma: all`，排除 dist / node_modules / src-tauri 生成物 / docs 与生成 schema；`npx prettier --check .` 全绿。
- `package.json` 新增 `lint` / `format` / `format:check` / `prepare` scripts 与 `lint-staged` 配置；`.husky/pre-commit` 调用 `npx lint-staged`，staged TS/TSX 自动 `eslint --fix` + `prettier --write`。
- KnowledgeView 加载函数改为 `useCallback` 并补齐 listener / interval 依赖；SystemView 自动同步定时器用 ref 持有最新 `runAutoSync`，`checkAll` 用 `useCallback`；ProjectsView git context effect 补 `projects` 依赖。

## Sprint 103：会话搜索增强

- Rust 新增 `search_sessions(query, since, until, limit, include_messages)` 命令与 `SessionSearchHit`：标题 / 模型 / 消息全文按不区分大小写匹配，精确包含优先，字符子序列作为模糊分，命中按 score + pinned 排序。
- `db.ts` 新增 `SessionSearchHit` / `searchSessions` / `sessionMatchScore` / `sessionSnippet`，浏览器 fallback 与 Rust 同构；Tauri 环境走真实命令。
- AI Studio 会话栏搜索改为 180ms 防抖异步检索：新增 `data-session-search-input`、`data-session-range`、`data-session-fulltext`、`data-session-snippet`、`data-session-match-type`；时间范围为 Any / Today / 7d / 30d。
- `verify:ui` / `verify:preview` 新增 `sessionSearchEnhanced` lane：断言模糊标题命中、消息全文命中与摘要、全文关闭后空态、清空恢复列表。

## Sprint 104：MOA 三路共识摘要

- Rust 新增 `MoaConsensus`（summary / common / viewpoints）与 `build_moa_consensus` Tauri 命令：首条有效行 + 跨输出关键词 + 分歧首行，纯本地确定性规则，不新增依赖。
- `stream_ai_message(moa=true)` 的三路 `spawn_blocking` 改为返回各自最终文本，全部结束后在 done 前 emit `## MOA Consensus` 摘要块；取消时不追加摘要，单路失败以空输出参与。
- `stream_openai_compatible_with` / `stream_ollama_with` 返回值从 `()` 升级为完整收集文本，smoke test 与单测同步适配。
- `db.ts` 新增同构 `buildMoaConsensus` / `buildMoaConsensusLocal`，`sendAiMessageStream` 的 MOA 分支在全部流结束后 emit 相同摘要块。
- AI Studio MOA badge 状态从 `3-way` 升级为 `3-way+summary`，Inspector 展示 `3-way consensus` 状态与 Consensus 摘要。
- `verify:ui` / `verify:preview` 的 `moaParallel` lane 新增 `consensusSeen` / `summaryText` 断言；Rust 118 条单测通过。

## Sprint 105：会话消息跳转与高亮

- `SessionSearchHit` 新增 `message_id: Option<String>`：Rust `search_sessions` 的消息全文查询改为 `SELECT id, content FROM chat_messages`，命中时返回消息 ID，标题 / 模型命中为 `None`。
- `db.ts` 的 `SessionSearchHit` 同步新增 `messageId`，浏览器 fallback `searchSessions` 在消息命中时携带 `message.id`。
- AI Studio 搜索结果行新增 `data-session-message-id`，消息命中时点击 Open session 调用 `selectSession(id, messageId)`，加载后 `scrollIntoView` 并添加 `message-jump-highlight`。
- 消息气泡外层新增 `data-message-id`，`message-jump-highlight` 使用短暂边框辉光动画；新开会话或切换无命中会话时清除高亮。
- `verify:ui` / `verify:preview` 的 `sessionSearchEnhanced` lane 新增 `jumpSeen` / `jumpMessageId` / `highlightedMessageId` 断言；Rust 118 条单测通过。

## Sprint 106：Provider 优先级与路由排序

- `providers` 新增 `priority INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 建列，旧库 `migrate_provider_priority` 幂等补列；新增 `set_provider_priority` Tauri 命令，System Provider 卡片提供上下优先级按钮。
- `list_providers` / `get_provider` 统一按 `priority DESC, rowid ASC` 返回；Rust `stream_ai_message` / `send_ai_message` 与浏览器 fallback 均按优先级排序后再取前 3 / 路由目标。
- `db.ts` 的 `routeProvider` 在同优先级下继续按健康检查延迟升序兜底；SystemView 新增 `data-provider-priority` / `data-provider-priority-up` / `data-provider-priority-down` 验证锚点。
- `verify:ui` / `verify:preview` 新增 `providerPriority` lane，断言卡片按 3/2/1 排序且增减优先级持久化到 localStorage；Rust 单测覆盖迁移补列、持久化与负数钳制。

## Sprint 107：拼音/中文分词模糊搜索

- `search_sessions` 的匹配从单层原文模糊升级为原文 → 全拼 → 首字母三层：Rust 引入 `pinyin` crate，`db.ts` 引入 `pinyin-pro`，两侧同构；命中类型扩展为 `pinyin-title` / `pinyin-model` / `pinyin-message`。
- 拼音匹配使用紧凑小写形式（去空白），原文优先、全拼次之、首字母兜底；AI Studio 拼音消息命中仍携带 `messageId` 并可跳转高亮。
- `verify:ui` / `verify:preview` 新增 `sessionPinyinSearch` lane，覆盖 `mrjh` / `meirijihua` 标题命中与 `mnhjd` 消息命中跳转；Rust 120 条单测通过。

## Sprint 108：搜索历史与跨会话聚合统计

- 新增 `src/lib/searchHistory.ts`：`loadSearchHistory` / `recordSearchHistory` / `clearSearchHistory` / `summarizeSearchHits`，查询去重、最多保留 8 条，localStorage key 为 `ai-workbench:session-search-history:v1`。
- AI Studio 会话搜索完成后自动记录历史，Recent 标签可点击回填查询，清空按钮同时清理 DOM 与 localStorage；搜索栏下方 `data-session-search-stats` 展示总命中、会话数、title/model/message、拼音命中与平均分。
- `verify:ui` / `verify:preview` 新增 `sessionSearchHistoryStats` lane：覆盖 `question` 命中多会话消息、历史可见、点击回填与清空生效；`sessionManagement` 的 `emptyState` 改为 waitFor 轮询，消除偶发异步时序。

## Sprint 109：多 Provider 自动降级

- Rust `stream_ai_message` 新增 `auto_fallback`：非 MOA 分支按 `provider_ids` 顺序逐个尝试，失败时 emit `stream-fallback` 事件并追加 `[auto fallback: A → B]` 文本块；`auto_fallback_marker` 提供统一标记格式。
- `src/lib/db.ts` 新增 `StreamFallback` / `listenStreamFallbacks` / `emitLocalStreamFallback`，浏览器 fallback 与 Tauri 使用同一事件模型；`sendAiMessageStream` 在 `autoFallback` 下按传入顺序降级，全部失败才返回最终错误。
- AI Studio Single / Auto 模式传入全部 active Provider，头部新增 `data-ai-fallback-chain` 徽标，Inspector 新增 `Fallback chain` 区块；`verify:ui` / `verify:preview` 新增 `autoFallback` lane，用 500 + SSE 双 mock 断言回退链。

## Sprint 110：跨流 Token 预算与成本控制

- 新增 `src/lib/tokenBudget.ts`：`estimateTokens` 按 `len/4` 估算，`loadTokenBudget` / `recordTokenUsage` / `resetTokenBudget` / `getBudgetStatus` 持久化到 `ai-workbench:token-budget:v1`，月度 key 变化自动清零。
- System 新增 Token budget 卡片：月度上限输入、已用/进度条、Auto degrade 开关与 Reset month，`data-token-budget-card` 系列锚点齐全。
- AI Studio 头部 `data-token-budget-badge` 展示用量与 degrade / over 状态；流 done 时按回复文本记录估算 Token；超预算且开启 Auto degrade 时只路由本地 Ollama Provider，关闭时拦截并回显 `token budget exceeded`；Inspector 新增 `Budget` 区块。
- `verify:ui` / `verify:preview` 新增 `tokenBudget` lane：覆盖本地降级回复、徽标、配置切换、超限拦截、重置与恢复云 Provider 五步。
