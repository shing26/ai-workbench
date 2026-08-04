# Sprint Retrospective

## Sprint 1

### What went well?

- 范围冻结后 Dock 收拢为 5 个主视图，App Shell、Bento 卡片与五视图切换一次成型。
- SQLite 5 张核心表、Rust CRUD、MOA 并发通道与 Git 上下文命令全部落地，`cargo test --lib`、`cargo clippy -D warnings`、`cargo fmt --check` 全绿。
- `npm run verify:ui` 自动化覆盖 5 视图切换、Design Token 采样、刷新持久化与开发遮罩检查。

### What went wrong?

- `tauri.conf.json` 与 `Cargo.toml` 带 UTF-8 BOM，导致 Tauri build script 解析配置失败。
- zerocopy build script 找不到 `rustc`，需要显式设置 `RUSTC` 才能编译。
- `send_ai_message` 曾把 SQLite MutexGuard 带过 `await`，触发 future 非 `Send`，已改为作用域内取数后再并发。

### Action Items

- 下个 Sprint 接入 ESLint/Prettier 与 husky/lint-staged，补齐前端 lint 门禁。
- 新增 Tauri 异步命令时，禁止 MutexGuard 跨 `await`，统一使用作用域锁或 `spawn_blocking`。
- 保留 `npm run verify:ui` 作为回归基线，每次改动 App Shell 或视图后重跑。

## Sprint 2

### What went well?

- 设计部 4 类角色并行产出设计约束、动效规范、DoD 与视觉叙事，UI 改造正式进入 SDLC。
- 参考模板提炼为 150ms 轻量动效：环境光、Glass Surface、卡片 hover、Inspector 浮层、MOA Stack、Tilt Card、Focus Progress、Health Pulse。
- `verify:ui` / `verify:preview` 新增动效时长、固定尺寸、reduced-motion、布局稳定与移动端溢出断言，全部通过。

### What went wrong?

- Visual Storyteller 首次只返回中间状态，补派后拿到完整叙事。
- Inspector 原宽度动画会回流，按 DoD 改为固定 240px + `translateX` 浮层。

### Action Items

- 后续 UI 动效必须先产出设计评审文档，再进入 Sprint。
- 动效断言保留在 `npm run verify:ui` / `verify:preview`，每次改样式后重跑。

## Sprint 3

### What went well?

- SQLite 扩展为 8 张表：新增 `habits`、`habit_logs`、`schedule_events`，并按表独立 seed，旧库升级不丢数据。
- Rust 新增 6 个习惯/日程命令，单测覆盖跨重开持久化：打卡写入、取消打卡、日程完成状态均验证通过。
- Actions 视图完成四区块：Today Focus、Habits、Fast list、Schedule Timeline；知识视图用 react-markdown 渲染标题/代码块/列表。
- UI 动态效果延续模板语言：习惯打卡 check-pop、日程卡片 pointer tilt、进度条 scaleX，`verify:ui` 新增习惯持久化、Markdown 渲染与区块重叠断言。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `verify:ui` 首次断言 Markdown 预览失败：默认选中第一条普通 thought，改为点击 Markdown 笔记后再断言。
- 习惯打卡断言误用 `closest("section")`，实际打卡行是 `div`，改为检查按钮父行类名。
- 老库 seed 逻辑只判断 `projects` 是否为空，新增表可能不写示例数据，已拆分为独立 seed 函数。

### Action Items

- 下个 Sprint 优先做 AI Studio 真流式输出或 System 剪贴板/日志真实采集。
- 新增表时必须同时评估 seed 兼容旧库，并在 DoD 中显式列出迁移场景。
- 保留 Actions/Knowledge 断言，后续改动这两视图时重跑 `verify:ui`。

## Sprint 4

### What went well?

- System 视图从示例数据升级为真实采集：SQLite 新增 `clipboard_history`、`error_logs`，Rust 后台剪贴板监听线程每 1.5 秒轮询并去重入库。
- 前端全局监听 `error` / `unhandledrejection`，通过 `report_frontend_error` 写入日志；System 视图每 3 秒刷新并响应 `clipboard-updated` 事件。
- `verify:ui` 新增 System 真实数据断言，并用轮询等待消除视图切换竞态，连续两遍稳定通过。
- `cargo test --lib` 3/3、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次接入 `try_state` 误用 `let Ok` 匹配 `Option`，编译失败，改为 `let Some`。
- System 断言首跑因视图渲染竞态失败，改为点击后轮询等待 `Clipboard history` 标题出现。
- 前端错误上报若自身失败会形成递归，补 try/catch 后直接返回。

### Action Items

- 下个 Sprint 优先做 AI Studio 真流式输出，接 Tauri Event 逐块推送。
- 剪贴板轮询间隔与去重窗口写入 `docs/ARCHITECTURE.md`，后续如需 OS 原生监听再评估 `tauri-plugin-clipboard-manager`。
- 系统采集相关断言保留在 `verify:ui`，改动 System 视图或 App 全局错误钩子后重跑。

## Sprint 5

### What went well?

- AI Studio 升级为真流式输出：Rust 后台解析 OpenAI `data:` SSE 与 Ollama NDJSON，通过 `stream-chunk` 事件逐块推送，MOA 按序聚合为单流。
- 前端监听事件后 assistant 消息增量追加，busy 状态驱动打字机光标与 thinking dots，结束后恢复输入。
- 浏览器 fallback 用 60ms 分块模拟流，`verify:ui` / `verify:preview` 可稳定验证流式路径：进行中光标、最终回复、busy 结束。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `reqwest::blocking::Response` 没有 `.lines()`，改用 `.text()` 后按行解析。
- `AppHandle` 被 move 进 `spawn_blocking` 后无法再 emit，改为克隆后引用。
- clippy 捕获 `&line` 多余借用；流式验证首轮未捕获进行中光标，改为 30ms 轮询后稳定。

### Action Items

- 下个 Sprint 候选：Knowledge RAG 向量索引，或 Provider 流式取消/中断。
- 真实 Provider 流式仍需配置 API Key 后做端到端联调；当前验证覆盖协议与 UI 渲染路径。
- 保留流式断言，后续改动 AI Studio 或流式协议时重跑 `verify:ui`。

## Sprint 6

### What went well?

- Knowledge 视图接入真实本地 RAG：Rust 实现 BM25 检索，`search_thoughts` 按 IDF 与文档长度归一化打分，`get_rag_index_status` 返回文档数与索引状态。
- 前端搜索框、命中列表、score 展示与索引 badge 全部落地，点击结果可进入 Markdown 预览。
- 浏览器 fallback 用关键词命中保证 UI 验证可运行，`verify:ui` 新增 RAG 断言并通过。
- `cargo test --lib` 4/4、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `RagSearchResult` 最初缺少 `type` 字段，预览类型报错，补齐后与 `Thought` 共用渲染路径。
- BM25 分母缺少括号导致公式不标准，修正后重跑单测。
- `visibleThoughts` 声明位置在 selected 计算之后，一度引用过早，调整顺序后通过 tsc。

### Action Items

- 下个 Sprint 候选：把 RAG 结果注入 AI Studio 上下文，形成检索增强对话。
- 如需跨文件/Obsidian 检索，再评估文件扫描与增量索引。
- 保留 RAG 断言，改动 Knowledge 或检索命令时重跑 `verify:ui`。
