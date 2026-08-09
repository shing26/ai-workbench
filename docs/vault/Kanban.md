---
type: kanban
tags: [kanban, planning]
---

# Kanban

下一迭代任务看板。方向：[[ADR-001-Local-MoA-Orchestrator]] + 前端 Q1–Q16 决策矩阵（权威源 `docs/plans/frontend-refactor-adr001.md`）。

## Doing

- Sprint 0：P0 还债（已锁定 2026-08-07，见 [[Tickets]] P0 区）

## Next Up

- Sprint 1：LUI + 保活 + viewState
  - T1 ViewRouter 保活（Q1/Q5）
  - T2 CommandPalette 万能入口（Q7）
  - T3 workbenchStore + viewState（Q12）
  - `events.ts` 单一订阅 + `useEvent`（Q6）
  - `useActiveThrottle` 三档节流（Q4）
  - Toast 系统（Q8 配套）

## Backlog

- Sprint 2：FSM + SystemView IA 重排 + Guard
  - 三层层级 + Live Event Stream Stage（Q2/Q3）
  - SystemView 拆 6 组件（Q9）+ SystemDrawer（Q15）
  - FSMPipeline 契约先行 + Mock 驱动（Q16）
  - WorkbenchError + usePermissionGuard（Q8）
  - Trace 贯通 UI（T7）
- Sprint 3：Projects 特例 + 可观测 + 安全
  - Projects grid 模式 + ProjectDetailView（Q10/Q11）
  - withDbLock Web Locks（Q13）
  - MOCK_ALL_AGENTS 开关（Q14）

## Done（近期）

- v1.0 全量交付（2026-08-07）
- 双代理 UX 审查（2026-08-07）
- /grilling 定位与架构定稿（2026-08-07）
- 前端 design tree 访谈 Q1–Q16 共识（2026-08-07）
- Sprint 0 P0 任务清单锁定（2026-08-07）
