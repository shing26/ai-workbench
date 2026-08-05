# 2026-08-05 Webhook 签名与自动重试评审

## 结论

- `webhook_signature` 基于 sha2 实现 HMAC-SHA256：密钥超块长先哈希、否则补零到 64 字节，再按 inner / outer pad 两次哈希输出 hex；RFC 4231 Test Case 1 已知答案单测通过。
- `deliver_webhook_http` 新增 secret / retries：签名非空时发送 `X-Webhook-Signature: sha256=<hex>` 与 `X-Webhook-Timestamp`；非 2xx 或网络错误按 `50ms << attempt`（上限 2^6 档）退避，返回 `attempts` 与 `signed`。
- `webhook_rules` 新增 `secret` / `retries` 列：新库由 SCHEMA 直接包含，旧库经 `migrate_webhook_secret_retries` ALTER TABLE 补齐；`WebhookRule` / `WebhookRuleInput` 完整读写，调度器与 `run_webhook_rule` 共用同一投递函数。
- `create_webhook_rule` Tauri 命令收敛为 `WebhookRuleRequest` 结构体参数；`db.ts` 相应改为 `request` 对象，clippy too-many-arguments 不再触发。
- SystemView Webhook 卡片新增 Signature secret 输入与 Retries 下拉；结果区展示 `data-webhook-attempts` / `data-webhook-signed`，规则行展示 retries 与 signed badge；浏览器 fallback 确定性返回 `retries + 1` 次。
- `cargo test --lib` 101/101（新增 HMAC 已知答案、签名头、重试链路、迁移单测），fmt、clippy、`npm run build`、`verify:ui` / `verify:preview` 全绿，`webhookSignRetry` 为 true。

## 风险与后续

- 签名实现为避免新增网络依赖未引入 hmac crate，仅用已在锁文件中的 sha2；已用 RFC 已知答案固定正确性，后续可无缝切回 `hmac` crate。
- 重试为阻塞式退避，占用调度线程；投递量大时可评估独立任务队列。
- 复杂触发器表达式、签名验签 UI、消息队列式死信重放继续留在 Backlog。
