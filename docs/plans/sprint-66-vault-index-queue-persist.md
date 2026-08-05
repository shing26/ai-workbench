# Sprint 66 计划：Vault 索引任务队列持久化

目标：Sprint 59 的索引队列只存在内存里，应用重启后排队任务全部丢失。本 Sprint 让 queued / running 任务写入 SQLite，重启后自动恢复排队并继续执行；取消或完成的任务从持久化队列移除。

## Sprint 66 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 持久化表 | 新增 `vault_index_queue` 表（run_id 主键、path、ignore_patterns JSON、concurrency、status、created_at、updated_at），SCHEMA 幂等 |
| A2 | Rust 持久化命令 | `persist_vault_index_queue` / `list_vault_index_queue` / `delete_vault_index_queue`，ignore_patterns 用 JSON 数组存取 |
| A3 | 队列接入 | `start_vault_index` 入队时落库；worker 完成 / 取消 / 错误后删除记录；取消排队任务同步删记录 |
| A4 | 启动恢复 | setup 启动后读取 pending 记录，`running` 重置为 `queued` 重新入队并继续调度 |
| A5 | TS fallback | `ai-workbench:vault-index-queue:v1` 持久化同一队列，重载后恢复并自动 drain |
| A6 | 单测 | Rust 覆盖持久化跨重开恢复、删除单条、running 重置为 queued 的恢复语义 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `indexQueuePersist` lane：seed 2 条排队任务后重载，断言恢复执行并最终 drain |

## DoD 检查单

- [x] `cargo test --lib` 全绿（74/74），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖持久化、删除、恢复语义。
- [x] `verify:ui` / `verify:preview` 的 `indexQueuePersist` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.66.0-alpha`。

## 范围外（Backlog）

- git 活动看板。
- 错误日志来源 / 设备组合筛选。
- 文档健康修复的自动定时巡检。
- 索引队列优先级与失败重试策略。
