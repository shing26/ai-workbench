# AI Workbench — Context

## 当前开发范围（Sprint 101 起）

Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）两块未启动大模块已按用户要求搁置，后续有需要再开发，不纳入当前开发终点。下方模块描述仅作为产品愿景存档。

## 当前视觉基线（2026-08-13）

- 视觉基准为 `preview-redesign.html`（旅程指挥台设计稿），React 视图按组件级结构对齐：Dashboard = `pc-stat-row` + `pc-focus-row` + `pc-system-strip`；Projects = `pc-project-grid` + `pc-bottom-grid`；AI Studio = `pc-studio-grid`（画布 + 抽屉）；Actions = `pc-actions-grid`（DoD 队列 + 验证矩阵）；Knowledge = `pc-kb-toolbar` + `pc-kb-grid` / `pc-graph-view`。
- 设计稿样式以 `pc-` 前缀移植到 `src/index.css`，颜色统一走 Prism Token（`--prism-accent`、`--bg-panel` 等），禁止在 `pc-*` 组件里硬编码色值。
- UI 验证契约：`data-*` / `aria-label` 锚点、`scripts/ui-verify.mjs` 的 5 视图 + modal + motion lane（动效 <=150ms、reduced-motion、横向溢出）必须保持全绿。

## 连接组织层 (Connection Layer)

The workbench's nervous system. A cross-module event-listening and notification-routing layer. It subscribes to state changes from Chat Hub, Automation Workbench, Knowledge Hub, and Vibe Coding, then decides what to surface, in what form, and when. It does not produce content — it routes signal.

### Signal → Rule → Action

Every module emits signals. The Connection Layer applies rules to each signal and produces exactly one action.

**MVP urgency tiers:**
- **urgent** → badge + toast + timeline entry (automation errors, critical completions)
- **quiet** → timeline entry only (daily summaries, save confirmations, progress updates)

### Delivery channels (MVP)
- **Bell dropdown** (TopBar): last ~5 urgent items, one-click scan without leaving current view
- **ConnectionsView**: full timeline with filtering by urgency, module, and search

### Cooling Recall

Periodic scan of active threads for inactivity. If a chat thread has no new messages in 72 hours and isn't archived, the Connection Layer inserts a quiet recall event into the timeline ("You were discussing X 3 days ago — continue?"). Clicking the event jumps back to that thread. No separate project tracker needed — it piggybacks on existing chatStore data.

### Session Breadcrumb

A lightweight "where was I" trail. On app exit, serialize key state (active view, active thread ID, unsent chat draft, Vibe Coding idea + phase) to localStorage. On next launch, insert a quiet timeline event with a clickable link to resume. No AI inference, no server dependency — purely a client-side breadcrumb.


## 创收工作台 (Monetization Workbench)

The downstream landing zone for Vibe Coding output. When a project passes acceptance in Vibe Coding, it becomes a trackable monetization asset. Three pillars: project assetization (cards with status + checklist), monetization templates (landing page, Chrome extension, Telegram bot, paid content), and revenue tracking (manual entry log + monthly/all-time stats). No payment integration, no auto-deploy, no exchange connectivity.

### Monetization Templates (MVP)

Three lightweight checklist templates, each a static set of steps the user checks off manually:

- **Landing Page**: buy domain → deploy to Vercel/Netlify → configure DNS → add analytics
- **Chrome Extension**: bundle crx → submit to Chrome Web Store → write description + screenshots
- **Paid Content**: organize as doc/course → pick platform (Gumroad) → set price → publish

### Revenue Tracking

Manual entry: amount + source label. Summary shows current month and all-time totals. No real-time API integration.

### Vibe Coding Bridge

When a Vibe Coding project passes acceptance, a monetization project card is auto-created with status "pending". User then visits Monetization Workbench to select a template and start tracking revenue.

## Language

**一人公司 (One-Person Enterprise)**:
用户以产品经理身份统管工作台，agent 按部门扮演员工并参与产品从构想到落地的协作形态。
_Avoid_: 副驾驶、助手、聊天机器人

**产品旅程 (Product Journey)**:
一个项目从想法、部门论证、CLI 实现到知识归档的完整可追踪过程；旅程属于项目，不独立存在。
_Avoid_: 任务流、流水线、开发日志

**部门论证 (Department Roundtable)**:
Studio 中多个部门 agent 就同一方案并行发言、互相补充或分歧，最终收敛出 PRD / 设计结论的会议形式。
_Avoid_: 群聊、多模型切换、Agent 聊天

**交付终端 (Delivery Terminal)**:
Actions 视图，负责把已定稿的项目任务派发给本地 CLI 落地，回流执行记录，并在派发后运行四级验证矩阵；支持自动识别安全白名单内的本地 CLI（核心为 Claude Code / Aider / Codex）。
_Avoid_: 待办列表、任务清单

**旅程指挥台 (Journey Console)**:
Header 五段旅程阶段轨（总览 → 构想 → 论证 → 落地 → 归档）的视觉代称，对应 Dashboard / Projects / AI Studio / Actions / Knowledge 五个主视图。
_Avoid_: 面包屑、导航标签

**知识归档 (Journey Archive)**:
项目完成后，将构思、会议结论、设计决策、实现总结写入 Knowledge 的存档动作；归档后项目仍可被重新打开。
_Avoid_: 导出、备份、历史记录

**产品经理 (CPO)**:
用户在工作台中的唯一身份，负责提出产品构想、主持部门论证并做最终决策；CPO 可作为头衔保留。
_Avoid_: CEO、管理员、老板

**部门 (Division)**:
来自 The Agency 目录的专业分类（Product、Design、Engineering、Security、Testing 等），每个 Division 下有多个 Agent，是 Studio 浏览与组队的筛选维度。
_Avoid_: 高管层、部门编制、团队

**The Agency**:
开源 Agent 目录（`github.com/msitarzewski/agency-agents`，MIT），提供 258 个专业 Agent 与 17 个 Division；工作台以它为团队来源，不自行维护组织架构。
_Avoid_: 虚拟员工库、自建 Agent 市场

**员工 Agent (Agency Agent)**:
来自 The Agency 的单个专业 Agent，以 name / description / developer instructions（精简自源 Markdown）导入工作台，拥有独立人格、流程与交付物。
_Avoid_: 高管、虚拟角色、部门员工编制

**旅程文档 (Journey Doc)**:
一次部门论证固化出的结构化 Markdown，存放在项目 `docs/journey/` 下；frontmatter 记录 projectId / journeyStage / 参与 Agent / 更新时间，正文固定为背景与目标、PRD 要点、设计决策、风险与 Trade-off、论证结论、交付任务清单、实现与验证记录七区块；Knowledge 卡片是其索引视图，CLI 派发引用同一文档。
_Avoid_: Spec、会议纪要、知识卡片、自由 Markdown

**两轮论证 (Two-Round Debate)**:
Studio 论证流程：第一轮所有入选 Agency Agent 并行独立发言；第二轮由汇总 LLM 综合全部发言与项目上下文，输出分歧点、共识、风险与结论草案，供 CPO 确认定稿。
_Avoid_: 群聊、自由多轮聊天、一轮拼接

**论证会话 (Roundtable Session)**:
一次两轮论证从派发、各席独立发言、共识草案到 CPO 确认前的完整状态；论证会话拥有在席团队、轮次输出与流状态，视图只呈现会话而不持有其运行时序。
_Avoid_: 圆桌弹窗、聊天记录、后台任务

**团队预设 (Team Preset)**:
预选的 Agency Agent 组合（如“产品评审团”“技术方案团”“全栈落地团”），支持一键入席，也支持用户自由组队并保存为自定义预设。
_Avoid_: 部门编制、固定席位、组织架构

**验证矩阵 (Verification Matrix)**:
交付前按 4 级门禁逐级校验：L1 静态编译与类型（tsc / cargo check / clippy / eslint）→ L2 单元与契约测试（cargo test / vitest）→ L3 CDP 无头浏览器 UI/E2E 验证 → L4 AI DoD 语义对齐与安全审计；任一级失败即阻断。
_Avoid_: 单次质量检查、手动截图、只看 exit code

**自动修复回环 (Auto-Fix Loop)**:
验证失败时，把错误日志组装成下一轮 CLI 修复指令，经 CPO 确认后重派给交付终端，默认最多 2 轮。
_Avoid_: 无限自动循环、只报错不修

**交付记录 (Delivery Record)**:
一次交付尝试沉淀的持久化运行记录，统一收纳 CLI 派发、验证矩阵结果与自动修复轮数；包含项目路径、CLI 命令、exit code、开始/结束时间、最近一次验证结果与自动修复轮数。自动修复复用同一尝试，手动 CLI 派发单独生成一次尝试。
_Avoid_: CLI 历史、终端日志、本地缓存

**Provider 配置 (Provider Profile)**:
一个 Provider 在工作台内的可配置身份，包含名称、baseUrl、API Key、默认模型、显式供应商类型、启用状态、优先级与流式请求超时/重试配置；由 Provider Control 统一管理，Studio 论证与验证矩阵共享当前选中配置。
_Avoid_: 模型下拉、API 设置散落在各视图、临时 provider 变量

**Provider 测试 (Provider Test)**:
对单个 Provider 配置执行健康检查或流式 smoke test，返回延迟、状态与可读错误；测试结果按配置缓存并展示，不阻断应用启动。
_Avoid_: 只显示“已连接”、无错误细节的模拟成功

**供应商类型 (Provider Type)**:
`ollama` / `openai-compatible` / `custom`，用于区分 API 协议与模型发现/流式端点；显式类型是路由唯一依据，让 OpenAI、Ollama 之外的供应商可接入，legacy 数据只在首次迁移时推断，不再被名称或端口覆盖。
_Avoid_: 把供应商协议硬编码成 OpenAI/Ollama 两分支

**Provider Lab**:
Provider Control 内的独立测试入口，对当前选中 Provider 执行连接测试、流式 smoke test 与模型获取，并展示最近一次结果与可复用模型列表。
_Avoid_: 测试能力藏在 provider 卡片里没有独立可操作入口

## 验证矩阵（四级门禁）

交付终端按下 `v` 键后按以下四级顺序执行，任一级失败立即阻断并展示错误日志，不进入下一级：

1. **L1 静态编译与类型门禁**：`cargo check --workspace`、`cargo clippy -- -D warnings`、`tsc --noEmit`、`eslint`，用于确认语法与类型无错误。
2. **L2 单元与契约测试**：`cargo test` 覆盖 SQLite 映射与 Tauri IPC，`vitest` 覆盖前端 Store 与状态流转，用于确认逻辑与接口契约未被改坏。
3. **L3 CDP 无头浏览器 UI/E2E**：复用 `scripts/ui-verify.mjs`，自动启动前端、模拟关键路径、做 DOM 断言与视觉截图，用于发现样式崩塌、文字重叠与关键按钮不可点。
4. **L4 AI DoD 语义对齐与安全审计**：只把 `git diff` 与对应旅程文档/DoD 传给独立 QA/CISO Agent，检查需求是否做对、是否有硬编码密钥与未参数化 SQL。

失败闭环：验证错误日志自动组装为下一轮 CLI 修复 Prompt，经 CPO 确认后重派，默认最多 2 轮。详细决策见 `docs/adr/ADR-006-Four-Level-Verification-Matrix.md`，落地计划见 `docs/plans/one-person-enterprise-refactor.md`。
