# 2026-08-05 Vault 索引并发数可配置评审

## 结论

- `index_vault_files` 新增 concurrency 参数，clamp 1~16 且不超过文件数；`index_vault_ex` 透传该参数，`index_vault` 与 watch 初始索引保持默认 4。
- Knowledge Vault Index 新增 Index concurrency 数字输入，Index vault 时按 1~16 边界透传。
- 单测覆盖 concurrency 0 / 1 / 3 / 16 / 100，files 与 ignored 结果稳定且不 panic。
- 验证覆盖：`cargo test --lib` 42/42，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 两条 lane 全绿。

## 风险与后续

- 并发数仅影响全量扫描，watch 增量仍为事件驱动；多 vault 并行 watch 与自动调优留在 backlog。
