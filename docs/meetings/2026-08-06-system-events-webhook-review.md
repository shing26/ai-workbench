# 2026-08-06 系统事件总线接入 Webhook 评审

## 结论

- `db.ts` 新增 `emitWorkbenchEvent(event, context?)` 作为统一事件入口，内部复用 `triggerWebhookEvent`，Tauri 与浏览器 fallback 行为一致。
- 已接入四类系统事件：`clipboard.captured`、`error.reported`、`sync.completed`、`knowledge.indexed`，context 按事件携带最小必要字段。
- 投递写入后派发 `workbench:webhook-deliveries-updated`，SystemView 监听后立即刷新投递队列，5 秒轮询保留为兜底。
- `verify:ui` / `verify:preview` 新增 `webhookSystemEvents` lane：真实 Pull 触发 `sync.completed`，真实 `ErrorEvent` 触发 `error.reported`，DOM 中出现对应 payload 后断言通过。
- `npm run build`、`verify:ui`、`verify:preview` 全绿；本 Sprint 为纯前端改动，Rust 无变更。

## 排查记录

- 首版 error 断言失败并非事件链路错误：诊断显示 `error.reported` 投递与错误日志均已写入 localStorage，但 SystemView 的 5 秒轮询晚于断言 4 秒等待窗口。
- 修复方式：`emitWorkbenchEvent` 投递后派发 CustomEvent 让 SystemView 即时刷新，同时把 error 轮询窗口延长到 6 秒，测试与真实体验同时稳定。

## 风险与后续

- 事件 context 与 payload 模板是约定契约：字段缺失会渲染为 `null`，后续可加 schema 校验。
- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）按用户要求搁置，不纳入当前开发终点。
- 下一 Sprint 候选：真实 MOA 并行、前端 ESLint/Prettier + husky/lint-staged、AI Studio 会话增强。
