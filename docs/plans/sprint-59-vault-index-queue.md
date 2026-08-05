# Sprint 59 计划：Vault Index 串行任务队列

目标：让多个 Vault Index 请求按 FIFO 排队串行执行，同一时间只跑一个索引任务，避免并发扫描互相覆盖进度与抢占数据库连接。

## Sprint 59 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 队列状态结构 | `VaultIndexState` 持有 active + FIFO 队列，支持入队、认领、完成、取出排队任务 |
| A2 | 串行调度 | 任务完成后自动启动下一个排队任务；`start_vault_index` 在队列非空时返回 queued 状态 |
| A3 | 队列状态接口 | 新增 `get_vault_index_queue_status` 命令与 `vault-index-queue` 事件，快照含 active/queue/position |
| A4 | 排队取消 | `cancel_vault_index` 对排队任务直接出队并发出 cancelled 进度，随后继续调度 |
| A5 | 前端一致 | TS fallback 镜像同一队列语义；Knowledge 显示 active + queued 队列条，排队任务可取消 |
| A6 | 自动化验证 | 连续点击两次 Index 时先出现 queued，随后队列排空；两条 lane 全绿 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 单测覆盖队列串行晋升与排队任务取消。
- [x] `verify:ui` / `verify:preview` 的 `indexQueue.sawQueue` 与 `indexQueue.drained` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.59.0-alpha`。

## 范围外（Backlog）

- 索引任务持久化：重启后恢复未完成队列。
- 队列优先级（手动 vs watch 触发）。
- 审计按日/周聚合图表。
- watch 事件时间线。
