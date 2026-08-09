# Sprint 136 计划：Projects 收益端聚合展示

目标：在 Portfolio summary 增加收益聚合面板：汇总全部项目最新收益、趋势点数、7 天 / 30 天收益变化，并按项目状态拆分收益，让收益走势一眼可读。

## Sprint 136 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 聚合派生 | ProjectsView 由 `projects` + `revenueTrends` 派生 latestTotal / trendTotal / delta7d / delta30d / byStatus；最新值用每项目最新趋势点，无历史时用当前 revenue 兜底 |
| R2 | 展示面板 | Portfolio summary 新增 `data-project-revenue-summary` 区：Latest / Trend points / 7d delta / 30d delta 四格，以及 `data-project-revenue-status` 状态收益 chips（金额 + 项目数） |
| R3 | 报告同步 | Portfolio export 报告 Overview 追加 Latest revenue / Revenue points / 7d / 30d 四行 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectRevenueSummary` lane：种子两个项目（paused 项目收益 0）与 4 个趋势点，断言 40.00 最新值、4 点、+20.00 / +30.00 变化与 active / paused 拆分 |
| R5 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 收益聚合覆盖最新值、趋势点数、7d / 30d 变化与状态拆分。
- [x] 无历史项目正确回退当前 revenue，delta 为 0。
- [x] 双端 lane 覆盖聚合数值与状态 chips。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
