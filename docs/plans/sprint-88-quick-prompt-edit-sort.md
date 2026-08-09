# Sprint 88 计划：Quick Prompt 编辑与拖拽排序

目标：把 Sprint 87 留下的“Quick Prompt 编辑与拖拽排序”候选池项落地。自定义 Quick Prompt 支持编辑标签 / 分类 / 文本，并可通过拖拽手柄或上下箭头调整顺序；顺序字段进入持久化与同步快照，刷新与多端合并后仍保持。

## Sprint 88 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 数据模型 | `quick_prompts` 新增 `sort_order` 列（SCHEMA + `migrate_quick_prompt_order` 旧库迁移）；`QuickPrompt` 模型新增 `order` serde 字段，list / upsert / merge 全部读写该列 |
| A2 | 编辑命令 | 新增 `update_custom_quick_prompt(id, label, category, text)`：仅允许编辑 custom 行，保留 created_at / order，回写 `updated_at` |
| A3 | 排序命令 | 新增 `reorder_custom_quick_prompts(ids)`：单事务按传入顺序重排 custom prompt 的 `sort_order`（0..n-1）并刷新 `updated_at` |
| A4 | TS API | `db.ts` 新增 `updateCustomQuickPrompt` / `reorderCustomQuickPrompts` 异步 API；浏览器 fallback 读写 `ai-workbench:quick-prompts:v1`，重排后 order 重新编号 0..n-1 |
| A5 | 排序语义 | `loadQuickPromptsByUsage` 排序改为：使用次数降序，其次 `order`（无 order 时回退原列表索引）升序；内置 prompt 顺序保持硬编码 |
| A6 | 前端交互 | AIStudioView Manage 面板改为行式列表：拖拽手柄（dnd-kit）、编辑按钮、上下箭头、删除按钮；编辑态复用顶部表单并显示 Save / Cancel |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `quickPromptEditSort` / `quickPromptEditSortPersist` lane：新增两个 prompt → 编辑第一个 → 下移 → 断言 DOM 顺序、localStorage order 与刷新持久化 |

## DoD 检查单

- [x] `cargo fmt`、`cargo clippy --lib -- -Dwarnings`、`cargo test --lib` 全绿（95/95）。
- [x] `npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `quickPromptEditSort` / `quickPromptEditSortPersist` 均为 true。
- [x] Rust 单测覆盖编辑拒绝内置行、重排持久化与同步字段兼容。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.88.0-alpha`。

## 范围外（Backlog）

- 不做内置 Quick Prompt 编辑；内置内容保持前端硬编码。
- 不做行内着色与 diff 编辑器、整文件对比视图；继续留在 Backlog。
- 不做真实 Provider 端到端流式联调；继续留在 Backlog。
