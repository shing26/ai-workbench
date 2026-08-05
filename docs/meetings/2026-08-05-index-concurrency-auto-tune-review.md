# 2026-08-05 索引并发自动调优评审

## 结论

- Rust 新增 `recommend_index_concurrency`：基于 `available_parallelism` 计算推荐并发并 clamp 1~16，失败回退 4，返回 `{ recommended, cores }`。
- Knowledge Vault Index 新增 Auto 开关：开启后并发输入禁用并显示推荐值，`runIndex` 使用推荐并发；关闭恢复手动输入，原有数字输入与并发边界逻辑不变。
- 浏览器 fallback 用 `navigator.hardwareConcurrency` 计算，headless 验证环境推荐值为 16（在 1~16 内）。
- 单测覆盖推荐值边界与核心数关系；`cargo test --lib` 47/47，fmt、clippy、build 全绿。
- `verify:ui` / `verify:preview` 新增 Auto 开启后禁用输入、推荐值在范围、关闭后恢复编辑断言，两条 lane 全绿。

## 风险与后续

- 当前推荐只按核心数，未按文件规模动态调整；留在 Backlog。
- 手动并发仍可覆盖推荐值，Auto 仅作为默认建议，不改变 `index_vault_files` 的 clamp 语义。
