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

## Knowledge RAG

- Rust 后台对 `thoughts` 建立本地 BM25 索引：按词项切分、统计 IDF 与文档长度归一化，不依赖外部 Embedding 模型。
- `search_thoughts(query, limit)` 返回相关笔记与 score；`get_rag_index_status` 返回文档数与 indexed 状态。
- 前端 Knowledge 视图提供 RAG 搜索框，结果可点击进入 Markdown 预览；浏览器 fallback 使用关键词命中。

## Vault 跨文件索引

- SQLite 新增 `knowledge_files` 表（path 唯一、title、tags、content、indexed_at），`index_vault(vault_path)` 递归扫描 `.md` 文件并解析 frontmatter，按 path upsert。
- `get_knowledge_index_status` 返回已索引文件数；`search_thoughts` 同时检索 thoughts 与 knowledge_files，文件命中以 `type: doc` 返回。
- Knowledge 视图提供 Vault 路径输入与 Index 按钮，文件数 badge 展示索引状态；AI Studio RAG 注入自动覆盖本地 Markdown 文件。
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

## 数据流

1. 前端通过 Zustand 维护视图状态。
2. 持久化数据通过 IPC 调用 Rust 命令。
3. Rust 负责 SQLite 迁移、示例数据与事务。
4. AI 流式响应通过 Tauri Event 推送到前端。
5. AI Studio 发送前先检索本地 thoughts，把命中内容作为 system 上下文注入请求。

## 环境隔离

- 开发模式：允许 Dev overlay 与调试面板。
- 生产模式：禁止 Dev Issues 浮标与任何开发遮罩。
