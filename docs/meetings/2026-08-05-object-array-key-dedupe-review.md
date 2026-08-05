# 2026-08-05 对象数组按 key 去重评审

## 结论

- 新增 `canonical_json`：对象 key 递归排序后序列化，数组/标量按值展开，key 顺序不再影响去重判断。
- `merge_json_value` 数组分支用规范化字符串作为 `HashSet` 标记，`{id,label}` 与 `{label,id}` 视为同项。
- TS fallback 新增 `canonicalJson`，与 Rust 语义一致；UI 验证把 `notes` 改为对象数组并断言合并后长度 2。
- 验证覆盖：`cargo test --lib` 64/64，fmt、clippy、build 全绿；两条 lane 的 `structuredSync.notesLength` 均为 2。

## 风险与后续

- 规范化字符串只用于去重标记，保留原始 item 顺序与内容，不做排序输出。
- 深层嵌套对象同样递归排序，极端大数组会带来额外序列化开销。
