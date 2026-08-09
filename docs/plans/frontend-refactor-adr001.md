# 前端改造规划：状态驱动的本地 Agent 编排器

日期：2026-08-07
状态：Agreed（经 design tree 访谈 Q1–Q16，共同理解已达成；**未获确认前不实施**）
关联：`docs/adr/ADR-001-Local-MoA-Orchestrator.md`
方法论：`/grilling`（grill-me）一次一问、fact 查源码、decision 归用户

## 决策矩阵（Q1–Q16 共识）

| # | 分支 | 决策 |
|---|---|---|
| Q1 | 视图状态保留 | **全视图保活**（hidden 切换）+ 监听上移 store + 后台节流 |
| Q2 | 视觉层级 IA | **三层层级系统**（Stage / Rail / Fold）；SystemView Stage = **Agent Live Event Stream**（非静态仪表盘）；Projects 平铺特例 |
| Q3 | 事件契约 | **内存 Ring Buffer（N=500）+ 分层落库**（FSM/HITL/webhook→event_logs；provider 明细→run_metrics；瞬态 ping→不落库）；新增 `fsm://node/updated` 事件 |
| Q4 | 后台节流 | **三档节流**（活跃原间隔 / 非活跃降频 / document.hidden 暂停）+ `useActiveThrottle` hook |
| Q5 | 保活机制 | **Lazy Mount + Keep Alive**：首访才挂载，挂载后保活；启动只挂初始视图 |
| Q6 | 事件订阅 | **`stores/events.ts` 单一订阅 + `useEvent(topic, handler)` 分发**；流式按 runId 路由 |
| Q7 | LUI 入口 | **CommandRegistry + `commandUsage` 排序**（weight+usage）；实体/动作可执行；Ctrl+K 唯一入口 |
| Q8 | 权限错误协议 | **`WorkbenchError` 结构化错误（REQUIRES_CONFIRMATION/PERMISSION_DENIED/GENERIC）+ `usePermissionGuard`**；Rust 兜底裁决 |
| Q9 | SystemView 拆分 | **按层级拆 6 组件**（SystemStage / SystemRail / SystemFold / TokenRail / HealthRail + 骨架）；~100 useState 摊入子组件 |
| Q10 | Projects IA | **grid 模式（`tier=grid`）+ ProjectDetailView**（详情内部恢复三层）；点卡进入 |
| Q11 | Carousel 去留 | **双形态共存**：grid 默认 + carousel 可选；carousel 关自动轮播默认、保留 drag reorder/material memory |
| Q12 | viewState 粒度 | **只上移 4 类高投入态**（草稿/当前选中/列表/折叠/RAG 上下文）+ `useViewState(viewId,key)`；瞬态留组件本地；viewState 仅内存 |
| Q13 | Web Locks | **`withDbLock` 注入内部写函数**（~10 个 write*Local），不锁读；命令层零改动；Rust 端不需要 |
| Q14 | Mock 开关 | **只 Mock 外部 I/O 5 类**（streamProviderLive/webhook/health/model discovery/Codex），不 Mock 存储；`MOCK_ALL_AGENTS` env + localStorage 双通道，默认关，开启显示 Mock 徽标 |
| Q15 | 配置抽屉 | **新建 `SystemDrawer`（宽 420px、tab 分区、可交互）**；AppInspector 保持只读原职 |
| Q16 | FSM 交付 | **前端契约先行 + Mock 驱动**：`lib/fsm.ts` 定类型契约，MOCK_ALL_AGENTS 注入模拟事件开发，后端就绪后事件源无感切换；verify 双级 |

## 核心原则（访谈确立）

1. **先修地基再建新楼**：Sprint 0 P0 修复是 ADR-001 落地前置（ADR「前置条件」）。
2. **状态分层**：持久数据 → store；交互瞬态 → `viewState[view]`；编排运行时 → `events.ts` + `fsmStore`。
3. **双端同构**：浏览器 fallback 与 Rust 同语义（Web Locks / MOCK_ALL_AGENTS / 结构化错误 / fsm 事件）。
4. **LUI 为纲**：一切入口最终可被命令面板触达，验收 = 80% 日常操作 3 次按键内。
5. **确认门在 Rust，前端只渲染拦截结果**：`usePermissionGuard` 仅 UX 预检，不承担安全责任。
6. **焦点是「时序」不是「快照」**：Solo Creator 的 Agent 系统是时序系统；Stage 展示因果链而非平均值。

## 1. 现状诊断（已核实源码）

| 问题 | 代码证据 | 对应 ADR |
|---|---|---|
| 切视图丢全部交互状态 | `ViewRouter.tsx:22` `key={activeView}` 强制重挂载 | §6 流式瞬态应存进程内 store |
| CommandPalette 是死代码 | `CommandPalette.tsx` 仅引用已死 `appStore`，零挂载 | §3 LUI 优先 |
| 两个 Ctrl+K 处理器冲突隐患 | `AppHeader.tsx:34` 与死代码 TopBar 各一个 | §3 |
| sessions store 永久过期 | `workbenchStore.ts:96-109` init 后不刷新；AIStudio 本地 `setSessions` 绕过 store | §5/§11 |
| SystemView 巨型组件 | 4721 行 / ~100 useState / 6 全宽+3 半宽卡 | §11 可观测性基线 |
| 无 FSM 可视化 | 无 run/fsm 状态 UI | §6 fsm_nodes |
| 无 trace 贯通 | `db.ts` / `db.rs` 无 trace_id 字段 | §11 ULID trace |
| 无 Web Locks | 无 `navigator.locks` 痕迹 | §12/ADR Q12 单写者 |
| 确认仅 UI 层 | 删除/保存直接 IPC，无前置 Guard | §9 确认门下沉 Rust |
| Token budget 无上下文 | `SystemView.tsx:4426` 仅全局总量 | §7 tokenBudget 门控 |

## 2. 改造原则

1. **先修地基再建新楼**：Sprint 0 P0 修复是 ADR-001 落地前置（ADR「前置条件」），前端改造不得建在有缺陷的任务/草稿地基上。
2. **状态分层，不再堆 useState**：持久数据 → store；交互瞬态 → `viewState[view]`；编排运行时 → `fsmStore`。
3. **双端同构**：浏览器 fallback 与 Rust 保持同一语义（Web Locks fallback、MOCK_ALL_AGENTS、permission 错误码）。
4. **LUI 为纲**：一切入口最终可被命令面板触达，验收 = 80% 日常操作 3 次按键内完成。
5. **确认门在 Rust，前端只渲染拦截结果**：前端不做安全决策，只做 UX 呈现。

## 3. 分层改造规划

### 3.1 架构层（对应 ADR §2/§3/§6）

**T1｜ViewRouter 保活改造**
- 现状：`key={activeView}` 卸载旧视图。
- 方案：主工作视图（AI Studio / Knowledge）保留挂载 + `hidden` 切换，避免流式与草稿丢失；System/Actions 等轻状态视图可继续重挂载。
- 兜底：交互状态（草稿/选中/筛选）同步上移 `viewState[view]` store，双保险。
- 文件：`ViewRouter.tsx`、新增 `stores/viewState.ts`。

**T2｜CommandPalette 重写（万能入口）**
- 删除死代码 `CommandPalette.tsx`，新建 `components/CommandPalette/`：
  - `CommandRegistry`：视图注册命令/实体/动作的统一表。
  - 数据源：sessions / thoughts / tasks / projects / providers + 动作（发消息、记闪念、健康检查、跳视图）。
  - 模糊匹配 + 最近使用排序（复用 `searchHistory.ts` 的统计能力）。
  - `AppHeader` 的 Search 改为挂载此组件，收敛双 Ctrl+K。
- 文件：新增 `components/CommandPalette/index.tsx`、`components/CommandPalette/registry.ts`、`lib/commandSearch.ts`。

**T3｜workbenchStore 重构**
- 修复 `sessions` 永不过期：所有会话写操作（rename/delete/archive/pin/duplicate）统一走 store action 并刷新。
- 新增 `viewState` slice：`viewState[activeView] = { drafts, selection, filters, formState }`，视图内交互状态上移。
- 文件：`stores/workbenchStore.ts`、新增 `stores/viewState.ts`。

**T4｜新增 fsmStore 与 run_metrics 展示**
- `fsmStore`：订阅 `fsm_nodes`（pending/running/paused/blocked-on-human/complete/aborted），驱动可视化。
- Token budget 按 `run_id → node_id → provider` 分层展示（替代全局总量）。
- 文件：新增 `stores/fsmStore.ts`、`components/orchestration/FSMPipeline.tsx`。

### 3.2 组件层（对应 ADR §9/§11）

**T5｜SystemView 卡片化拆分**
- 4721 行 → 拆 9 个卡片组件：`ProviderCard` / `SyncCard` / `WebhookCard` / `EventBusCard` / `AgentDirectoryCard` / `BudgetCard` / `ClipboardCard` / `ErrorLogCard` + `SyncAuditCard`。
- 每卡 useState 收归自身；SystemView 只做编排 + 卡片间的共享刷新。
- 文件：新增 `components/system/*.tsx`（9 个），`views/SystemView.tsx` 瘦身。

**T6｜全局反馈与权限 UI**
- Toast/Snackbar 系统：统一保存/失败/拦截反馈，替代散落的内联 `data-*-result`。
- `PermissionGuard` 组件：Rust 返回 `RequiresConfirmation` 时渲染确认弹窗；`PermissionDenied` 渲染拒绝提示（文案人性化）。
- 文件：新增 `components/ui/Toast.tsx`、`components/ui/PermissionDialog.tsx`、`lib/toast.ts`。

**T7｜Trace 贯通 UI**
- ErrorLogCard 增加按 `trace_id` 过滤；异常消息按错误码映射用户可读文案（如 `Cannot redefine property: ethereum` → 「插件冲突，请重启应用」）。
- 文件：`components/system/ErrorLogCard.tsx`、`lib/errorCopy.ts`。

### 3.3 基础设施层（对应 ADR §10/§11/§12）

**T8｜Web Locks 单写者封装**
- `db.ts` 新增 `withDbLock(fn)`：`navigator.locks.request('db-writer', …)`，不支持时 fallback 时间戳版本号 + last-write-wins 冲突检测。
- 多标签页互踩的读端加版本校验。

**T9｜MOCK_ALL_AGENTS 开关**
- `db.ts` 顶层读取 `MOCK_ALL_AGENTS`（env / localStorage 配置）：LLM 返回 fixture、Codex CLI 返回 mock 结果、Webhook 只写日志不发请求。

**T10｜permission 错误码对接**
- Rust 层新增 `RequiresConfirmation` / `PermissionDenied` 错误码（ADR §9）；`db.ts` 封装 `assertAllowed(action, subject)` 供前端在发起前预检（UX 层提前置灰/提示），但**最终裁决在 Rust**。

## 4. 实施阶段

> 阶段排期已确认：Sprint 0（P0 还债）独立先行，Q 系列改造并入 Sprint 1–3。

### Sprint 0（还债，ADR 前置，纯修复）——✅ 已锁定 2026-08-07

| # | 任务 | 双端同构 | 验收 |
|---|---|---|---|
| P0-1 | Task 删除 / 改名（`delete_task` / `update_task_title`） | Rust + browser | reload 持久化、取消不删 |
| P0-2 | 草稿 / 交互状态持久化（视图切换不丢） | 前端 | 切视图草稿保留（配合 Q1/Q5/Q12） |
| P0-3 | MOA 浏览器模式死锁修复（fallback 按子 runId 发 chunk） | Rust + browser | 无 Provider 时正常结束 + 落库 |
| P0-4 | 无确认批量操作补 HITL（clear_sync_audit / prune_webhook / archiveWeekDone） | Rust + browser | 均有二次确认/审批流 |
| P0-5 | 破坏性操作确认下沉 Rust Tauri 命令层 | Rust 先行 | 直接 invoke 也被拦（配合 Q8） |

### Sprint 1（架构地基 + LUI）
- T1 ViewRouter 保活（Q1/Q5）、T2 CommandPalette 重写（Q7）、T3 workbenchStore + viewState（Q12）、T6 Toast（Q8）。
- 配套：Q4 `useActiveThrottle`、Q6 `events.ts` + `useEvent`。
- 验收：切视图草稿不丢；Ctrl+K 能搜到实体并跳转；80% 日常操作 3 次按键内。

### Sprint 2（FSM 可视化 + Guard + IA 重排）
- T4 fsmStore + FSMPipeline（Q16 契约先行 + Mock 驱动）、T5 SystemView 按层级拆 6 组件（Q9）、T7 Trace 贯通、T10 permission 对接（Q8）。
- 配套：Q2 三层层级 + Live Event Stream Stage、Q15 SystemDrawer、Q3 Ring Buffer + 分层落库。
- 验收：FSM 节点状态可视、可断点续跑；错误日志按 trace 聚合；危险操作被 Rust 拦截有明确反馈。

### Sprint 3（Projects 特例 + 可观测 + 安全硬化）
- Projects grid 模式 + ProjectDetailView（Q10/Q11）、T8 Web Locks（Q13）、T9 MOCK_ALL_AGENTS（Q14）。
- 验收：多标签页无数据错乱；`MOCK_ALL_AGENTS=1` 离线跑通 FSM 全流程；Projects grid/carousel 双形态。 |

## 5. 风险与取舍

- 保活挂载提升内存占用：仅对 AI Studio / Knowledge 启用，其余视图继续重挂载。
- SystemView 拆分是纯重构，风险低但量大；建议逐卡抽取 + 每卡一步验收（verify:ui 保持绿）。
- fsmStore 依赖 Rust fsm_nodes 落地，Sprint 2 需与后端同步交付，不可单端先行。
- 确认门下放 Rust 后，前端所有危险操作需要回归测试绕过路径（直接 invoke 也被拦）。

## 6. 验收与质量门

- 沿用既有：`npm run build` / `lint` / `prettier --check` / `verify:ui` / `verify:preview`。
- 新增 lane：`commandPaletteEntity`（实体搜索）、`viewStatePersist`（切视图草稿保留）、`fsmVisualization`（节点状态渲染）、`permissionDenied`（Rust 拦截反馈）。
