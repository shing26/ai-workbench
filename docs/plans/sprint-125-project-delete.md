# Sprint 125 计划：Projects 项目删除

目标：为 Projects 项目卡片新增删除能力，支持二次确认，并在删除时解除关联会话的 `project_id`，持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 125 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端删除命令 | Rust 新增 `delete_project(id)`：删除前把关联 `sessions.project_id` 置空，再删除项目；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` / `workbenchStore` 新增同构 `deleteProject`，localStorage fallback 同步清理项目并解除会话关联 |
| R3 | 项目卡片删除 | 项目设置区新增 `data-project-delete` / `data-project-delete-confirm` / `data-project-delete-cancel`，删除需二次确认 |
| R4 | 联动刷新 | 删除后项目卡片、Portfolio summary、Project carousel 同步消失/更新，reload 后保持 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectDelete` / `projectDeletePersisted` / `projectDeleteCancel`：删除 → reload 持久化 → 取消不删除 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持项目删除并解除会话关联。
- [x] Projects 卡片提供删除二次确认与取消控件。
- [x] 删除结果 reload 后保持。
- [x] `projectDelete` 双端覆盖删除、持久化与取消。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
