---
type: hub
tags: [hub, index]
---

# AI Workbench Hub

本地优先的 Solo Creator AI 工作台。项目已到 v1.0，下一迭代方向由 [[ADR-001-Local-MoA-Orchestrator]] 定义。

## 核心定位

> 个体能力的超级放大器。LUI 优先，数据不出这台机器。

- 用户：Solo Creator（见仓库 `docs/user-profile.md`）
- 形态：Tauri 2 桌面 + React/TS 前端 + Rust 后端 + SQLite
- 主视图：AI Studio / Projects / Knowledge / Actions / System

## 当前状态

- **v1.0**：完成。Backlog 清空，8 项质量门全绿（build/lint/prettier/clippy/test 203/verify:ui/verify:preview）。
- **下一迭代**：Sprint 0（P0 还债，**已锁定 2026-08-07**）→ Sprint 1–3（落地 [[ADR-001-Local-MoA-Orchestrator]] + 前端 Q1–Q16 决策矩阵）。
- **前端改造**：决策矩阵已固化，见 `docs/plans/frontend-refactor-adr001.md`（Q1–Q16 共识达成，未确认实施前不动代码）。

## 路线图

- [x] v1.0 完成（2026-08-07）
- [x] 前端 design tree 访谈 Q1–Q16 共识（2026-08-07）
- [x] Sprint 0 P0 任务清单锁定（2026-08-07）
- [ ] Sprint 0：P0 还债（任务删除/改名、草稿持久化、MOA 死锁、无确认批量操作、确认门下沉 Rust）
- [ ] Sprint 1：LUI 入口 + 视图保活 + viewState（Q1/Q4/Q5/Q6/Q7/Q12）
- [ ] Sprint 2：FSM 可视化 + SystemView IA 重排 + Guard（Q2/Q3/Q8/Q9/Q15/Q16）
- [ ] Sprint 3：Projects 特例 + Web Locks + MOCK_ALL_AGENTS（Q10/Q11/Q13/Q14）
- [ ] 搁置：Connection Layer / Monetization Workbench / 企业 MoA Gateway

## 导航

- 架构决策：[[ADR-001-Local-MoA-Orchestrator]]（含 Q1–Q16 决策矩阵摘要）
- 前端规划：`docs/plans/frontend-refactor-adr001.md`（决策矩阵权威源）
- 开发看板：[[Kanban]]
- 工单：[[Tickets]]
