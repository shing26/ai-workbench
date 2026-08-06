# Sprint 143 计划：Webhook 多通道投递与熔断恢复指数退避

目标：把 Webhook 投递从单一 HTTP 通道升级为多通道（HTTP / 邮件 / 系统通知），并在熔断后按指数退避自动探测恢复，让关键事件不会因为单一通道失败而完全丢失。

## Sprint 143 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | 多通道数据模型 | `webhook_rules` 新增 `channels TEXT NOT NULL DEFAULT '["http"]'`、`recovery_backoff_seconds INTEGER NOT NULL DEFAULT 300`、`circuit_opened_at INTEGER NOT NULL DEFAULT 0`；新库 SCHEMA 直接建列，旧库幂等迁移加入 `init_connection`；`WebhookRule` / `WebhookRuleInput` 全程携带 |
| L2 | 投递 channel | `webhook_deliveries` 新增 `channel TEXT NOT NULL DEFAULT 'http'`；`enqueue_webhook_delivery_channel` 支持按通道入队，原 `enqueue_webhook_delivery` 保持 HTTP 默认；调度器与事件触发按规则 `channels` 逐通道入队 |
| L3 | 通道配置 | 新增 `webhook_channel_config` 单行表：email_enabled / email_from / email_to / smtp_host / smtp_port / smtp_user / smtp_password / notification_enabled / notification_title / updated_at；新增 get / set Tauri 命令与浏览器 fallback |
| L4 | 邮件 / 系统通知投递 | Rust 用 `lettre` SMTP 发邮件（builder_dangerous 明文 SMTP，测试用本地 mock server），系统通知通过 `webhook-notification` Tauri 事件 + 前端 Notification API；浏览器 fallback 同构模拟并触发本地通知事件 |
| L5 | 熔断恢复调度 | 熔断触发时写 `circuit_opened_at`；worker 按 `recovery_backoff_seconds * 2^failures`（封顶 24h）对开启熔断的规则做 HTTP 探测，成功自动恢复 enabled / 清零失败计数，失败重置计时继续退避；新增 `probe_webhook_recovery` 命令 |
| L6 | System UI | Webhook 规则表单新增通道多选与恢复退避输入、规则行通道/恢复徽标；Webhook 卡片新增 Channel settings 面板（SMTP / 邮件收件人 / 通知标题 / 保存与测试）与 Recovery probe 按钮；投递列表展示 channel 徽标 |
| L7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookMultiChannel` / `webhookRecoveryBackoff` lane；Rust 单测覆盖通道解析、迁移、SMTP mock、通知事件、恢复退避计算与探测成功 / 失败 |
| L8 | 文档更新 | BACKLOG 移除该项并记入已完成，RETRO / ARCHITECTURE / DATABASE 同步；提交合入 develop |

## DoD 检查单

- [x] 规则可选择 http / email / notification 多通道，事件与定时触发按通道分别入队并在投递列表区分。
- [x] 邮件通道通过 SMTP 配置真实发信（测试覆盖 mock SMTP），系统通知在 Tauri 与浏览器双端可触发。
- [x] 熔断后按指数退避自动探测恢复，成功恢复规则，失败继续退避；`probe_webhook_recovery` 可手动触发。
- [x] `verify:ui` / `verify:preview` 的 `webhookMultiChannel` / `webhookRecoveryBackoff` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- 事件总线持久化 event log、schema 校验与跨设备转发，继续留在候选池。
- Webhook payload 高级模板（条件分支 / 循环）、schema 校验与模板版本管理，继续留在候选池。
- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
