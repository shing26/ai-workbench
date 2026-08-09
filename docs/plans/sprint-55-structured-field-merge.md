# Sprint 55 计划：结构化字段级合并

目标：为同步冲突提供第三种策略 `structured`，对 JSON 对象 / Markdown frontmatter 内容做字段级合并，普通文本继续走行级 union。

## Sprint 55 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | JSON 合并 | 双方均为 JSON 对象/数组时递归合并：对象按 key 合并，数组按 JSON 去重并集，标量冲突取更新时间较新一侧 |
| A2 | Markdown 合并 | 双方均含 frontmatter 时按字段合并，逗号列表字段取并集，正文沿用行级 union |
| A3 | 命令与审计 | `resolve_sync_conflict_structured` / `resolve_sync_conflicts_structured`，审计 `sync.resolve.structured` / `.batch` |
| A4 | 前端入口 | System 冲突卡片新增 `Merge fields`，批量区新增 `Merge fields`，审计筛选新增 structured 选项 |
| A5 | 单元测试 | JSON 字段/数组合并、frontmatter 合并、纯文本 fallback、单条与批量 structured 落库 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 构造 JSON 冲突并断言字段级合并结果 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] structured 合并单测通过：JSON 字段/数组、frontmatter、纯文本 fallback、单条与批量。
- [x] System 冲突卡片与批量区提供 `Merge fields`，审计筛选包含 structured 事件。
- [x] `verify:ui` / `verify:preview` 断言 JSON 冲突合并后含 `life` / `done: true`，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.55.0-alpha`。

## 范围外（Backlog）

- 自定义审计日期范围。
- watch 事件按文件类型的细分统计。
- 索引任务队列（同时只跑一个任务）。
- 结构化合并的嵌套数组按对象 key 去重。
