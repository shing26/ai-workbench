# Sprint 137 计划：AI Studio 会话摘要与关键词

目标：为 AI Studio 会话导出增加本地摘要能力：统计提问数、提取中英文关键词、生成问答要点，摘要随 Markdown 一起导出，并在导出面板顶部提供速览。

## Sprint 137 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 摘要生成 | `db.ts` 新增 `buildSessionSummary`：questionCount、keywords（中文 2-3 字 n-gram + 英文词，过滤停用词，取 top 6）、points（每个 user 消息配对下一条 assistant 回复，各取首行截断） |
| R2 | 导出嵌入 | `buildSessionMarkdown` 在正文前插入 `## Summary` 段：Questions / Keywords / Q&A 要点 |
| R3 | 面板速览 | 导出面板头部新增 `data-session-summary` 摘要条：`data-session-summary-stats`、`data-session-summary-keyword` chips、`data-session-summary-point` 要点列表 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionSummary` lane：种子 Weekly Sync 会话与 4 条消息，断言 2 questions、收益/风险关键词、2 个要点与 Markdown 中的 Summary 段 |
| R5 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 摘要统计、关键词与问答要点正确生成。
- [x] 导出 Markdown 含 Summary 段，面板顶部可速览。
- [x] 双端 lane 覆盖摘要内容与导出面板。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
