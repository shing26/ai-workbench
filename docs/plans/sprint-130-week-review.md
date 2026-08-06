# Sprint 130 计划：Actions 周目标统计与快速归档

目标：为 Actions 新增 Week Review 卡片：按本周 7 天聚合 Focus 任务完成情况，展示周完成率、最佳日与连续完成天数，并支持一键把本周已完成任务归档出今日 Focus，浏览器 fallback 与 Tauri 共用同一任务模型。

## Sprint 130 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 周统计计算 | 组件内由 `tasks` 派生出本周每日 planned / done、周 total / done、完成率、最佳日与连续完成天数（空档日不断连） |
| R2 | Week Review 卡片 | Actions 新增 `data-week-review` BentoCard，含 `data-week-review-total` / `data-week-review-rate` / `data-week-review-best` / `data-week-review-streak` |
| R3 | 日条联动 | 7 个日按钮带 `data-week-review-day` / `data-week-review-day-total` / `data-week-review-day-done` / `data-week-review-day-selected`，点击同步 Today Focus 选中日 |
| R4 | 快速归档 | `data-week-review-archive` 一键把本周 done 任务执行 `setTaskToday(false)` + `setTaskDueDate(null)`，结果写入 `data-week-review-archived`；reload 后保持归档结果 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `weekReviewStats` / `weekReviewArchive` / `weekReviewArchivePersisted` 三条 lane |
| R6 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Actions 周目标统计卡片展示本周完成率、最佳日与连续天数。
- [x] 7 天日条可点击联动 Today Focus 选中日。
- [x] 快速归档把本周已完成任务移出 Focus，reload 后保持。
- [x] 双端 lane 覆盖统计展示、快速归档与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
