# Sprint 121 计划：Knowledge 笔记标签编辑

目标：在 Knowledge 详情面板为本地笔记提供标签编辑入口，支持逗号分隔输入、自动归一化（去空格、补 `#`、去重），保存后同步刷新侧栏、Tag Library 与详情徽标，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 121 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端更新命令 | Rust 新增 `update_thought_tags(id, tags)`：仅更新 `thoughts.tags`，返回最新 Thought；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` 新增 `updateThoughtTags`，localStorage fallback 更新 `thoughts` 并返回最新 Thought |
| R3 | 详情标签编辑 | Knowledge 详情面板新增 `data-thought-tags-edit` / `data-thought-tags-input` / `data-thought-tags-save` / `data-thought-tags-cancel` / `data-thought-tags-result`，仅对本地 thoughts 渲染 |
| R4 | 标签归一化 | 保存时按逗号拆分、去空白、补 `#`、去重，空标签不参与拼接 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `thoughtTagEdit` / `thoughtTagEditPersisted` / `thoughtTagEditRestored`：编辑 → reload 持久化 → 恢复原标签 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持笔记标签更新。
- [x] Knowledge 详情面板提供标签编辑控件并归一化输入。
- [x] 编辑结果 reload 后保持。
- [x] `thoughtTagEdit` 双端覆盖编辑、持久化与恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
