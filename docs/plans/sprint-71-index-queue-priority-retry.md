# Sprint 71 计划：索引队列优先级与失败重试

目标：把 Vault 索引队列从纯 FIFO 升级为“高优先级插队 + 失败自动重试”。`vault_index_queue` 新增 `priority / attempts / last_error` 字段，启动索引可指定 Normal / High 优先级，队列按优先级降序再按入队时间排序；索引失败后自动重试（最多 3 次），每次重试保留优先级并记录失败原因，耗尽次数后才放弃并清理。

## Sprint 71 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 表结构扩展 | `vault_index_queue` 新增 `priority INTEGER DEFAULT 0`、`attempts INTEGER DEFAULT 0`、`last_error TEXT DEFAULT ''`，并幂等迁移旧库 |
| A2 | 优先级排序 | 内存队列按 `priority DESC` 插队，同优先级保持 FIFO；DB `list_vault_index_queue` 按 `priority DESC, created_at ASC` 返回 |
| A3 | 失败重试 | worker 失败后若 `attempts < 3` 则保留优先级重新入队并记录 `last_error`，否则删除记录并结束；重试间隔 120ms 防热循环 |
| A4 | TS fallback | `startVaultIndex` 新增 `priority`，fallback 镜像优先级插队与最多 3 次失败重试，持久化 `priority / attempts / lastError` |
| A5 | Knowledge UI | Vault Index 新增 Normal / High 优先级选择；队列行展示优先级与重试次数，进度区展示最终错误 |
| A6 | 单测 | Rust 覆盖旧库迁移、优先级排序、失败重试耗尽与恢复顺序 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `indexQueuePriority` 与 `indexQueueRetry` lane：高优先级先跑、重试次数 1/2 可见、最终错误可见并 drain |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 单测覆盖迁移、优先级排序与失败重试。
- [x] `verify:ui` / `verify:preview` 的 `indexQueuePriority` / `indexQueueRetry` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.71.0-alpha`。

## 范围外（Backlog）

- 自动巡检运行历史与通知提醒。
