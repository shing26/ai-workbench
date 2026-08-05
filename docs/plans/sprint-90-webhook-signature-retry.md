# Sprint 90 计划：Webhook 签名与自动重试

目标：把 System 的 Webhook 投递从单一请求升级为企业级投递策略：可选 HMAC-SHA256 签名头（`X-Webhook-Signature: sha256=<hex>` 与 `X-Webhook-Timestamp`），失败时按指数退避自动重试；定时规则持久化 secret 与 retries，调度器与手动 Run now 共用同一投递策略。

## Sprint 90 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 签名实现 | 新增 `webhook_signature(secret, payload)`：用 sha2 按 HMAC-SHA256 构造签名并输出 hex；RFC 4231 已知答案单测保证正确性 |
| A2 | 投递重试 | `deliver_webhook_http` 增加 secret / retries 参数：签名非空时带签名与时间戳头；非 2xx 或网络错误按 `50ms << attempt` 退避重试，结果返回 attempts / signed |
| A3 | 数据库模型 | `webhook_rules` 新增 `secret TEXT DEFAULT ''`、`retries INTEGER DEFAULT 1`；新库走 SCHEMA，旧库走 `migrate_webhook_secret_retries`；`WebhookRule` / `WebhookRuleInput` 覆盖读写 |
| A4 | Tauri 命令 | `deliver_webhook` 接受 secret / retries；`create_webhook_rule` 收敛为 `WebhookRuleRequest` 结构体参数，避免 clippy too-many-arguments |
| A5 | TS API | `db.ts` 新增 secret / retries 参数与 `attempts` / `signed` 返回字段；浏览器 fallback 确定性返回 `retries + 1` 次与签名标记 |
| A6 | 前端交互 | SystemView Webhook 卡片新增 `data-webhook-secret` / `data-webhook-retries`；结果区展示 attempts / signed；规则行展示 retries 与 signed badge |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookSignRetry` lane：设置 secret + 2 次重试 → 投递结果 attempts=3 / signed → 建规则并断言持久化 secret / retries |

## DoD 检查单

- [x] `cargo fmt`、`cargo clippy --lib -- -Dwarnings`、`cargo test --lib` 全绿（101/101）。
- [x] `npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `webhookSignRetry` 均为 true。
- [x] Rust 单测覆盖 HMAC 已知答案、签名头、3 次重试链路与旧库迁移。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.90.0-alpha`。

## 范围外（Backlog）

- 不做 Webhook 触发器的复杂条件表达式（cron、事件类型匹配）与签名校验收发端 UI；继续留在 Backlog。
- 不做消息队列式投递（持久化待投递队列、死信重放）；继续留在 Backlog。
- 不做真实 Provider 端到端流式联调；继续留在 Backlog。
