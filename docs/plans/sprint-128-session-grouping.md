# Sprint 128 计划：AI Studio 会话分组

目标：为 AI Studio 会话侧栏新增分组视图：固定会话置顶，其余按 今天 / 昨天 / 7 天内 / 更早 分组，并支持分组折叠；搜索或 RAG 命中时自动退化为平铺列表。

## Sprint 128 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 分组模型 | 侧栏按 pinned / today / yesterday / 7d / older 顺序分组，pinned 置顶，组内保持原排序 |
| R2 | 分组折叠 | 组头新增 `data-session-group-toggle` / `data-session-group-label` / `data-session-group-count` / `data-session-group-collapsed`，点击折叠/展开该组 |
| R3 | 搜索退化 | 输入查询或 RAG 命中时隐藏分组头，恢复平铺列表，清空后分组恢复 |
| R4 | 归档兼容 | Active / Archived tab 均按同一分组规则渲染 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionGrouping` / `sessionGroupingToggle` / `sessionGroupingSearchFlat` |
| R6 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 会话侧栏按 pinned / 今天 / 昨天 / 7 天内 / 更早 分组展示。
- [x] 分组头支持折叠/展开且计数正确。
- [x] 搜索与 RAG 命中时退化为平铺列表，清空后恢复分组。
- [x] 双端 lane 覆盖分组、折叠与搜索退化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
