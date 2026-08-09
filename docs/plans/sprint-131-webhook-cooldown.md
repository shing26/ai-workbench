# Sprint 131 计划：Webhook 事件规则冷却期

目标：为事件型 Webhook 规则新增 `cooldown_seconds` 冷却期：规则触发后从 `last_run_at` 起 N 秒内抑制重复投递，避免高频事件（如 `error.reported`）反复刷屏，Tauri SQLite 与浏览器 fallback 同构。

## Sprint 131 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 表结构 | `webhook_rules` 新增 `cooldown_seconds INTEGER NOT NULL DEFAULT 0`，新库 SCHEMA 直接建列，旧库 `migrate_webhook_cooldown` 幂等补列 |
| R2 | 模型链路 | `WebhookRule` / `WebhookRuleInput` / `WebhookRuleRequest` 全部带 `cooldownSeconds`，create 写入并 clamp >= 0 |
| R3 | 触发抑制 | `list_event_webhook_rules` 增加 `now_ms` 参数，过滤 `last_run_at = 0 OR now - last_run_at >= cooldown_seconds * 1000`；`trigger_webhook_event` 命中后更新规则 `last_run_at` |
| R4 | 浏览器同构 | `db.ts` 的 `createWebhookRule` 带 `cooldownSeconds`，`triggerWebhookEvent` fallback 按 `lastRunAt` 过滤并写回规则 |
| R5 | System UI | 规则编辑区新增 `data-webhook-rule-cooldown` 输入，事件规则列表展示 `data-webhook-rule-cooldown-badge` |
| R6 | 自动化验证 | Rust 单测新增冷却期抑制与迁移测试；`verify:ui` / `verify:preview` 新增 `webhookRuleCooldown` lane |
| R7 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 新库建列、旧库迁移幂等且不丢数据。
- [x] 事件规则冷却期内重复触发不产生新投递，冷却期结束后恢复。
- [x] 浏览器 fallback 与 Rust 触发语义一致。
- [x] System 规则编辑器可配置冷却期并展示徽标。
- [x] 双端 lane 与 Rust 单测覆盖冷却抑制与迁移。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
