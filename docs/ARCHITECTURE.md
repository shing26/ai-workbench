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
- 每个块通过 `stream-chunk` 事件推送：`{ id, delta, done, error, cancelled }`；单流请求 `id` 为前端生成的 `runId`，MOA 子流为 `{runId}-p{index}` / `{runId}-s{index}` / `{runId}-c`。
- MOA 模式对前 3 个启用 Provider 并发请求，每路独立 emit `done`，全部结束后 emit `## MOA Consensus` 子流收尾。
- 前端 AI Studio 监听 `stream-chunk`，assistant 消息增量追加；浏览器 fallback 用分块模拟流与真实 SSE 双路径，保证 UI 验证可运行。

## AI 流式取消 / 中断

- Rust 后台维护 `StreamCancellation` 状态，`cancel_ai_stream(run_id)` 命令登记取消标记；流式函数逐块检查标记，命中后停止 emit。
- `stream-chunk` 的 done 事件在取消时带 `cancelled: true`，结束后清理该 run 的取消标记。
- MOA 每条流卡片提供独立 Stop，只取消对应子流；失败/停止的单路提供 Retry，只重跑该 Provider 并重算 Consensus。
- AI Studio busy 时输入区显示全局 Stop 按钮，点击后取消全部活动流、立即标记消息 `[stopped]`，并忽略旧 run 的后续块。
- 浏览器 fallback 使用本地取消集合 + `AbortController` 注册表，取消时直接中断真实 fetch，保证单路取消对暂停流也生效。

## 系统采集

- Rust 后台启动 `spawn_clipboard_monitor` 线程，每 1.5 秒轮询系统剪贴板。
- 剪贴板内容变化时写入 `clipboard_history`，并 emit `clipboard-updated` 事件。
- 前端全局监听 `error` 与 `unhandledrejection`，通过 `report_frontend_error` 写入 `error_logs`。
- System 视图每 3 秒刷新剪贴板与日志，监听事件时立即刷新。

## Provider 健康度监控

- Rust `check_provider_health(provider_id)` 按类型探测：Ollama 请求 `/api/tags`，OpenAI 兼容节点请求 `/models`，返回 `{ ok, latencyMs, message }`。
- 显式 `provider_type`（`ollama` / `openai-compatible` / `custom`）是路由唯一依据，不再按名称或 11434 端口猜测；legacy 数据只在首次迁移时推断。
- System Provider 卡片展示健康点、状态与延迟；进入视图自动检查，支持单个 Check 与 Check all。
- 健康检查双端同构：Rust 与浏览器 fallback 均为 6 秒超时；浏览器真实请求带 AbortController，超时回显 `Request timeout: provider did not respond in time`。
- 浏览器 fallback 在可运行 UI 验证模式下继续返回模拟健康结果。

## Provider Control 深模块

- `ProviderControlOrchestrator` 统一管理 provider 列表、Lab 选中项、健康 / smoke / model 状态与 busy/error；视图只消费 snapshot 与命令。
- Provider Control modal 从 Header / AI Studio / Actions 进入，承担新增、删除、启用/停用、标签 / Base URL / API key / 类型编辑、优先级、超时与重试配置。
- Provider Lab 对当前选中 Provider 执行连接测试、流式 smoke test 与模型发现；所有写操作通过可注入 adapter 走 `db.ts`，Rust 与浏览器 fallback 不在组件中分支。
- `activeProviderFromSnapshot` 只把 enabled Provider 提供给 roundtable、L4 与 CLI 交付链路；Provider Lab 仍可保留 disabled Provider 作为编辑 / 测试对象。
- 显式类型契约：Rust 新增 `delete_provider` / `update_provider_profile`，`provider_type` 在 create / update / import 中统一归一化；浏览器 fallback 对缺失类型的 legacy 数据做一次性推断，不覆盖显式 `openai-compatible`。
- smoke 双端同构：空 model 时使用 Rust 相同默认值（Ollama `qwen2.5:3b`，其他 `gpt-4o-mini`），并执行单次流式请求，不经过重试层。
- 新增锚点 `data-provider-open` / `data-provider-card` / `data-provider-lab-*` / `data-provider-selected-name`，保留既有 `data-*` / `aria-label` 契约。

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

## Sprint 131：Webhook 事件规则冷却期

- `webhook_rules` 新增 `cooldown_seconds INTEGER NOT NULL DEFAULT 0`：新库 SCHEMA 建列，旧库 `migrate_webhook_cooldown` 幂等补列；`WebhookRule` / `WebhookRuleInput` / `WebhookRuleRequest` 全程携带 `cooldownSeconds`，创建时 clamp >= 0。
- `list_event_webhook_rules` 增加 `now_ms` 参数并按 `(last_run_at = 0 OR now - last_run_at >= cooldown_seconds * 1000)` 过滤；`trigger_webhook_event` 命中后更新规则 `last_run_at`，冷却期内重复事件不再入队。
- System 规则编辑区新增 `data-webhook-rule-cooldown` 输入，事件规则列表展示 `data-webhook-rule-cooldown-badge`（`cooldown Ns`）；浏览器 fallback 在 `triggerWebhookEvent` 中按 `lastRunAt` 过滤并写回规则，`readWebhookRules` 对旧数据默认补 0。
- `verify:ui` / `verify:preview` 新增 `webhookRuleCooldown` lane；Rust 新增 `webhook_cooldown_migration_adds_column` / `webhook_event_cooldown_suppresses_repeat_triggers` 单测，`cargo test --lib` 增至 137 条。

## Sprint 132：AI Studio 会话导出到知识库

- 会话导出面板新增 `data-session-export-knowledge` 按钮：点击后调用 `addThought(buildSessionMarkdown(...), '#chat,#session', 'note')`，成功显示 `Saved to Knowledge`，保存中禁用防重复提交，结果写入 `data-session-export-knowledge-result`。
- 打开 / 关闭导出面板时清空保存状态与结果，避免旧状态残留；浏览器 fallback 与 Tauri 共用 `createThought` 链路，无需新增命令。
- `verify:ui` / `verify:preview` 新增 `sessionSaveKnowledge` / `sessionSaveKnowledgePersisted` 两条 lane；纯前端改动，无新增表结构。

## Sprint 133：Projects 收益历史 CSV 导出

- ProjectsView 新增 `csvCell` 与 `revenueCsv` 派生：遍历 `projects` 与 `revenueTrends` 汇总全部趋势点为 `Project,ProjectId,Status,RecordedAt,Revenue`，CSV 字段做引号转义，无历史项目的行用当前 `revenue` 兜底。
- Portfolio summary 卡片新增 `data-project-revenue-export` 开关、`data-project-revenue-csv-preview` 预览、`data-project-revenue-csv-copy` 复制与 `data-project-revenue-csv-download` 下载；结果写入 `data-project-revenue-export-result`，复制成功后按钮显示 Copied。
- `verify:ui` / `verify:preview` 新增 `projectRevenueExport` lane：断言 CSV 表头、AI Workbench / Hermes Station 项目名、行数、复制状态与结果文本；纯前端改动，无新增 Rust 命令与表结构。

## Sprint 134：Webhook 投递保留策略

- SQLite 新增 `webhook_retention_config` 单行表（id=1）：`retention_days / max_records / auto_cleanup / updated_at`，SCHEMA 直接建表；`get_webhook_retention_config` 空行回退默认 30 天 / 200 条 / 自动开启，`set_webhook_retention_config` 钳制天数 1~3650、条数 1~100000 后 upsert。
- `prune_webhook_deliveries` 先删过期 success / dead（`created_at < now - days`），再按 `max_records` 从 `created_at ASC, rowid ASC` 裁剪最旧终态记录；queued / delivering 不参与年龄清理，返回 removedByAge / removedByCount / totalRemoved。
- `spawn_webhook_delivery_worker` 每轮在 auto_cleanup 开启时自动调用清理；新增 Tauri 命令 `get_webhook_retention_config` / `set_webhook_retention_config` / `prune_webhook_deliveries` / `get_webhook_delivery_stats`。
- SystemView Webhook 卡片新增 Retention policy 区：`data-webhook-retention-days` / `data-webhook-retention-limit` / `data-webhook-retention-auto` / `data-webhook-retention-save` / `data-webhook-retention-prune` / `data-webhook-retention-stats` / `data-webhook-retention-result`。
- `db.ts` 新增同构 `WebhookRetentionConfig` / `WebhookPruneResult` / `WebhookDeliveryStats` 与 get / set / prune / stats，浏览器 fallback 用 `ai-workbench:webhook-retention:v1`，`triggerWebhookEvent` 写入时按 autoCleanup 自动裁剪。
- `verify:ui` / `verify:preview` 新增 `webhookRetention` lane；Rust 单测覆盖默认值 / 钳制、年龄与条数裁剪、状态统计，`cargo test --lib` 增至 140 条。

## Sprint 135：Knowledge 笔记双链与回溯

- `db.ts` 新增 `extractWikiLinks`（解析 `[[target]]` / `[[target|alias]]` 并按笔记去重）、`thoughtTitle`（首行 Markdown 标题）、`resolveWikiLinkTarget`（标题精确匹配 + 子串兜底）与 `buildThoughtLinkGraph`（outgoing / incoming 双链图），全部为运行时派生，无新增表结构。
- Knowledge 详情新增 `data-thought-links` 区：`data-thought-link-out` 出链按钮、`data-thought-link-back` 回链按钮、`data-thought-link-missing` 未解析目标、`data-knowledge-graph-stats` 统计（links / backlinks / missing）。
- `navigateToThought` 点击双链时清空 RAG 结果、跨文件过滤与标签过滤，再切换到目标笔记；链接解析同时覆盖编辑器预览，正文编辑后立即重新计算。
- `verify:ui` / `verify:preview` 新增 `knowledgeBacklinks` lane：覆盖出链、回链、缺失统计与双向跳转；纯前端改动，无新增 Rust 命令与表结构。

## Sprint 136：Projects 收益端聚合展示

- ProjectsView 新增 `revenueAggregate`：latestTotal（每项目最新趋势点合计，无历史回退当前 revenue）、trendTotal（全项目趋势点数）、delta7d / delta30d（以窗口内最后一个历史点为基线）、byStatus（状态 → 项目数 + 收益合计）。
- Portfolio summary 新增 `data-project-revenue-summary` 聚合区：`data-project-revenue-latest` / `data-project-revenue-points` / `data-project-revenue-delta7d` / `data-project-revenue-delta30d` 四格，以及 `data-project-revenue-status` 状态 chips。
- Portfolio export 报告 Overview 新增 Latest revenue / Revenue points / 7d delta / 30d delta 四行；聚合全部为运行时派生，无新增表结构。
- `verify:ui` / `verify:preview` 新增 `projectRevenueSummary` lane：种子两个项目与 4 个趋势点后断言聚合数值与状态拆分，并在 lane 结束后恢复原始 projects / history 以保护后续 Git 与编辑 lane。

## Sprint 138：Webhook 自动熔断

- `webhook_rules` 新增 `consecutive_failures INTEGER NOT NULL DEFAULT 0` 与 `auto_disable_after INTEGER NOT NULL DEFAULT 3`：新库 SCHEMA 建列，旧库 `migrate_webhook_circuit_breaker` 幂等补列；`WebhookRule` / `WebhookRuleInput` / `WebhookRuleRequest` 全程携带这两个字段，创建时 `auto_disable_after` clamp >= 0（0 表示不自动熔断）。
- `db::record_webhook_rule_outcome` 按真实投递终态更新规则：2xx 清空连续失败，非 2xx / 网络错误累加；达到阈值自动 `enabled = 0` 并写入 `Auto-disabled after N consecutive failures`；`set_webhook_rule_enabled(true)` 同时重置失败计数，手动恢复后从干净状态开始。
- `run_webhook_rule_inner` 与 delivery worker 的 success / dead 终态共用同一熔断函数；入队时的 202 标记仍走 `mark_webhook_rule_run`，只更新 `last_run_at`，不干扰失败计数。
- SystemView Webhook 表单新增 `data-webhook-rule-auto-disable` 输入，规则行新增 `data-webhook-rule-failures`（连续失败徽标）与 `data-webhook-rule-auto-disable`（熔断阈值徽标）；`db.ts` 的 `WebhookRule` / `createWebhookRule` / fallback 与 Rust 同构，fallback 按 URL 含 `/fail` 模拟失败并执行相同累计 / 清零 / 停用语义。
- `verify:ui` / `verify:preview` 新增 `webhookRuleCircuitBreaker` lane；Rust 新增迁移、累计、自动停用、零阈值不熔断与重新启用重置单测，`cargo test --lib` 增至 143 条。

## Sprint 139：Webhook 规则执行日志与失败告警

- 新增 `webhook_rule_runs` 表（id / rule_id / kind / status / http_status / attempts / message / created_at）与 `(rule_id, created_at DESC)` 索引，SCHEMA 自动建表；`record_webhook_rule_run` 写入后按规则裁剪保留最近 50 条。
- `run_webhook_rule_inner` 记录 `manual` 成功 / 失败；delivery worker 的 success / dead 终态记录 `scheduled` / `event` 运行，含 http_status、attempts 与 message；新增 Tauri 命令 `list_webhook_rule_runs(rule_id?, limit?)`。
- SystemView Webhook 卡片新增 Run log 区：`data-webhook-rule-runs` 列表、`data-webhook-rule-run-item` 行与 status / http / attempts / message / time 徽标；最近 24h 有失败时展示 `data-webhook-rule-fail-alert` 告警条，Run now / 事件触发 / 删除规则都会即时刷新日志。
- `db.ts` 新增 `WebhookRuleRun` / `listWebhookRuleRuns`，浏览器 fallback 用 `ai-workbench:webhook-rule-runs:v1` 持久化并在 `runWebhookRule` / `triggerWebhookEvent` 写入同构记录；`verify:ui` / `verify:preview` 新增 `webhookRuleRunLog` lane，Rust 单测增至 144 条。

## Sprint 141：Actions 周计划模板

- `schedule_events` 新增 `date TEXT NOT NULL DEFAULT ''`：新库 SCHEMA 直接建列，旧库 `migrate_schedule_event_date` 幂等补列并加入 `init_connection` 迁移链；Rust `ScheduleEvent` / `list_schedule_events` / `create_schedule_event` 全程携带 date，列表按 `date, start_time` 排序，`create_schedule_event` Tauri 命令新增 `date` 参数。
- `db.ts` 的 `ScheduleEvent` 新增 `date`，`createScheduleEvent(title, startTime, tag, date)` 与浏览器 fallback 同构持久化；store 新增 `applyWeekPlan`，按周一到周日批量写入 Focus（dueDate / isToday）与 Schedule（date）事件。
- 新增 `src/lib/weekPlanTemplates.ts`：`WeekPlanTemplate`（id / name / 7 天 focus + events）、内置 Balanced week 模板、`loadWeekPlanTemplates` / `saveWeekPlanTemplates`（localStorage）、`weekPlanTemplateCounts`。
- ActionsView 新增 Week Plan 卡片：`data-week-plan-template` 模板选择、`data-week-plan-preview` 7 日预览、`data-week-plan-apply` 一键写入、`data-week-plan-result` 汇总；Schedule Timeline 行新增 `data-schedule-event-row` 并展示日期，手动建事件可自选日期。
- `verify:ui` / `verify:preview` 新增 `weekPlanTemplate` / `weekPlanPersisted` lane；Rust 单测新增 `schedule_event_date_migration_adds_column_and_orders`，`cargo test --lib` 增至 145 条。

## Sprint 143：Webhook 多通道投递与熔断恢复指数退避

- `webhook_rules` 新增 `channels TEXT NOT NULL DEFAULT '["http"]'`、`recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300`、`circuit_opened_at INTEGER NOT NULL DEFAULT 0`，`webhook_deliveries` 新增 `channel TEXT NOT NULL DEFAULT 'http'`，新增 `webhook_channel_config` 单行表（email / SMTP / notification）；新库 SCHEMA 直接建列建表，旧库 `migrate_webhook_channels_recovery` 幂等补列并加入 `init_connection` 迁移链。
- 新增 `parse_webhook_channels`、`enqueue_webhook_delivery_channel`、`get/set_webhook_channel_config`、`list_circuit_open_webhook_rules`、`set_webhook_circuit_opened_at`；调度器与 `trigger_webhook_event` 按规则 `channels` 逐通道入队，投递 worker 按 channel 分发到 HTTP / 邮件 / 系统通知。
- 邮件通道由 `lettre` `SmtpTransport::builder_dangerous` 明文 SMTP 发送，`deliver_webhook_email` 校验 from / to / host；系统通知通过 `webhook-notification` Tauri 事件发出；新增 Tauri 命令 `get_webhook_channel_config` / `set_webhook_channel_config` / `test_webhook_notification` / `test_webhook_email` / `probe_webhook_recovery`。
- 熔断恢复调度：`webhook_recovery_backoff_ms` 按 `recovery_backoff_seconds * 2^failures`（`.clamp(0, 30)` 指数，封顶 24h）计算，worker 对到期规则做 HTTP 探测，成功恢复 enabled / 清零失败计数，失败重置 `circuit_opened_at` 继续退避；手动 `probe_webhook_recovery` 复用同一逻辑。
- `db.ts` 新增 `WebhookChannelName` / `WebhookChannelConfig` / `WebhookRecoveryResult`，`WebhookRule` 携带 `channels` / `recoveryBackoffSeconds` / `circuitOpenedAt`，`WebhookDelivery` 携带 `channel`；fallback 用 `ai-workbench:webhook-channel-config:v1` 持久化通道配置，`triggerWebhookEvent` 逐通道入队，`probeWebhookRecovery` 模拟成功 / 失败并按同一退避公式计算。
- SystemView Webhook 卡片新增通道多选与恢复退避输入（`data-webhook-rule-channel` / `data-webhook-rule-backoff`）、规则行通道 / 退避徽标（`data-webhook-rule-channels` / `data-webhook-rule-backoff`）、投递行通道徽标（`data-webhook-delivery-channel`）、Channel settings 面板（SMTP / 收件人 / 通知标题 / 保存 / 测试）与 `data-webhook-recovery-probe` 按钮。
- `verify:ui` / `verify:preview` 新增 `webhookMultiChannel` / `webhookRecoveryBackoff` lane；Rust 单测覆盖迁移幂等、通道配置默认 / 钳制、多通道创建与入队、熔断开启列表与恢复重置、SMTP mock 发信、通知事件载荷与退避公式，`cargo test --lib` 增至 161 条。

## Sprint 146：语义聚类与文档去重

- 新增 `knowledge_clusters` / `knowledge_cluster_members` / `knowledge_cluster_config` / `knowledge_dedup_candidates` 四张表及 `idx_knowledge_dedup_status` 索引；新库 SCHEMA 直接建表，旧库 `migrate_knowledge_clusters` 幂等播种默认阈值（cluster 0.62 / dedup 0.92），已加入 `init_connection` 迁移链。
- `recompute_knowledge_clusters` 读取 indexed 知识文件向量，按余弦相似度贪心聚类：超过 cluster_threshold 加入最佳簇并更新质心，否则新建簇；持久化簇代表文本、质心与成员相似度，并按 dedup_threshold 计算高相似候选对。
- `refresh_knowledge_dedup_candidates` 跳过已 dismiss / merged 组合，文件被删除后自动将 open 转 merged；`dismiss_knowledge_duplicate` / `merge_knowledge_duplicate` 分别标记忽略与删除重复文件，merge 同时刷新分片统计。
- 新增 Tauri 命令 `get_knowledge_cluster_status` / `recompute_knowledge_clusters` / `dismiss_knowledge_duplicate` / `merge_knowledge_duplicate`；`db.ts` 浏览器 fallback 使用 `ai-workbench:knowledge-clusters:v1` / `ai-workbench:knowledge-cluster-config:v1` / `ai-workbench:knowledge-dedup:v1` 同构持久化。
- KnowledgeView 新增 Semantic clusters 卡片：cluster / dedup 阈值输入、Recompute 按钮、可展开簇成员列表（`data-cluster-*`）与去重候选 Dismiss / Merge 操作（`data-dedup-*`）。
- `verify:ui` / `verify:preview` 新增 `knowledgeClusters` / `knowledgeDedupActions` lane；Rust 单测覆盖迁移、聚类分组与去重 dismiss / merge 生命周期，`cargo test --lib` 增至 175 条。

## Sprint 145：真实 Embedding、增量重建与分片索引

- `knowledge_files` 新增 `shard_id` / `embedding_model` / `embedding_dim` / `embedding_status` / `embedding_error`，新增 `embedding_config` 单行表与 `vector_shards` 分片表及 `idx_knowledge_files_shard` 索引；新库 SCHEMA 直接建列建表，旧库 `migrate_vector_index` 幂等补列并播种分片，已加入 `init_connection` 迁移链。
- `embed_with_config` 统一封装 `local` / OpenAI-compatible `/embeddings` / Ollama `/api/embed`，Bearer 可选、20s 超时，失败回退本地哈希向量并保留 `failed` 状态与错误原因；`upsert_knowledge_file` 写入时按配置嵌入并分配 shard，`delete_knowledge_file` 刷新旧分片统计。
- `rebuild_vector_index(force)` 只处理 `embedding_status != indexed` / `embedding_model != target` / `embedding` 为空 / force 的候选（单批最多 25 个），写回分片后刷新统计；`spawn_vector_rebuild_worker` 在 `auto_rebuild` 开启时每 30s 后台补齐 pending，已接入 Tauri setup 启动链。
- `search_thoughts` 查询向量优先使用配置模型、失败回退本地，结果携带 `shardId` / `embeddingModel`；新增 Tauri 命令 `get_embedding_config` / `set_embedding_config` / `get_vector_index_status` / `rebuild_vector_index`，`db.ts` 浏览器 fallback 使用 `ai-workbench:embedding-config:v1` / `ai-workbench:vector-shards:v1` 同构持久化。
- KnowledgeView 新增 Vector index 卡片：配置表单（mode / base_url / api_key / model / shards / auto rebuild）、Rebuild 按钮（含 force）、状态统计条与分片列表；搜索结果行新增 `data-rag-shard` / `data-rag-embedding-model` 元数据。
- `verify:ui` / `verify:preview` 新增 `vectorIndexConfig` / `vectorIndexRebuild` / `vectorShardSearch` lane；Rust 单测覆盖迁移、配置默认 / 钳制、分片分配、upsert 统计、重建生命周期与 OpenAI / Ollama 响应解析，`cargo test --lib` 增至 172 条。

## Sprint 144：事件总线持久化、Schema 校验与跨设备转发

- 新增 `event_logs`（id / event / context / source / device_id / schema_version / status / rejected_reason / created_at，含 `(created_at DESC)` 与 `(event, created_at DESC)` 索引）、`event_schemas`（event PK / schema / enabled / updated_at）、`event_forwards`（event_log_id / target_url / target_token / status / attempts / next_attempt_at / last_status / last_message，含 due 索引）与 `event_bus_config` 单行表；新库 SCHEMA 直接建表，旧库打开同样走 SCHEMA，无需迁移函数。
- `emit_event_bus_event` 成为统一事件入口：落库 → schema 校验（`required` + `properties.<field>.type`，支持 string / number / boolean / object / array / null）→ `accepted` / `rejected`（保留 rejected_reason）→ 配置开启时入队转发 → 复用 `trigger_webhook_event` 触发 Webhook；浏览器 fallback 使用 `ai-workbench:event-logs:v1` / `ai-workbench:event-schemas:v1` / `ai-workbench:event-forwards:v1` / `ai-workbench:event-bus-config:v1` 同构持久化。
- `spawn_event_forward_worker` 每 2s 认领最多 8 条到期转发，POST JSON（可选 Bearer token），失败按 `1000ms << attempts` 退避并封顶 5 次后标记失败，`retry_event_forward` 可手动重试；新增 13 个 Tauri 命令覆盖 emit / logs / schemas / config / forwards / stats。
- `db.ts` 的 `emitWorkbenchEvent` 改为复用 `emitEventBusEvent` 并派发 `workbench:event-bus-updated`；SystemView 新增 Event bus 卡片（统计条、事件输入、日志 / Schema / 转发队列、保留策略与清理按钮）。
- `verify:ui` / `verify:preview` 新增 `eventBusLogging` / `eventBusSchema` / `eventBusForward` lane；验证脚本 Edge 启动参数补 `--disable-extensions` 并增加浏览器 console.error / exception 监听，解决本机扩展刷屏导致的 CDP 超时；Rust 单测增至 165 条。

## Sprint 142：Webhook 复杂触发器条件与签名校验收发端

- 新增 `src-tauri/src/webhook_condition.rs`：`validate_condition` 校验、`matches_condition(condition, event, context, now)` 求值；DSL 支持 `event == / !=`、`context.field == / != / > / < / >= / <=`、`true / false / null`、`and / or / not / 括号`、裸事件名简写与 `cron(...)`。
- `webhook_rules` 新增 `trigger_condition TEXT NOT NULL DEFAULT ''`：新库 SCHEMA 直接建列，旧库 `migrate_webhook_trigger_condition` 幂等补列并加入 `init_connection` 迁移链；`WebhookRule` / `WebhookRuleInput` / `WebhookRuleRequest` 全程携带，创建时非空条件先校验再落库。
- cron 支持 5 段（分 时 日 月 周）`*` / 数字 / `1-5` / `*/5` / `1-15/5` / `a/step` / 逗号列表，日与周同时受限时按标准 cron OR 语义匹配；`spawn_webhook_delivery_worker` 对 due 规则按条件 / cron 过滤，`trigger_webhook_event` 对事件规则按条件过滤，条件不满足不入队。
- 新增 Tauri 命令 `verify_webhook_signature(secret, payload, signature)`，返回 `{ valid, expected, algorithm }`：复用 HMAC-SHA256，兼容 `sha256=<hex>` 前缀与裸 hex；`db.ts` 新增同构 `verifyWebhookSignature`（浏览器 fallback 用 Web Crypto HMAC-SHA256）。
- System Webhook 卡片新增 Signature verify 区（`data-webhook-sig-secret` / `data-webhook-sig-signature` / `data-webhook-sig-payload` / `data-webhook-sig-verify` / `data-webhook-sig-result`）；规则表单新增 `data-webhook-rule-condition-input`，规则行新增 `data-webhook-rule-condition` 徽标与 `data-webhook-condition-error` 校验提示。
- `verify:ui` / `verify:preview` 新增 `webhookTriggerCondition` / `webhookSignatureVerify` lane；Rust 新增 cron 匹配、条件表达式正反例、签名校验前缀兼容与迁移 / 持久化单测，`cargo test --lib` 增至 154 条。

## Sprint 140：Knowledge 双链补全编辑器提示

- `db.ts` 新增 `WikiLinkSuggestion` 与 `suggestWikiLinkTargets`：按首行标题 / 标签过滤，精确 > 前缀 > 包含 > 标签排序，默认返回最多 6 条并排除当前笔记；补全候选为运行时派生数据，不新增持久化字段。
- Knowledge 正文编辑器输入未闭合 `[[...` 时弹出 `data-wiki-link-suggestions` 列表：`data-wiki-link-suggestion` 支持鼠标点击与 ArrowUp / ArrowDown 高亮，Enter / Tab 插入 `[[Title]]`，Esc 关闭；保存 / 取消 / Preview / 跳转笔记时清理联想状态。
- `verify:ui` / `verify:preview` 新增 `wikiLinkAutocomplete` / `wikiLinkPersisted` lane：种子 4 条笔记，覆盖候选排序、方向键高亮、点击 / Enter / Tab / Esc 与保存重载持久化；纯前端改动，无新增 Rust 命令与表结构。

## Sprint 137：AI Studio 会话摘要与关键词

- `db.ts` 新增 `buildSessionSummary`：questionCount、keywords（中文 2-3 字 n-gram + 英文词，过滤停用词，top 6）、points（user 消息配对下一条 assistant 回复，各取首行截断），纯运行时派生。
- `buildSessionMarkdown` 在正文前插入 `## Summary` 段：`Questions` / `Keywords` / Q&A 要点，会话导出到知识库时摘要一并落库。
- AI Studio 导出面板头部新增 `data-session-summary` 摘要条：`data-session-summary-stats`、`data-session-summary-keyword` chips、`data-session-summary-point` 要点列表；打开 / 关闭面板时同步设置 / 清空摘要状态。
- `verify:ui` / `verify:preview` 新增 `sessionSummary` lane：覆盖摘要统计、关键词、要点与 Markdown Summary 段；纯前端改动，无新增 Rust 命令与表结构。

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

## Sprint 147：Projects 轮播拖拽排序与速度滑杆

- `projects.sort_order` 成为轮播排列的事实来源：新库 SCHEMA 直接建列，旧库 `migrate_project_sort_order` 按 `created_at` 倒序回填；`list_projects` 按 `sort_order ASC, created_at DESC` 返回，`create_project` 追加到末尾。
- 新增 Tauri 命令 `reorder_projects(ids)`，单次调用按传入 id 顺序写回 0..n-1；`db.ts` 浏览器 fallback 对 `ai-workbench:db:v1` 的 `projects` 数组做同构重排，不新增 localStorage key。
- ProjectCarousel 拖拽使用 pointer 事件：拖动超过约一张卡片宽度即换位，拖拽期间暂停 autoplay 并抑制 click 跳转；`moveDrag` 在提交后重置 committed 并更新基准点，支持同一手势内连续换位。
- 速度滑杆 1~10 以 `0.00055 * speed` 推进 autoplay，持久化到 `ai-workbench:carousel-speed:v1`，reload 后恢复；`verify:ui` 新增 `carouselReorder` lane，并保证 lane 结束还原 fixture 状态。

## Sprint 148：Projects / Material 逐卡独立配色记忆

- `projects.material` 保存逐卡材质记忆：空串表示自动（按索引循环预设），cyan / original / rain / chrome 表示显式记忆；`update_project_material` 在 Rust 侧校验合法值并返回最新 Project。
- ProjectCarousel 渲染时用 `resolveMaterial` 合并显式记忆与默认循环，卡片保留 `data-carousel-material` 与新增 `data-carousel-material-memory`；选中卡详情条提供 Auto + 4 色 swatch，点击后经 store 持久化并刷新。
- 浏览器 fallback 复用 `ai-workbench:db:v1` 的 `projects` 数组（项目对象新增可选 `material`），不新增 localStorage key；`verify:ui` 新增 `carouselMaterialMemory` lane，并在 lane 末尾还原 Auto 状态。

## Sprint 149：MOA 子流独立取消与单路重试

- `stream_ai_message` 的 MOA Parallel 为每个 Provider 分配 `{run_id}-p{index}`，Chain 分配 `{run_id}-s{index}`，Consensus 使用 `{run_id}-c`；每条子流在结束时各自 emit done / error / cancelled，父 runId 仅收尾。
- MOA Chain 中途取消（单路 Stop 或全局 Stop）时，尚未开始的后续步骤由 Rust 与浏览器 fallback 统一 emit `done + cancelled`，保证前端 busy 及时退出、后续占位卡收尾为 `[stopped]`。
- AI Studio 为每个 MOA 子流维护独立 runsRef / meta / results：流卡片 streaming 时提供 `data-moa-lane-stop`，失败或停止后提供 `data-moa-lane-retry`；单路重试通过 `truncateChatMessages` 重建该用户消息之后的会话并只重跑目标 Provider，再调用 `buildMoaConsensus` 刷新摘要。
- Chain 单路重试只重跑目标步骤并截断其后旧步骤，避免保留伪造的链式结果；Parallel 单路重试则保留其它路并重算 Consensus。
- 浏览器 fallback 用 `localStreamControllers` 注册每条真实流的 `AbortController`，`cancelAiStream` 同时登记标记并 abort；非 MOA 单 Provider 请求严格按 `providerIds[0]` 路由，保证重试精确命中。

## Sprint 150：Provider 导入导出 / API Key 加密 / 流式超时与自动重试

- `providers` 新增 `api_key_encrypted / timeout_secs / retry_count / retry_delay_secs`；app setup 时在 app data dir 生成 / 读取 `provider.key`（32 字节 hex 密钥），`create_provider` / `import_providers` 对非空 API Key 用 AES-256-GCM 加密为 `enc:v1:<base64>`，`list/get/stream` 命令通过 `decrypt_provider(s)` 统一解密后使用。
- `export_providers` 解密整批 Provider 并返回 `{version:1, exportedAt, providers}` 明文 JSON，System 工具栏复制到剪贴板；`import_providers` 接受数组或 `{providers:[]}`，字段钳制、id 重建、API Key 重新加密后由 `replace_providers` 整体替换。
- `update_provider_stream_config(id, timeoutSecs, retryCount, retryDelaySecs)` 按 1~300 / 0~5 / 0~30 钳制持久化；System Provider 卡片新增 Timeout / Retries / Delay 三个输入，blur / Enter 保存。
- Rust `stream_ai_message` / `call_provider` 与浏览器 `streamProviderLive` / `streamProviderWithRetry` 同构实现超时与重试：超时后回显 `Request timeout: provider did not respond in time`；仅在未 emit 任何 delta 前按 `retry_count` 重试，间隔 `retry_delay_secs`，已开始输出则直接失败。
- 浏览器 fallback 的 `exportProviders` / `importProviders` 同构：导入把 `apiKeyEncrypted` 强制为 false，配置字段按相同范围钳制后写回 `ai-workbench:db:v1`；不新增 localStorage key。
- `verify:ui` / `verify:preview` 新增 `providerTimeout` / `providerRetry` / `providerConfigEdit` / `providerExport` / `providerImport` / `importedRetry` lanes；Sprint 149 lane seeding 显式补 `retryCount:0` 保持手动重试语义。

## Sprint 151：模型能力元数据 / 收藏与最近使用 / `/models` 缓存自动刷新

- SQLite 新增 `model_metadata` 模型目录表：`(provider_id, model_id)` 联合主键，字段含 `context_window / input_price_per_mtok / output_price_per_mtok / rate_tpm / rate_rpm / is_favorite / last_used_at / fetched_at / updated_at`；Rust 排序为 `is_favorite DESC, last_used_at DESC, model_id ASC`。
- 新增 Tauri 命令：`list_cached_provider_models` / `refresh_provider_models` / `update_provider_model_meta`（`ModelMetaPatch` 结构体传参）/ `set_provider_model_favorite` / `touch_provider_model_usage`；`refresh_provider_models` 复用 `fetch_provider_models` 真实探测后 upsert，只覆盖 `owned_by / fetched_at`，保留用户元数据。
- SystemView 在 Provider 列表变化时自动读取缓存，stale（>24h）时自动 `refreshProviderModels`；Detect 按钮也改为刷新链路，卡片显示 `N · fresh/stale` 缓存状态与 refresh 忙碌徽标。
- 模型选项行展示 `ctx / $in/$out / TPM` 能力徽标、收藏星标与 5 字段元数据编辑器（contextWindow / inputPricePerMtok / outputPricePerMtok / rateTpm / rateRpm）；选择模型调用 `touchProviderModelUsage` 并即时重排，收藏点击后即时重排。
- 浏览器 fallback 在 `ai-workbench:db:v1` 新增 `modelCache`（按 providerId 分组的 `ProviderModel[]`），`MODEL_CACHE_TTL_MS` 为 24h；`listCachedProviderModels` / `refreshProviderModels` / 元数据与收藏函数同构，不新增独立 localStorage key。
- `verify:ui` / `verify:preview` 新增 `providerModelCatalog` lane：种子 stale 缓存触发自动刷新，断言初始排序、收藏重排、选择后最近使用排序、元数据持久化与 fresh 状态；Rust 单测 183 条。

## Sprint 152：Sync 口令安全、多设备配对与密钥轮换

- SQLite 新增 `sync_credentials` / `sync_key_versions` / `sync_paired_devices`：口令明文不入库，只保存 16 字节 salt（hex）、SHA-256 前 8 字节密钥指纹、算法、迭代次数、激活版本与配对记录；注册写 v1，轮换生成新 salt + 新指纹并归档旧版本。
- 新增 Tauri 命令：`sync_passphrase_strength` / `get_sync_key_status` / `list_sync_key_versions` / `register_sync_passphrase` / `confirm_sync_passphrase` / `rotate_sync_passphrase` / `get_sync_pairing_code` / `verify_sync_pairing_code` / `list_sync_paired_devices` / `remove_sync_paired_device`；强度评分 < 40 拒绝注册与轮换，`confirm_sync_passphrase` 只校验指纹并置确认态，不轮换密钥。
- 配对码格式为 `WB-<4位设备前缀>-<salt(base64url)>.<fingerprint>.<version>.<deviceId(base64url)>`；校验方用同一口令 + 远端 salt 推导指纹，一致才写 `sync_paired_devices`。
- `db.ts` 新增同构 API 与 `ai-workbench:sync-keys:v1` localStorage key；`deriveBrowserSyncKey` 改为可导出密钥，使浏览器与 Rust 都能计算同一密钥指纹。
- System Sync card 新增强度条、确认按钮与确认门（未确认时 export / import / push / pull / auto sync 被拦截）、配对码复制 / 粘贴校验、已配对设备列表、Rotate 轮换与版本历史徽标；锚点 `data-sync-strength` / `data-sync-confirm` / `data-sync-pairing-code` / `data-sync-pair-verify` / `data-sync-rotate` / `data-sync-key-status` / `data-sync-key-versions`。
- `verify:ui` / `verify:preview` 新增 `syncPassphraseSecurity` lane（强度、确认、配对码、轮换、重复确认不轮换），`syncE2e` lane 适配确认门后双端全绿；Rust 单测增至 188 条。

## Sprint 153：RAG 命中来源跨文件选择器与“记住选择”偏好

- `RagSearchResult` 新增 `source_kind / source_file / vault_path`（serde camelCase）；Rust 侧文件命中 `source_file` 返回 `knowledge_files.path` 而非 UUID id，`vault_path` 随行返回，与浏览器 fallback 的来源语义一致。
- `search_thoughts` 新增 `source_filter: Option<RagSourceFilter>`：`enabled + selected` 时仅返回 `file_paths` 命中的文件；`all` 或 `selected` 但路径为空时不过滤；thought 命中不受过滤影响。
- 浏览器 `db.ts` 新增 `RagSourcePreference` 与 `ai-workbench:rag-source-preference:v1`；`get/setRagSourcePreference`、`searchThoughts(query, limit, sourcePref?)` 同构实现来源过滤。
- AI Studio 确认面板按来源文件分组勾选（`data-rag-source-option`），勾选 “Remember this source selection”（`data-rag-source-remember`）后写入偏好并显示 `data-rag-source-summary` 徽标；`data-rag-source-reset` 一键清除；New chat / 切换会话 / Cancel 清理临时来源状态。
- `verify:ui` / `verify:preview` 新增 `ragSourceSelector` / `ragSourcePersisted` lane：种子两个 vault 文件、取消一个来源、记住选择、reload 后偏好仍生效且搜索只命中记住的文件、Reset 清除；Rust 单测覆盖 selected / all / 空路径语义，总数增至 189 条。

## Sprint 156：向量分片质心与近似索引（ANN）搜索

- SQLite 为 `embedding_config` 新增 `ann_enabled / probe_count`，为 `vector_shards` 新增 `centroid`；`migrate_vector_index` 幂等补列，`set_embedding_config` 读写新字段并把 `probe_count` 钳制到 `1..=shard_count`。
- `refresh_shard_stats` 聚合 shard 内已索引向量并归一化质心，`status` 支持 `ready / partial / idle`；`get_vector_index_status` 返回 `annEnabled / probeCount / centroidsReady`。
- `search_thoughts` 先收集 `thought_docs / file_docs`，满足 `ann_enabled && 1 < probe_count < shard_count` 时按查询向量与各 shard 质心余弦相似度保留 top probe shard，BM25 IDF 按 term 预计算避免剪枝后统计漂移；关闭 ANN 或 `probe_count == shard_count` 时全量返回。
- `db.ts` 浏览器 fallback 同构：`EmbeddingConfig / VectorShardRecord / VectorIndexStatus` 补齐新字段，`readEmbeddingConfig / setEmbeddingConfig` 读写与 clamp，`seedVectorShards / refreshVectorShardStats` 计算并保存质心，`searchThoughts` 按 shard 质心过滤文件集合。
- KnowledgeView Vector index 卡片新增 `data-vector-ann-enabled` 开关与 `data-vector-probe-count` 输入，shard 卡片带 `data-vector-shard-centroid` 并显示 `centroid ready` 徽标，配置页脚显示 probe 与 ANN 状态。
- `verify:ui` / `verify:preview` 新增 `vectorAnnSearch` lane：重建索引后断言 4 个 shard 质心就绪、ANN 开启时结果只命中 top probe shard、关闭后恢复 4 个 shard；Rust 单测新增质心归一化与 ANN 剪枝用例。

## Sprint 155：会话复制携带版本历史，导出内嵌 RAG / Inspector Trace

- SQLite 新增 `message_aux` 表：`message_id` 主键、`payload` JSON、`updated_at`；新增 Tauri 命令 `save_message_aux` / `list_message_aux`，浏览器 fallback 在 `ai-workbench:db:v1` 的 `messageAux` 数组同构读写。
- `duplicate_session` 按消息 ID 复制全部内容：`chat_messages` 生成新 ID，`message_versions` 保留历史并重映射 `parent_version_id`，`message_aux` 的 RAG / Trace 上下文跟随复制；`delete_session` / `truncate_chat_messages` 同步清理 aux 与版本。
- AI Studio 普通 / MOA / Team 发送完成后把 `{ rag, trace }` 写入用户消息 aux；`buildSessionMarkdown` 新增可选 `auxByMessageId`，导出 Markdown 在用户消息后内嵌 `### RAG context`（来源 + 摘要）与 `### Inspector Trace`（标题 + label/value 区块）。
- 浏览器 `duplicateSession` 同构复制版本血缘与 aux；`deleteSession` / `truncateChatMessages` 按剩余消息 ID 过滤 aux。
- `verify:ui` / `verify:preview` 新增 `sessionAuxContext` lane；Rust 单测覆盖 aux 生命周期、非法 payload、复制版本血缘与 aux，总数增至 201 条。

## Sprint 154：Webhook payload 高级模板与版本管理

- Rust 新增 `webhook_template.rs`：`{{event}} / {{ts}} / {{context.*}} / {{this.*}}` 变量展开，`{{#if}} / {{#else}} / {{/if}}` 条件分支，`{{#each}} / {{/each}}` 循环与 `{{@index}} / {{@first}} / {{@last}}` 元数据；未知变量保留原文，`render_webhook_payload` 改由该模块渲染。
- 新增 `validate_template`，返回 `{ ok, errors, variables, blocks, rendered, renderedJsonOk }`；Tauri 命令 `validate_webhook_payload_template` 接受可选 `contextJson` 并真正解析 JSON。
- SQLite 新增 `webhook_template_versions` 版本表与 `webhook_rules.template_version` 列；`create_webhook_rule` 自动写 v1，`next/save/list/restore_webhook_template_version` 提供版本生命周期管理。
- `db.ts` 提供与 Rust 同构的高级渲染器与 `validateWebhookPayloadTemplate`，版本记录持久化到 `ai-workbench:webhook-template-versions:v1`，`readWebhookRules` 自动补 `templateVersion ?? 1`。
- SystemView payload 编辑区新增模板片段按钮（event / ts / context / if / each）与 Validate schema；每条规则下方新增模板编辑器、保存版本、版本下拉与 Restore，锚点 `data-webhook-template-snippet` / `data-webhook-template-validation` / `data-webhook-rule-payload-input` / `data-webhook-rule-version-save` / `data-webhook-rule-version-count` / `data-webhook-rule-version-select` / `data-webhook-rule-version-restore` / `data-webhook-rule-version-note`。
- `verify:ui` / `verify:preview` 新增 `webhookTemplateVersioning` / `webhookTemplateValidationUi` lane；Rust 单测覆盖条件、循环、未知变量、块收集与版本生命周期，总数增至 199 条。

## Sprint 157：Delivery Orchestrator

- 新增 `src/lib/delivery.ts`：`DeliveryOrchestrator` 作为交付终端单一状态 owner，提供 `snapshot / subscribe` 与可注入 adapter；应用启动时 mount 一次，`ActionsView` / `CliModal` 只消费快照和命令。
- Orchestrator 在 mount 时订阅 `cli_log_line` / `cli_exited`，负责 active run、logs、running、exitCode 与退出后的持久化回流；组件不再直接调用 `recordCliRun`，`ActionsView` 移除 8 秒轮询。
- 验证矩阵与 CLI 生命周期统一写入 `delivery_runs`：点 `v` 创建或更新当前 attempt，自动修复复用同一条记录并推进 `fixRound`，手动 CLI 派发单独生成一条 CLI run。
- 新增 Tauri 命令 `list_delivery_runs` / `record_delivery_run`；浏览器 fallback 使用 `ai-workbench:delivery-runs:v1` 保存同一模型，Rust/browser 差异收在 db adapter。
- 删除 `workbenchStore.qualityGate` / `refreshQualityGate` / `clearQualityGate`；`FILE_UPDATED` 改调 `DeliveryOrchestrator.refreshGate()`。
