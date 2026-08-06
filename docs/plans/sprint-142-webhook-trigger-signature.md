# Sprint 142 计划：Webhook 复杂触发器条件与签名校验收发端

目标：把 Webhook 规则从“事件名等值 / 固定间隔”升级为可表达的条件触发：支持 `event == "..."`、`context.status == "ok"`、`cron(0 9 * * 1-5)` 以及 `and / or / not / 括号` 组合；同时在 System 收发端补齐签名校验面板，让接收方可以本地验证 `X-Webhook-Signature`。

## Sprint 142 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | 条件 DSL 与 cron | 新增 `src-tauri/src/webhook_condition.rs`：`validate_condition` 校验、`matches_condition(condition, event, context, now)` 求值；cron 支持 5 段（分 时 日 月 周）`*` / 数字 / `1-5` / `*/5` / `1-15/5` / 逗号列表，日与周同时受限时按标准 cron OR 语义匹配 |
| L2 | SQLite 迁移 | `webhook_rules` 新增 `trigger_condition TEXT NOT NULL DEFAULT ''`：新库 SCHEMA 直接建列，旧库 `migrate_webhook_trigger_condition` 幂等补列并加入 `init_connection` 迁移链；`WebhookRule` / `WebhookRuleInput` / `WEBHOOK_RULE_COLUMNS` / map / create / list 全程携带 |
| L3 | Tauri 命令 | `create_webhook_rule` 新增 `triggerCondition` 参数并在非空时校验；调度器 `spawn_webhook_delivery_worker` 对 due 规则按 cron / 条件过滤，`trigger_webhook_event` 对事件规则按条件过滤；新增 `verify_webhook_signature(secret, payload, signature)` 返回 `{ valid, expected, algorithm }`，复用 HMAC-SHA256 |
| L4 | TS 同构 | `db.ts` 新增 `triggerCondition` 字段与参数、`verifyWebhookSignature`（Tauri invoke + Web Crypto HMAC-SHA256 fallback）、`validateWebhookCondition` / `matchesWebhookCondition` / cron 同构实现；`triggerWebhookEvent` fallback 按条件过滤并保留冷却语义 |
| L5 | System UI | 规则表单新增 `data-webhook-rule-condition-input`（placeholder 示例条件 / cron），规则行新增 `data-webhook-rule-condition` 徽标；Webhook 卡片新增签名校验区：`data-webhook-sig-payload` / `data-webhook-sig-secret` / `data-webhook-sig-signature` / `data-webhook-sig-verify` / `data-webhook-sig-result` |
| L6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookTriggerCondition` / `webhookSignatureVerify` lane；Rust 单测覆盖 cron 匹配、条件表达式正反例、签名校验 valid/invalid/前缀兼容 |
| L7 | 文档更新 | BACKLOG 移除该项并记入已完成，RETRO / ARCHITECTURE / DATABASE 同步；提交合入 develop |

## DoD 检查单

- [x] 事件规则可按 `event == / !=`、`context.field == / != / > / <`、`and / or / not` 组合过滤，条件不满足不入队。
- [x] 定时规则支持 `cron(分 时 日 月 周)`，Rust 调度 worker 只在 cron 命中且到期间隔时投递。
- [x] System 签名校验面板对 `sha256=<hex>` 与裸 hex 均可验证，浏览器 fallback 与 Rust 结果一致。
- [x] `verify:ui` / `verify:preview` 的 `webhookTriggerCondition` / `webhookSignatureVerify` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Webhook 多通道投递（邮件 / 系统通知）与熔断恢复指数退避调度，继续留在候选池。
- 事件总线持久化 event log、schema 校验与跨设备转发，继续留在候选池。
- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
