# 2026-08-06 Webhook payload 模板变量评审

## 结论

- Rust 新增 `render_webhook_payload`：`{{event}}` / `{{ts}}` / `{{context.<field>}}` 展开为 JSON 值，缺失 context 字段展开为 `null`，未知占位符保留原文，保证渲染结果仍是合法 JSON。
- 三条投递链路全部接入渲染：定时 worker 入队、`run_webhook_rule`（Run now）、`trigger_webhook_event`（事件名 + 调用方 context）在入队 / 投递前统一生成最终 payload。
- `db.ts` 新增同构 `renderWebhookPayload` 与 `triggerWebhookEvent(event, context?)`：Tauri 侧透传 context，浏览器 fallback 用同一模板规则渲染后写入投递队列。
- SystemView 事件触发器行新增 Context JSON 输入（`data-webhook-event-context`）与 Preview payload 按钮（`data-webhook-payload-preview` / `data-webhook-payload-preview-text`）；投递队列行新增渲染后 payload 展示（`data-webhook-delivery-payload`）。
- `verify:ui` / `verify:preview` 新增 `webhookPayloadTemplate` lane：模板 `{"event":{{event}},"ts":{{ts}},"note":{{context.note}},"count":{{context.count}},"kept":"plain"}` 在预览与触发投递后均渲染为完整 JSON；dev 与生产构建全绿，Rust 112 个单测通过，clippy 零告警。

## 风险与后续

- 模板约定是占位符展开为 JSON 值，作者不应在占位符外再包引号；Preview 按钮可即时校验。
- 缺失 context 字段固定为 `null`，避免产生非法 JSON；若需要强制必填，后续可加 schema。
- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、真实 MOA 并行、系统事件总线接入。
