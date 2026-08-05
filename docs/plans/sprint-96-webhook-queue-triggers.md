# Sprint 96 计划：Webhook 事件触发器与投递队列

目标：让 Webhook 规则除了定时触发，还能按 `trigger_event` 事件驱动入队；新增持久化投递队列 `webhook_deliveries`，定时与事件投递统一由后台 worker 消费，失败按指数退避重试，超限进入 dead 并支持人工 Retry / Delete / Clear。

## Sprint 96 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | 事件触发字段 | `webhook_rules` 新增 `trigger_event` 列，新库 SCHEMA 建列，旧库 `migrate_webhook_trigger_event` 幂等补列；`WebhookRule` 结构体 / 类型 / 命令全部带 `triggerEvent` |
| P2 | 投递队列模型 | 新增 `webhook_deliveries` 表与 `WebhookDelivery` 模型，状态 `queued / delivering / success / dead`，含 `attempts`、`next_attempt_at` 与 due / rule 索引 |
| P3 | Rust worker | `spawn_webhook_scheduler` 改为 `spawn_webhook_delivery_worker`：定时规则先入队，`claim_due_webhook_deliveries` 最多取 8 条消费；失败按 `1000ms << attempts` 指数退避，超过 `retries + 1` 次标记 dead |
| P4 | Tauri 命令 | 新增 `trigger_webhook_event` / `list_webhook_deliveries` / `retry_webhook_delivery` / `delete_webhook_delivery` / `clear_webhook_deliveries` 并注册；`trigger_webhook_event` 只匹配 enabled 的事件规则 |
| P5 | 前端 UI | SystemView 新增事件触发输入、快捷按钮与投递队列面板；浏览器 fallback 使用 `ai-workbench:webhook-deliveries:v1` 持久化同一模型 |
| P6 | 自动化验证 | Rust 单测覆盖迁移与队列生命周期；`verify:ui` / `verify:preview` 新增 `webhookQueueEvent` lane |

## DoD 检查单

- [x] 新库建表含 `webhook_rules.trigger_event`，旧库迁移幂等且不丢数据。
- [x] `list_due_webhook_rules` 只选 `trigger_event = ''` 的定时规则，事件规则由 `list_event_webhook_rules` 匹配。
- [x] 定时与事件投递统一走 `webhook_deliveries` 队列，worker 消费并回写 attempts / status / last_message。
- [x] System 投递队列支持 Retry / Delete / Clear dead，浏览器 fallback 行为一致。
- [x] `npm run build`、Rust fmt/test/clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.96.0-alpha`。

## 范围外（Backlog）

- 不做 payload 模板变量与上下文合并；事件触发暂用规则 payload 或调用方传入的完整 context JSON。
- 不做队列历史自动清理与保留策略；dead 清理由用户显式触发。
- 不做事件总线扩展；内置快捷事件保持 `sync.completed` 等少量示例。
