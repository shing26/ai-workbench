# Sprint 108 计划：搜索历史与跨会话聚合统计

目标：AI Studio 会话搜索支持最近查询快速回填，并在搜索结果上展示跨会话聚合统计，帮助用户快速判断一次搜索的覆盖范围。

## Sprint 108 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 搜索历史 | 新增 `src/lib/searchHistory.ts`：查询去重、最多保留 8 条、localStorage 持久化；AI Studio 搜索完成后自动记录并显示 Recent 标签 |
| R2 | 历史回填与清空 | 点击历史标签立即复用查询；清空按钮移除历史并删除 localStorage key |
| R3 | 跨会话聚合统计 | `summarizeSearchHits` 计算总命中、会话数、title/model/message、拼音命中与平均分；搜索栏下方显示 `data-session-search-stats` |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionSearchHistoryStats` lane：`question` 命中多会话消息、历史可见、点击回填、清空生效 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 最近查询持久化、去重、可一键回填与清空。
- [x] 搜索结果展示跨会话聚合统计，验证 lane 覆盖多会话命中。
- [x] Rust 无结构变更；前端 build / lint / 双端验证全绿。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
