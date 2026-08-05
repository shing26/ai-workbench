# 2026-08-05 Vault 索引任务队列持久化评审

## 结论

- 新增 `vault_index_queue` 表（run_id 主键、path、ignore_patterns JSON、concurrency、status、created_at、updated_at），`start_vault_index` 入队即落库；worker 完成 / 取消 / 出错后删除记录，排队取消同步删除。
- setup 启动时调用 `restore_vault_index_queue`：读取 pending 记录，`running` 重置为 `queued` 重新入队，并继续调度下一个任务。
- TS fallback 用 `ai-workbench:vault-index-queue:v1` 保存同一队列，重载后自动恢复并 drain；UI 队列条行为不变。
- 验证覆盖：`cargo test --lib` 74/74（新增跨重开持久化与恢复语义单测），fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `indexQueuePersist` 均 seed 6 条任务后重载，断言恢复执行并最终 drain。

## 风险与后续

- `running` 记录在重启时按重试语义重置为 `queued`，不会自动恢复“未完成的进度”，但保证任务不丢失。
- 队列优先级与失败重试策略已排入 Backlog，作为下一阶段候选。
