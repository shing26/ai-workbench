# 2026-08-05 索引队列优先级与重试评审

## 结论

- `vault_index_queue` 新增 `priority / attempts / last_error`，`migrate_vault_index_queue_priority` 幂等补列；`persist_vault_index_queue` 改为接收 `VaultIndexQueueRecord`，`list_vault_index_queue` 按 `priority DESC, created_at ASC` 返回。
- 内存队列按 `priority DESC` 插队、同优先级 FIFO；`start_vault_index` 新增 `priority`，worker 失败后若 `attempts < 3` 保留优先级重新入队并记录 `last_error`，耗尽后删除；重试间隔 800ms。
- Knowledge Vault Index 新增 Normal / High 优先级选择，队列行展示优先级与重试次数；TS fallback 镜像同一插队与重试语义并持久化新字段。
- 验证覆盖：`cargo test --lib` 80/80，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `indexQueuePriority` / `indexQueueRetry` 均为 true。

## 风险与后续

- 重试采用固定 800ms 间隔，未做指数退避；后续可按 `attempts` 动态放大间隔。
- 自动巡检运行历史与通知提醒继续保留在 Backlog。
