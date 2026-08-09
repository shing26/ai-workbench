# 2026-08-05 Webhook 真实投递评审

## 结论

- Rust 新增 `WebhookDeliveryResult` 与 `deliver_webhook(url, payload, method?, token?)` Tauri 命令：默认 POST，支持 POST / PUT / PATCH / GET / DELETE；POST / PUT / PATCH 带 `Content-Type: application/json`，token 非空时带 `Authorization: Bearer`，payload 必须是合法 JSON。
- System 视图新增 Webhook delivery 卡片：URL / method / token / JSON payload 输入，Deliver 按钮带 `data-webhook-deliver`，结果带 `data-webhook-result` 并回显 HTTP 状态、耗时与响应摘要。
- `db.ts` 新增 `deliverWebhook`，浏览器 fallback 返回确定性 `HTTP 200` mock；Rust 本地 TCP 单测覆盖真实 POST、JSON body、Authorization header 与 400 状态回显。
- `cargo test --lib` 88/88，fmt、clippy、`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `webhookDelivery` 均为 true。

## 风险与后续

- 当前只支持一次手动投递；定时调度 / 触发器规则与签名校验留在 Backlog，作为下一阶段候选。
- 真实网络行为由 Rust 本地 TCP 单测覆盖，桌面端后续可用真实 URL 继续联调。
