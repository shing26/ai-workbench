# Sprint 98 计划：Webhook payload 模板变量与事件上下文

目标：让 Webhook 规则 payload 支持 `{{event}}`、`{{ts}}`、`{{context.<field>}}` 模板变量，定时、Run now 与事件触发三条投递链路在入队时统一渲染；System 视图可输入事件上下文 JSON 并预览渲染结果。

## Sprint 98 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | Rust 模板渲染 | 新增 `render_webhook_payload`：`{{event}}` / `{{ts}}` / `{{context.<field>}}` 展开为 JSON 值，缺失 context 字段展开为 `null`，未知占位符保留原文 |
| P2 | 投递链路接入 | 定时 worker、`run_webhook_rule`（Run now）、`trigger_webhook_event` 入队前统一渲染 payload |
| P3 | 浏览器 fallback | `db.ts` 新增同构 `renderWebhookPayload`；`triggerWebhookEvent` 接受可选 context 并透传 Tauri / 参与 fallback 渲染 |
| P4 | System UI | 事件触发器行新增 Context JSON 输入（`data-webhook-event-context`）、Preview payload 按钮（`data-webhook-payload-preview` / `data-webhook-payload-preview-text`），投递队列行展示渲染后 payload（`data-webhook-delivery-payload`） |
| P5 | 自动化验证 | Rust 单测覆盖变量渲染、缺失字段与无变量模板；`verify:ui` / `verify:preview` 新增 `webhookPayloadTemplate` lane |

## DoD 检查单

- [x] 模板约定明确：占位符展开为 JSON 值，模板写作 `"event":{{event}}`（占位符不带引号）。
- [x] 定时 / Run now / 事件触发三条链路入队 payload 均已渲染。
- [x] System 视图可输入事件上下文、预览渲染结果，投递队列可见最终 payload。
- [x] 浏览器 fallback 与 Rust 行为一致，缺失 context 字段为 `null`。
- [x] `npm run build`、Rust fmt/test/clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.98.0-alpha`。

## 范围外（Backlog）

- 不做条件分支 / 循环等高级模板语法；仅支持简单占位符替换。
- 不做 payload schema 校验与自动补全。
- 不做模板版本管理与跨设备同步的独立模板存储（payload 仍在规则内同步）。
