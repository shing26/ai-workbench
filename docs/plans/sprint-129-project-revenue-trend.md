# Sprint 129 计划：Projects 收益趋势

目标：为 Projects 新增收益历史快照与趋势图：每次保存收益时自动记录快照，项目卡片展示最近 12 次收益趋势，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 129 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 历史表 | 新库 SCHEMA 新增 `project_revenue_history`（project_id / revenue / recorded_at），旧库由 `CREATE TABLE IF NOT EXISTS` 幂等补建 |
| R2 | 快照写入 | Rust `create_project` / `update_project` 自动写入收益快照，`delete_project` 级联删除该项目历史 |
| R3 | 趋势查询 | Rust 新增 `list_project_revenue_history(project_id, limit)`，返回最近 N 条按时间升序；Tauri 命令注册 |
| R4 | 浏览器同构 | `db.ts` / localStorage 新增 `projectRevenueHistory` 数组与同构 `listProjectRevenueHistory`，创建/更新/删除同步维护 |
| R5 | 卡片趋势图 | 项目卡片设置区下方新增 `data-project-revenue-trend` 条形趋势，每个点带 `data-project-revenue-point` / `data-project-revenue-value` / `data-project-revenue-at` |
| R6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectRevenueTrend` / `projectRevenueTrendPersisted`：保存收益后趋势点增加且末点为最新值，reload 后保持 |
| R7 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持收益历史快照与趋势查询。
- [x] 项目卡片展示最近收益趋势，删除项目时历史同步清理。
- [x] 趋势结果 reload 后保持。
- [x] 双端 lane 覆盖趋势写入与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
