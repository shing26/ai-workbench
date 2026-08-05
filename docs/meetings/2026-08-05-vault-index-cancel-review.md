# 2026-08-05 vault 索引取消评审

## 结论

- `VaultIndexState` 维护 cancelled runId 集合，`cancel_vault_index` 命令幂等标记，终态后自动清理，避免集合无限增长。
- `index_vault_files_inner` 新增 `should_cancel` 回调并在每个文件写入前检查；取消时返回统一错误文案，`start_vault_index` 映射为 `cancelled` 终态并携带最近进度。
- Knowledge 进度条在运行中显示 Cancel，点击后状态变为 `Cancelled`；浏览器 fallback 用 Set 模拟取消语义。
- 验证覆盖：`cargo test --lib` 57/57，fmt、clippy、build 全绿；两条 lane 的 `cancelIndex` 均为 `Cancelled`。

## 风险与后续

- 取消检查按文件粒度，单文件写入本身不可中断；超大单文件仍需等待当前写入完成。
- 当前同时启动多个索引仍会并行持锁，后续可加任务队列只允许单任务运行。
