# Sprint 72 计划：自动巡检运行历史与通知提醒

目标：为文档健康自动巡检补齐“历史可回溯、结果有提醒”。每次自动巡检（以及手动 Clean）把 `ranAt / removed / reindexed / failed / triggeredBy` 写入本地运行历史（最多保留 50 条）；当最近一次自动巡检发现可处理项时，Knowledge Document status 展示提醒横幅，Dismiss 后持久化，刷新不再打扰。

## Sprint 72 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 历史模型 | `db.ts` 新增 `DocHealthRunRecord` 与 `getDocHealthRunHistory` / `appendDocHealthRun`，持久化到 `ai-workbench:doc-health-history:v1`，最多 50 条 |
| A2 | 提醒持久化 | 新增 `getDocHealthAlertDismissedAt` / `setDocHealthAlertDismissedAt`，Dismiss 时间写入 `ai-workbench:doc-health-alert-dismissed:v1` |
| A3 | 自动巡检落历史 | `runDocHealthAutoInspect` 与手动 Clean 均追加运行记录，`triggeredBy` 区分 auto / manual，`alert` 由 removed+reindexed+failed > 0 判定 |
| A4 | Knowledge UI | Document status 新增最近 5 次运行历史与提醒横幅；横幅显示 removed / reindexed / failed，Dismiss 后刷新不重现 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `docHealthHistory` / `docHealthDismissPersist` lane：历史含 removed=1 / reindexed=1、提醒可见、Dismiss 后刷新仍消失 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] TS fallback 与 Knowledge UI 覆盖运行历史与提醒持久化。
- [x] `verify:ui` / `verify:preview` 的 `docHealthHistory` / `docHealthDismissPersist` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.72.0-alpha`。

## 范围外（Backlog）

- 暂无（Backlog 清空后进入下一阶段候选池）。
