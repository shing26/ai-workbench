# Sprint 124 计划：Knowledge 笔记正文编辑

目标：为 Knowledge 笔记详情面板新增 Markdown 正文编辑能力，支持保存到 Tauri SQLite 与浏览器 fallback，并在编辑时提供预览切换。

## Sprint 124 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端正文更新命令 | Rust 新增 `update_thought_content(id, content)`，仅更新 `thoughts.content`，返回最新 Thought；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` / `workbenchStore` 新增同构 `updateThoughtContent`，localStorage fallback 同步更新 `thoughts` |
| R3 | 正文编辑面板 | Knowledge 详情面板新增 `data-thought-body-edit` / `data-thought-body-input` / `data-thought-body-save` / `data-thought-body-cancel` / `data-thought-body-result` / `data-thought-body-preview` |
| R4 | 联动刷新 | 保存后 Markdown 预览、笔记列表标题与 RAG 搜索内容同步；切换编辑/预览不丢草稿 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `thoughtBodyEdit` / `thoughtBodyEditPersisted` / `thoughtBodyEditRestored`：编辑 → reload 持久化 → 恢复原文 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持笔记正文更新。
- [x] Knowledge 详情面板提供正文编辑、保存、取消与预览切换控件。
- [x] 正文修改结果 reload 后保持。
- [x] `thoughtBodyEdit` 双端覆盖编辑、持久化与恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
