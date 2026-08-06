# Sprint 127 计划：Knowledge 笔记删除与类型转换

目标：为 Knowledge 笔记详情面板新增类型转换与删除能力：笔记可在 inbox / note / doc 间转换，删除需二次确认，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 127 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端类型转换 | Rust 新增 `update_thought_type(id, type)`：更新 `thoughts.type` 并返回最新 Thought；Tauri 命令注册 |
| R2 | 后端删除 | Rust 新增 `delete_thought(id)`：缺失 id 返回 `QueryReturnedNoRows`；Tauri 命令注册 |
| R3 | 浏览器同构 | `db.ts` / `workbenchStore` 新增同构 `updateThoughtType` / `deleteThought`，localStorage fallback 同步更新或移除 `thoughts` |
| R4 | 详情面板转换 | 详情头部新增 `data-thought-type-select` 分段控件（inbox / note / doc），切换后类型徽标与统计同步 |
| R5 | 删除二次确认 | 详情头部新增 `data-thought-delete` / `data-thought-delete-confirm` / `data-thought-delete-cancel`，删除后列表、统计与 RAG 结果同步移除 |
| R6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `thoughtTypeConvert` / `thoughtTypeConvertPersisted` / `thoughtTypeConvertRestored` / `thoughtDelete` / `thoughtDeleteCancel` / `thoughtDeletePersisted` |
| R7 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持笔记类型转换与删除。
- [x] 详情面板提供类型分段控件与删除二次确认。
- [x] 转换/删除结果 reload 后保持。
- [x] 双端 lane 覆盖转换、删除、取消与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
