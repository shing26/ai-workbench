# Sprint Retrospective

## Sprint 25

### What went well?

- Commit/PR 草稿闭环：Projects 卡片一键生成 Conventional Commit（`type(scope): summary`）、PR Title 与含 DoD 的 PR Body；Rust `generate_commit_pr_draft` 与浏览器 fallback 共用同一套推断规则。
- Git 状态升级：`get_project_git_context` 优先读 `git status --short`，无 git 环境回退最近修改文件，项目图谱与草稿都受益。
- 验证覆盖：`cargo test --lib` 20/20，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增草稿面板、Conventional Commit、Changes 与 DoD 断言，两条 lane 全绿。

### What went wrong?

- Rust `summary_for` 先收集 `&str` 再声明 `Vec<String>`，补 `.map(|t| t.to_string())` 后通过。
- `verify` 正则写在模板字符串里，`\\(` 与 `\\n` 需要按外层转义处理，首轮出现语法错误；改为双反斜杠后通过。
- 草稿断言最初把整块面板文本拿去匹配 commit 前缀，改为按行匹配后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调与 Team 结果汇总、自动文件监听同步、自动执行 commit/PR。
- 后续改动 Git 上下文或 Projects 时，保留草稿与图谱断言。

## Sprint 24

### What went well?

- 部门团队编排闭环：AI Studio 新增 Team 模式，按部门并行派发最多 3 个 Agent，每个气泡带 Agent/Role 标签独立流式输出；Inspector 显示 Team Trace（Department / Agents / Role / Model / Status）。
- Prompt 全链路打通：12+ 种子 Agent 自带职责化 system_prompt，单 Agent 与 Team 派发都注入 system 消息；System Agent directory 行内编辑后立即持久化并展示预览。
- 验证覆盖：`cargo test --lib` 19/19，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Team 并行派发、Team Trace、prompt 编辑与 localStorage 持久化断言，两条 lane 全绿。

### What went wrong?

- 种子 INSERT 使用了跳号的 `?7/?8` 占位符但只传 6 个参数，rusqlite 按最大索引校验报 `InvalidParameterCount(6, 8)`；改为连续 `?5/?6` 后通过。
- `verify` 首轮用祖先容器定位 QA Agent 编辑按钮，实际点到了 UI Designer 的 prompt 编辑器；改为精确 `aria-label` 与最近容器断言后通过。
- 一次重载后 dock 按钮短暂未出现，属时序波动，重跑通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调与 Team 结果汇总、自动生成 Commit/PR 草稿、Prompt 版本管理。
- 后续改动 Agent 派发或 Prompt 时，保留 Team Trace 与 prompt 持久化断言。

## Sprint 23

### What went well?

- 部门/Agent 数据模型闭环：`departments` / `agents` 两张表、5 部门 12+ Agent 种子、Tauri 命令与浏览器 localStorage fallback 同构；AI Studio 按部门分组选择 Agent 并按 Agent 的 provider 派发。
- System Agent directory：可浏览部门与 Agent 列表并创建 Agent；Inspector 增加 Department / Agent / Role / Model 与 RAG 上下文追踪。
- 验证覆盖：`cargo test --lib` 18/18，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Agent 下拉、Agent Trace、Agent directory 断言，两条 lane 全绿。

### What went wrong?

- 首轮 `verify:ui` 的 Inspector 断言用 `Department`，页面 label 因 CSS `text-transform` 渲染为大写 `DEPARTMENT`，改为大小写不敏感后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、多 Agent 并行编排与 system_prompt 编辑器、自动生成 Commit/PR 草稿。
- 后续改动 Agent 派发或 Inspector 时，保留 Trace 与 directory 断言。

## Sprint 22

### What went well?

- UI 深化闭环：设计部 UI Designer 产出 Sprint 22 动效契约，主题/强调色、流体材质卡、AI Studio 对话舞台全部按契约落地，并写入 SDLC 生命周期。
- 动效系统：`data-theme` + `data-accent` 首帧预载、localStorage 持久化、5 个 accent preset；BentoCard 支持 4 种流体材质，hover 单次 140ms flow，尺寸稳定。
- 可测试性：`verify:ui` / `verify:preview` 新增主题持久化、accent 切换、材质卡 hover 固定尺寸、composer/stage 动效与 reduced-motion 断言，两条 lane 全绿。
- `cargo test --lib` 17/17，fmt、clippy、build 全绿。

### What went wrong?

- 首轮 `verify:ui` 在 System 视图上断言 `.conversation-stage`，需要先切回 AI Studio；补 `clickDock("AI Studio")` 后通过。
- 材质卡 hover 动画时长最初在移除 `.hovering` 后测量，读到 `0s`；改为 hover 态内测量后确认 `0.14s`。

### Action Items

- 下一 Sprint 候选：部门与 Agent 数据模型、真实 Provider 端到端流式联调、自动文件监听同步、自动生成 Commit/PR 草稿。
- 后续可把全仓库硬编码 emerald/#007AFF Tailwind class 迁移到 accent token（单独 Sprint）。

## Sprint 21

### What went well?

- 项目级 Git 图谱闭环：`get_project_git_context` 解析 `.git/HEAD` 与 reflog，返回分支、提交数、最新提交；项目卡片新增图谱区展示分支徽章、提交计数与最近文件变更。
- 可测试性：Rust 单测用临时 `.git` 目录验证 HEAD/reflog 解析；浏览器 fallback 提供确定数据，`verify:ui` / `verify:preview` 新增图谱断言并全部通过。
- `cargo test --lib` 17/17，fmt、clippy、build 全绿。

### What went wrong?

- 首轮实现容易在 detached HEAD 或超大 hash 上误伤，补充 `ref: refs/heads/` 前缀解析与 hash 截断处理。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、自动生成 Commit/PR 草稿。
- 后续改动 Git 上下文或 Projects 视图时，保留图谱断言。

## Sprint 20

### What went well?

- 版本图谱闭环：`message_versions` 增加 `parent_version_id`，编辑/恢复保存版本时自动记录父版本；旧库迁移兼容。
- 图谱 UI：版本面板展示 `root → v2 → current` 节点连线，点击节点可直接切换 diff 对比，视觉与现有 Design Token 一致。
- 验证覆盖：Rust 单测覆盖编辑链血缘与恢复路径，`verify:ui` / `verify:preview` 新增图谱节点与 current 标记断言，`cargo test --lib` 16/16，fmt、clippy、build 全绿。

### What went wrong?

- 血缘单测首轮预期恢复会新增 4 个版本，实际恢复为相同内容时不产生新版本，按 3 个版本修正断言。
- `save_message_version` 新增父版本参数后，Tauri 命令调用点漏传参数导致编译失败，补 `None` 后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、项目级 Git 图谱。
- 后续改动版本表或图谱时，保留血缘与 diff 断言。

## Sprint 19

### What went well?

- 剪贴板/日志跨设备同步闭环：`clipboard_history` / `error_logs` 增加 `updated_at`，`export_sync_snapshot` / `import_sync_snapshot` 按时间戳合并，冲突保留较新版本。
- 双设备合并验证：Rust 单测覆盖 A 导出、B 导入并校验双方数据；浏览器 fallback 用同一快照 key 模拟远端设备，`verify:ui` / `verify:preview` 新增合并断言并通过。
- System 新增 Sync snapshot 卡片：设备标识、导出/导入按钮、合并统计与远端来源展示，设计 Token 一致。

### What went wrong?

- 首轮 Rust 编译报 `Deserialize` 缺失与 `?` 错误类型不匹配；为 `ClipboardItem` / `ErrorLog` 补 derive，同步函数改为返回 `String` 错误后通过。
- `verify` 首版误以为远端 deviceId 会显示在页面上，实际 UI 只显示本地设备；改为断言远端数据已合并进卡片与日志列表。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、多版本图谱与分支可视化。
- 后续改动同步逻辑时，保留双设备合并断言与 `updated_at` 冲突语义。

## Sprint 18

### What went well?

- 版本差异对比闭环：`MessageDiff { added[], removed[] }` + Rust `diff_message_version_with_current`，版本面板 Compare 按钮展开 `vN → current` 增删行，红绿语义清晰。
- 浏览器 fallback 与 Tauri 行为一致：TS LCS 逐行 diff 与 Rust `similar` 对齐，前端不依赖后端也能验证。
- 验证覆盖：`verify:ui` / `verify:preview` 新增“编辑→对比 v1 与当前→恢复→再编辑→重新生成”完整断言，`cargo test --lib` 14/14，fmt、clippy、build 全绿。

### What went wrong?

- 第一版 diff 接口错误地比较两个版本 ID，但当前内容并不是版本；改为 `版本 vs 当前消息内容` 后语义正确。
- 单测首次因版本顺序理解偏差失败：`update_chat_message` 会先保存旧内容再更新，断言需按实际版本列表顺序对齐。
- verify 脚本一次正则 `/+1\s+-1/` 写错导致 Uncaught，改成文本包含判断后稳定通过。

### Action Items

- 下一 Sprint 候选：剪贴板/日志跨设备同步、真实 Provider 端到端流式联调、多版本图谱与分支可视化。
- 后续改动版本面板或编辑链路时，保留 diff 与恢复断言。

## Sprint 17

### What went well?

- 消息版本历史闭环：`message_versions` 表 + `save/list/restore` 三个 Tauri 命令，编辑与 regenerate 自动保留旧版本，Restore 可一键回到旧文本并保留分叉版本。
- 前端版本面板：History 按钮展开版本列表，恢复后刷新版本视图；浏览器 fallback 与 Tauri 行为一致，清库时级联清理孤儿版本。
- 验证覆盖：`verify:ui` / `verify:preview` 新增“编辑→查历史→恢复→再编辑→重新生成”完整断言，`cargo test --lib` 13/13，fmt、clippy、build 全绿。

### What went wrong?

- `verify:ui` 首轮失败：版本面板恢复后仍显示旧版本，用 `document.body.innerText` 断言“旧文本消失”会误判；改为只断言消息气泡内容，面板内容单独校验。
- TS 首轮构建报 `message.id` 可能为 undefined，补充空值兜底后通过。

### Action Items

- 下一 Sprint 候选：版本差异对比视图、真实 Provider 端到端流式联调、剪贴板/日志跨设备同步。
- 后续改动消息编辑或版本面板时，保留版本历史与恢复断言。

## Sprint 16

### What went well?

- Rust 新增 `ProviderHeartbeat` 状态：记录最近结果与连续失败次数，失败 >=2 次进入 alert，恢复后清空；单测覆盖告警与恢复。
- `run_provider_heartbeat` 返回快照并 emit `provider-heartbeat`，setup 启动 10s 周期后台检查；`ProviderHeartbeatSnapshot` 含 checkedAt。
- System Provider 卡片展示 heartbeat 状态/延迟/alert 标记，顶部告警条列出告警 Provider；浏览器 fallback 可模拟健康与告警快照。
- `verify:ui` / `verify:preview` 新增心跳告警断言并通过；`cargo test --lib` 12/12、clippy、fmt、build 全绿。

### What went wrong?

- `ProviderHeartbeatSnapshot` 首次编译缺 Clone，`app.emit` 要求 Serialize + Clone，补 derive 后通过。
- `cargo fmt --check` 首轮报多处换行差异，运行 `cargo fmt` 后通过。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、消息分叉/版本历史、剪贴板/日志跨设备同步。
- 后续改动 Provider 心跳周期、告警阈值或 System 视图时，保留心跳告警断言。
- 告警后续可扩展为全局通知与自动禁用失败 Provider。

## Sprint 15

### What went well?

- Rust 流式链路加固：`stream_client()` 统一 connect timeout 8s + total timeout 30s；openai/ollama 改为 `BufReader.read_line` 增量读取，取消后立即停止读取。
- 错误短映射：超时/连接失败/HTTP 状态码映射为简短错误，不再把完整 body/密钥抛给 UI；Ollama 缺失 `done:true` 会明确报错；单测覆盖映射与截断。
- 前端新增 connecting/streaming/error/stopped 状态条与 Retry 按钮；浏览器 fallback 可模拟超时失败，`verify:ui` / `verify:preview` 新增错误映射断言并通过。
- `cargo test --lib` 11/11、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次补丁试图用控制台乱码文本匹配 UTF-8 中文，patch 匹配失败；改用真实中文字符后通过。
- `reqwest::blocking::Response` 的 `lines()` 不可用，仍需手写 `read_line` 循环；取消语义需在循环后再次检查，避免把取消误报为“缺少 [DONE]”。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、Provider 周期心跳与状态告警、消息分叉/版本历史。
- 后续改动流式协议、Provider 路由或 AI Studio 交互时，保留 `verify:ui` 的流式错误映射断言。
- 若需要真正中断网络读取，可评估 `reqwest` 非阻塞流或 `tauri-plugin-http`。

## Sprint 14

### What went well?

- Rust 新增 `update_chat_message` / `truncate_chat_messages`，单测覆盖编辑内容与截断后续消息；`save_chat_message` 支持外部传入 id，前端发送时同步生成消息 id 落库。
- user 消息 hover 提供 Edit（内联 textarea）与 Regenerate；重新生成截断旧回复后按当前模式重新流式输出并落库。
- `verify:ui` 新增编辑 + 重新生成断言：编辑内容替换、旧文本消失、重新生成后新回复完整出现。
- `cargo test --lib` 10/10、`cargo clippy --lib -D warnings`、`cargo fmt`、`npm run build`、`verify:ui` 全绿。

### What went wrong?

- 重构发送链路后 run index 与占位符位置不一致，导致流更新落到 user 消息上；修正为按实际 history 计算索引。
- 重新生成时 `setMessages` 与流更新存在批次竞态，先注册 run 再更新消息状态后稳定。
- 首轮验证在流未结束时点 Edit 被 busy 拦截，等待流空闲后再编辑。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、Provider 周期心跳与状态告警、消息分叉/版本历史。
- 编辑功能后续可支持 assistant 消息编辑与多轮分支对比。
- 保留编辑/重新生成断言，改动消息流、chat_messages 或 AI Studio 交互时重跑 `verify:ui` / `verify:preview`。

## Sprint 13

### What went well?

- AI Studio 新增 Auto 路由模式：发送前并行健康检查所有启用节点，过滤失败节点后选择首个健康 Provider，顶部徽标与 Inspector 展示实际路由与回退来源。
- 无可用 Provider 时返回清晰错误消息，不再静默失败；浏览器 fallback 复用模拟健康检查，UI 验证可稳定断言禁用 OpenAI 后自动回退到 Ollama。
- `npm run build`、`verify:ui`、`verify:preview` 全绿，`verify:ui` 新增 Auto 路由断言（徽标 + Router 轨迹）。

### What went wrong?

- Inspector 把 section label 渲染为大写（`ROUTER`），首轮断言按小写匹配失败，改为匹配实际渲染文本。
- Auto 路由断言首轮用旧 Inspector 文本（残留 MOA Trace）判断，未等待新路由内容出现；改为等待 `auto → Ollama` 后再断言。

### Action Items

- 下个 Sprint 候选：消息编辑/重新生成、真实 Provider 端到端流式联调、Provider 周期心跳与状态告警。
- 路由策略后续可扩展为按延迟加权、会话级固定 Provider 或失败自动重试一次。
- 保留 Auto 路由断言，改动路由逻辑、Provider 健康检查或 AI Studio 模式切换时重跑 `verify:ui` / `verify:preview`。

## Sprint 12

### What went well?

- Rust 新增 `rename_session` / `delete_session`，`chat_messages` 外键级联删除生效，单测覆盖重命名与删除后消息清空。
- 会话栏新增搜索框、hover 重命名/删除与二次确认；删除当前会话后自动切换到下一个会话。
- 修复空会话被自动复用的问题：发送新消息时若当前会话无历史，新建会话并以首条消息命名，会话标题与内容保持一致。
- `cargo test --lib` 9/9、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿，`verify:ui` 新增会话管理断言。

### What went wrong?

- 会话管理断言首轮误用 body 全文判断旧标题，聊天内容仍包含旧文本导致误报，改为只检查会话列表按钮。
- `verify:preview` 在未重新 build 时用旧 dist 验证失败，先 `npm run build` 再验证即通过。

### Action Items

- 下个 Sprint 候选：Provider 自动路由、消息编辑/重新生成、真实 Provider 端到端流式联调。
- 会话搜索后续可升级为模糊拼音/全文匹配，并支持按时间范围过滤。
- 保留会话管理断言，改动会话栏、sessions 或 chat_messages 时重跑 `verify:ui` / `verify:preview`。

## Sprint 11

### What went well?

- SQLite 新增 `chat_messages` 表，Rust `save_chat_message` / `list_chat_messages` 带单测；AI Studio 左侧新增会话栏，New chat、会话切换、历史恢复与刷新后自动恢复首个会话全部落地。
- 发送时保存 user 消息，流式结束或取消后保存 assistant 消息；取消时立即落库 `[stopped]`，浏览器 fallback 用 localStorage 保持同等行为。
- 重构流式监听为按 runId 维护独立内容与消息索引，修复多条 chunk 串入错误消息、取消内容丢失的问题；`verify:ui` / `verify:preview` 新增会话持久化断言并通过。
- `cargo test --lib` 8/8、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 会话栏 `<aside>` 与 Inspector `<aside>` 同标签，导致首轮验证脚本误取文本，改为按 `drawer-panel` 类定位。
- 原流式监听在非 done chunk 时把普通 assistant 消息误当占位符，UI 出现逐 chunk 分裂消息且停止时内容为空；按 run 重构后稳定。

### Action Items

- 下个 Sprint 候选：会话重命名/删除/搜索、Provider 自动路由、真实 Provider 端到端流式联调。
- 会话历史建议增加分页或虚拟列表，避免超长会话渲染压力。
- 保留会话持久化断言，改动 AI Studio、chat_messages 或流式协议时重跑 `verify:ui` / `verify:preview`。

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
