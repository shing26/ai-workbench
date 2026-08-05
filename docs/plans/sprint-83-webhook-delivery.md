# Sprint 83 计划：Webhook 真实投递

目标：把 Webhook 从“不可执行”升级为真实 HTTP 投递。System 视图输入 URL / JSON payload / Bearer token，点击后由 Rust 发送真实请求并回显 HTTP 状态、耗时与响应摘要。

## Sprint 83 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 命令 | 新增 `deliver_webhook(url, payload, method?, token?)`：默认 POST，支持 POST / PUT / PATCH / GET / DELETE；payload 必须是合法 JSON；POST / PUT / PATCH 带 `Content-Type: application/json`，token 非空时带 `Authorization: Bearer`；返回 `WebhookDeliveryResult { ok, status, durationMs, message }`；注册 Tauri 命令 |
| A2 | TS fallback | `db.ts` 新增 `WebhookDeliveryResult` 与 `deliverWebhook`，Tauri 走 invoke，浏览器 fallback 返回确定性的 `HTTP 200` mock 结果 |
| A3 | System UI | System 视图新增 Webhook delivery 卡片：URL / method / token / JSON payload 输入与 Deliver 按钮（`data-webhook-deliver`），结果回显 `data-webhook-result` |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookDelivery` lane；Rust 本地 TCP 单测覆盖真实 HTTP POST、JSON body 与 Authorization header |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、`npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `webhookDelivery` 为 true。
- [x] Rust 单测覆盖真实 HTTP POST、JSON body 与 Authorization header。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.83.0-alpha`。

## 范围外（Backlog）

- 不新增自动化规则 / 触发器；Webhook 定时调度、失败重试与签名校验留在下一阶段候选池。
