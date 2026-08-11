# 07 — P1-1: Dashboard 控制塔 + 7 天 Token Sparkline

**What to build:** 新增 Dashboard 视图（控制塔）：4 栏 Bento（项目数 / 7 天 Token 瘦身 Sparkline / CLI 状态摘要 / 知识健康度）+ 今日焦点三栏（Top DoD / 阻塞告警 / AI 风险）。

**Blocked by:** None — backlog（P0 优先项完成后）

**Status:** completed

- [ ] 新增 `DashboardView` + AppDock/ViewRouter 注册
- [ ] 7 天 Token 消耗历史（从 tokenBudget 或新表 `token_history` 派生）→ Sparkline
- [ ] CLI 状态摘要（在线数 + 历史成功率，从 CLI runs 统计）
- [ ] 今日焦点三栏（Top DoD / Blocked / AI 风险）
- [ ] 无 CLI 命令行发送框
- [ ] verify lane：Dashboard 渲染 + Sparkline 数据点

**Definition of Done:** Sprint 1 DoD-1/3。
