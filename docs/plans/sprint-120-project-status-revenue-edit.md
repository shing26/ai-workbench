# Sprint 120 计划：Projects 项目状态与收益编辑

目标：在 Projects 每个项目卡片内提供项目设置区，直接编辑项目状态（active / paused）与累计收益，保存后同步刷新 Portfolio summary、项目卡片与轮播详情，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 120 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端更新命令 | Rust 新增 `update_project(id, status, revenue)`：状态仅接受 active / paused，收益非负，更新后返回最新 Project；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` 新增 `updateProject`，localStorage fallback 更新 `projects` 并做同样的状态 / 收益钳制 |
| R3 | 项目设置区 | 每个项目卡片新增 `data-project-edit`：`data-project-status` 下拉、`data-project-revenue` 数字输入、`data-project-save` 保存与 `data-project-edit-result` 结果 |
| R4 | 联动刷新 | 保存后 Portfolio summary、项目卡片 StatPill 与 Project carousel 详情同步显示新状态 / 收益 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectEdit` / `projectEditPersisted` / `projectEditRestored`：编辑 → reload 持久化 → 恢复原状 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持项目状态 / 收益编辑。
- [x] 项目卡片提供状态与收益编辑控件并联动汇总。
- [x] 编辑结果 reload 后保持。
- [x] `projectEdit` 双端覆盖编辑、持久化与恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
