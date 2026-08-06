# Sprint 123 计划：AI Studio 会话归档

目标：为 AI Studio 会话侧栏新增归档能力，支持将历史会话归档隐藏、归档页恢复，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 123 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端归档命令 | Rust `sessions` 新增 `archived` 列并幂等迁移；新增 `set_session_archived(id, archived)`，返回最新 Session；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` 新增 `setSessionArchived`，localStorage fallback 更新 `sessions` 并兼容旧数据 |
| R3 | 会话侧栏归档 | AI Studio 会话侧栏新增 Active / Archived 切换，`data-session-archive` / `data-session-restore` / `data-session-archive-tab` 锚点 |
| R4 | 联动刷新 | 归档后从 Active 列表消失并出现在 Archived；恢复后回到 Active；搜索与选中逻辑跟随当前 tab |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionArchive` / `sessionArchivePersisted` / `sessionArchiveRestored`：归档 → reload 持久化 → 恢复 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持会话归档状态。
- [x] AI Studio 会话侧栏提供 Active / Archived 切换与归档/恢复控件。
- [x] 归档结果 reload 后保持。
- [x] `sessionArchive` 双端覆盖归档、持久化与恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
