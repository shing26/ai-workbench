# 2026-08-05 结构化字段级合并评审

## 结论

- `structured_merge_content` 优先识别 JSON 对象/数组：对象按键递归合并，数组按 JSON 序列化去重并集，标量冲突以 `local_updated_at >= remote_updated_at` 决定取值。
- Markdown frontmatter 按字段合并，逗号分隔列表取并集，正文继续复用行级 union；无法识别结构化内容时安全回退到 union。
- Rust 与浏览器 fallback 语义一致，新增 `sync.resolve.structured` / `sync.resolve.structured.batch` 审计事件。
- System 冲突卡片和批量区新增 `Merge fields` 入口，审计筛选可只看 structured 事件。
- 验证覆盖：`cargo test --lib` 62/62，fmt、clippy、build 全绿；两条 lane 的 `structuredSync` 均合并出 `life` / `done: true` / `count: 2`。

## 风险与后续

- 标量冲突以整条记录的更新时间作为近似字段时间戳，缺少真正的字段级 LWW 信息。
- 数组按 JSON 序列化去重，对象数组若字段顺序不同会视为不同项；后续可按对象 key 去重。
