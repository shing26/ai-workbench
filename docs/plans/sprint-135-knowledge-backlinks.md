# Sprint 135 计划：Knowledge 笔记双链与回溯

目标：为个人 Markdown 知识库加入 Obsidian 风格 `[[双链]]`：解析笔记出链、自动回链、未解析目标统计，并支持点击跳转溯源，形成可导航的知识网络。

## Sprint 135 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 链接解析 | `db.ts` 新增 `extractWikiLinks`：正则解析 `[[target]]` / `[[target\|alias]]`，去重并保留顺序；`thoughtTitle` 从首行 Markdown 标题提取笔记标题 |
| R2 | 双链图 | `buildThoughtLinkGraph` 派生每篇笔记的 outgoing / incoming 引用，`resolveWikiLinkTarget` 先精确匹配标题、再子串兜底；无 Rust 表结构变更 |
| R3 | 详情回溯 | Knowledge 详情新增 `data-thought-links` 区：Outgoing / Backlinks / Missing 三组，带 `data-knowledge-graph-stats` 统计（links / backlinks / missing），点击跳转目标笔记并清除搜索与标签过滤 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `knowledgeBacklinks` lane：种子 Alpha / Beta / Gamma 三篇笔记，断言出链、回链、缺失链接、统计与双向跳转 |
| R5 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] `[[双链]]` 解析、标题提取与去重正确。
- [x] 出链 / 回链 / 缺失统计在详情面板可见，点击可跳转。
- [x] 双端 lane 覆盖解析、统计与跳转。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
