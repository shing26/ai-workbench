# Sprint 57 计划：watch 事件类型细分

目标：把 vault watch 的累计事件拆成新增 / 修改 / 删除三类，让 Knowledge 目标行能直接看出 vault 正在发生哪种变更。

## Sprint 57 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 数据模型 | `vault_watch_targets` 新增 `created_events` / `modified_events` / `removed_events`，旧库幂等补列 |
| A2 | 事件埋点 | `touch_vault_watch_event(path, event_kind)` 按类型累计，event_count 仍为总数 |
| A3 | 统计透传 | `VaultTargetStats` 返回三类计数，`vault_target_stats` LEFT JOIN 带出 |
| A4 | 前端展示 | Knowledge 目标行显示 `+N` / `~N` / `-N` 徽标，fallback 启动 watch 模拟一次 created |
| A5 | 单元测试 | 三类事件计数、默认 0、stats 透传 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言 created > 0 且 modified/removed 为 0 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 迁移幂等补三列，created/modified/removed 计数与 event_count 一致。
- [x] Knowledge 目标行展示三类事件徽标，fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 的 `vaultTargetStats.created` 均 > 0，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.57.0-alpha`。

## 范围外（Backlog）

- 索引任务队列（同时只跑一个任务）。
- 结构化合并的对象数组按 key 去重。
- 审计按日/周聚合图表。
- watch 事件明细日志（时间线）。
