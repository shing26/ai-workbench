---
type: tickets
tags: [tickets, issue-tracker]
---

# Tickets

工单索引。仓库规范：`docs/agents/issue-tracker.md`，issue 文件在 `.scratch/<feature-slug>/issues/`。本笔记镜像关键工单。权威源：`docs/plans/frontend-refactor-adr001.md`。

## Sprint 0：P0 还债（已锁定 2026-08-07，ADR-001 前置）

> 来源：[[ADR-001-Local-MoA-Orchestrator]] 前置条件 + Q 系列访谈确认。未完成不得进入 Sprint 1。

| # | 工单 | 状态 |
|---|---|---|
| P0-1 | Task 删除 / 改名（`delete_task` / `update_task_title`，双端同构） | locked |
| P0-2 | 草稿 / 交互状态持久化（视图切换不丢） | locked |
| P0-3 | MOA 浏览器模式死锁修复 | locked |
| P0-4 | 无确认批量操作补 HITL（clear_sync_audit / prune_webhook / archiveWeekDone） | locked |
| P0-5 | 破坏性操作确认下沉 Rust Tauri 命令层 | locked |

## Sprint 1：架构地基 + LUI（Q1/Q4/Q5/Q6/Q7/Q12）

| # | 工单 | 状态 |
|---|---|---|
| S1-1 | T1 ViewRouter 保活：Lazy Mount + Keep Alive（Q1/Q5） | open |
| S1-2 | T2 CommandPalette 万能入口：CommandRegistry + commandUsage（Q7） | open |
| S1-3 | T3 workbenchStore 重构 + viewState 4 类上移（Q12） | open |
| S1-4 | `stores/events.ts` 单一订阅 + `useEvent` 分发（Q6） | open |
| S1-5 | `useActiveThrottle` 三档节流（Q4） | open |
| S1-6 | Toast/Snackbar 系统（Q8 配套） | open |

## Sprint 2：FSM 可视化 + SystemView IA 重排 + Guard（Q2/Q3/Q8/Q9/Q15/Q16）

| # | 工单 | 状态 |
|---|---|---|
| S2-1 | 三层层级 + SystemView Stage = Live Event Stream（Q2/Q3） | open |
| S2-2 | SystemView 拆 6 组件（Q9） | open |
| S2-3 | SystemDrawer 配置抽屉（Q15） | open |
| S2-4 | FSMPipeline 契约先行 + Mock 驱动（Q16） | open |
| S2-5 | WorkbenchError 结构化错误 + usePermissionGuard（Q8） | open |
| S2-6 | Trace 贯通 UI（T7） | open |

## Sprint 3：Projects 特例 + 可观测 + 安全（Q10/Q11/Q13/Q14）

| # | 工单 | 状态 |
|---|---|---|
| S3-1 | Projects grid 模式 + ProjectDetailView（Q10） | open |
| S3-2 | Carousel 双形态共存：grid 默认 + carousel 可选，关自动轮播（Q11） | open |
| S3-3 | `withDbLock` Web Locks 注入内部写函数（Q13） | open |
| S3-4 | `MOCK_ALL_AGENTS` 只 Mock 外部 I/O 5 类（Q14） | open |

## 已归档

- v1.0 全量交付（Backlog 清空，2026-08-07）
- 双代理 UX 审查问题清单（2026-08-07，已并入 Sprint 0）

## 关联

- [[ADR-001-Local-MoA-Orchestrator]]
- [[AI Workbench Hub]]
- [[Kanban]]
- 前端规划权威源：`docs/plans/frontend-refactor-adr001.md`
