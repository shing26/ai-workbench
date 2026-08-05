# Sprint 52 计划：watch 目标级事件统计

目标：为每个 vault watch 目标记录最近事件时间与累计事件数，Knowledge 目标行展示事件量，让用户确认哪些 vault 正在活跃同步。

## Sprint 52 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 数据模型 | `vault_watch_targets` 新增 `last_event_at` / `event_count`，旧库幂等 ALTER 迁移 |
| A2 | 事件埋点 | watch 事件写回成功后调用 `touch_vault_watch_event` 累加计数并更新时间 |
| A3 | 统计透传 | `VaultTargetStats` 返回事件字段，`vault_target_stats` LEFT JOIN targets 表 |
| A4 | 前端展示 | Knowledge 每个目标行显示 `N events` 与 `data-vault-target-events`，fallback watch 模拟一次事件 |
| A5 | 单元测试 | 覆盖默认 0、两次 touch 后计数 2、stats 事件字段 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言两个目标 events 均大于 0 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 事件计数与迁移单测通过，stats 返回事件字段。
- [x] Knowledge 目标行展示事件数，浏览器 fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 新增事件统计断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.52.0-alpha`。

## 范围外（Backlog）

- 索引进度事件与可取消队列。
- 结构化文档（Markdown/JSON）的字段级三方合并。
- 自定义审计日期范围。
- watch 事件按文件类型的细分统计。
