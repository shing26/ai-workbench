# Sprint 140 计划：Knowledge 双链补全编辑器提示

目标：为 Knowledge 正文编辑器补齐 Wiki 双链输入体验：输入 `[[` 后按首行标题 / 标签联想已有笔记，点击或键盘插入 `[[Title]]`，降低手动拼标题的出错率。

## Sprint 140 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | 联想函数 | `db.ts` 新增 `WikiLinkSuggestion` 与 `suggestWikiLinkTargets(thoughts, query, limit?, excludeId?)`：按首行标题 / 标签过滤，精确 > 前缀 > 包含 > 标签排序，默认返回最多 6 条并排除当前笔记 |
| L2 | 编辑器联想 | 正文编辑 textarea 输入未闭合的 `[[...` 时弹出 `data-wiki-link-suggestions` 列表，支持点击、ArrowUp / ArrowDown、Enter / Tab 插入与 Esc 关闭；插入后光标落在 `[[Title]]` 末尾 |
| L3 | 状态清理 | 保存、取消、切换 Preview、跳转笔记时关闭联想并重置高亮索引 |
| L4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `wikiLinkAutocomplete` + `wikiLinkPersisted` lane：种子 4 条笔记，断言候选、方向键高亮、点击 / Enter / Tab / Esc 与保存重载持久化 |
| L5 | 文档更新 | BACKLOG 移除该项并记入已完成，RETRO / ARCHITECTURE / DATABASE 同步；纯前端改动，无 Rust 命令与表结构变更 |

## DoD 检查单

- [x] 输入 `[[` 弹出标题候选，点击与键盘均可插入 `[[Title]]`。
- [x] 保存并重载后，正文中的双链文本持久化可见。
- [x] `verify:ui` / `verify:preview` 的 `wikiLinkAutocomplete` / `wikiLinkPersisted` lane 双端通过。
- [x] `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib` 全绿。
- [x] PR 合并到 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
- 真实 Embedding 模型、语义聚类、向量分片等候选继续留在池中，不做 LLM 补全或模糊语义联想。
