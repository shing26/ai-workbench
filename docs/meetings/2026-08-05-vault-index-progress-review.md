# 2026-08-05 vault 索引进度事件评审

## 结论

- `index_vault_files_inner` 新增 `on_progress` 回调，`index_vault_files` 保持同步包装，既有调用方无感知。
- `start_vault_index` 在后台线程持锁执行索引，`IndexProgress` 每 5 个文件或写完后 emit，终态携带 `files` / `ignored` / `concurrency_used`。
- `startVaultIndex` 返回 `runId` 供前端追踪；完成事件统一刷新 vault 状态、RAG 状态与目标统计，避免命令返回后状态断层。
- Knowledge 视图新增进度条与完成文案；浏览器 fallback 用 3 步模拟，`verify:ui` / `verify:preview` 断言 100% 完成。
- 验证覆盖：`cargo test --lib` 55/55，fmt、clippy、build 全绿；两条 lane 的 `indexProgress` 均为 `Indexed` + 100。

## 风险与后续

- 后台线程在完成前持有 DB 写锁，超大 vault 期间其他写命令可能等待；后续可提供取消队列或分段提交。
- 事件只覆盖全量索引，增量 watch 仍走 `vault-watch-update`；两者可进一步合并为统一索引状态。
