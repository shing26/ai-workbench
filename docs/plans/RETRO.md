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

## Sprint 7

### What went well?

- AI Studio 发送前自动检索本地 thoughts：命中时在 API messages 前注入 `system` 上下文，回复可直接引用个人知识库。
- 模型切换条旁新增 RAG 开关（默认开启），消息区显示 `RAG +N` badge 与来源摘要，Inspector 展示 RAG context 与 Source 列表。
- 注入为纯前端实现，复用 `search_thoughts` 命令，无新增 Rust 命令；`verify:ui` 新增 RAG 注入断言并稳定通过。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首轮 RAG 注入断言依赖 Inspector 打开时机，改为轮询 badge 与 Inspector 文本后稳定。
- AI Studio 发送前检索是串行 await，检索极快，但后续可评估与 Provider 请求并行。

### Action Items

- 下个 Sprint 候选：跨文件 / Obsidian Vault 索引、Provider 流式取消，或真实 Provider 端到端流式联调。
- RAG 注入默认开启，后续可加“命中结果人工确认后再发送”选项。
- 保留 RAG 注入断言，改动 AI Studio 或检索命令时重跑 `verify:ui`。

## Sprint 8

### What went well?

- Rust 新增 `StreamCancellation` 状态与 `cancel_ai_stream(run_id)` 命令，流式函数逐块检查取消标记，`stream-chunk` 的 done 事件新增 `cancelled` 字段。
- AI Studio busy 时输入区切换为 Stop 按钮，点击后立即标记消息 `[stopped]` 并忽略旧 run 后续块；浏览器 fallback 用本地取消集合中断分块模拟流。
- 顺带修复了流式消息 `__stream__` 占位前缀残留的显示问题：正常完成、出错与取消都会清理前缀。
- `cargo test --lib` 5/5（新增取消生命周期单测）、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首轮取消断言只检查 body 文本，可能被其他 UI 文本干扰，改为定位 `[stopped]` 消息并比较前后文本稳定性。
- Rust 当前是整段读取响应 body 后逐块 emit，取消只能停止渲染，不能真正中断网络读取；已写入范围外。

### Action Items

- 下个 Sprint 候选：跨文件 / Obsidian Vault 索引，或真实 Provider 端到端流式联调。
- 若需要真取消网络请求，评估 `reqwest` 流式读取或 `tauri-plugin-http`。
- 保留流式与取消断言，改动 AI Studio、流式协议或取消命令时重跑 `verify:ui`。

## Sprint 9

### What went well?

- SQLite 新增 `knowledge_files` 表，Rust `index_vault` 递归扫描 `.md`、解析 frontmatter 并按 path upsert，`search_thoughts` 同时覆盖 thoughts 与本地文件。
- Knowledge 视图新增 Vault Index 卡片：路径输入、Index 按钮与文件数 badge；RAG 文档数汇总包含文件，AI Studio RAG 注入自动引用本地 Markdown。
- 浏览器 fallback 用 localStorage 模拟 Vault 文件，`verify:ui` 新增文件数 badge 与文件命中断言并通过。
- `cargo test --lib` 6/6（新增 Vault 扫描/检索单测）、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次 `cargo fmt --check` 报多处换行格式差异，运行 `cargo fmt` 后通过。
- 当前 Vault 索引为全量扫描 upsert，尚无文件监听与增量更新。

### Action Items

- 下个 Sprint 候选：文件监听与增量索引、Provider 健康度监控，或真实 Provider 端到端流式联调。
- 若索引文件夹很大，需要加忽略目录与并行扫描。
- 保留 Vault 断言，改动索引命令或 Knowledge 视图时重跑 `verify:ui`。

## Sprint 10

### What went well?

- Rust 新增 `check_provider_health(provider_id)`：Ollama 探测 `/api/tags`，OpenAI 兼容节点带 Bearer 探测 `/models`，返回 `{ ok, latencyMs, message }`。
- `is_ollama_provider(name, url)` 收敛 Ollama 判定并复用到健康检查、单次对话与流式路由，新增单测。
- System Provider 卡片从占位 `Latency - ms` 升级为健康点、ok/unreachable、延迟与 Check 按钮；进入视图自动检查，支持 Check all。
- `cargo test --lib` 7/7、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- SystemView 初次补健康检查逻辑时漏引 `db` 模块，tsc 报 3 处错误，补导入后通过。
- 健康检查对真实 Provider 是网络探测，单测只覆盖 Ollama 判定；端到端仍需配置 API Key。

### Action Items

- 下个 Sprint 候选：文件监听与增量索引、Provider 自动路由，或真实 Provider 端到端流式联调。
- 健康检查可扩展为周期心跳与状态告警。
- 保留健康断言，改动 System 视图或健康命令时重跑 `verify:ui`。
