# Sprint 99 计划：系统事件总线接入 Webhook 事件触发器

目标：把工作台关键生命周期事件通过统一入口接入 Webhook 事件触发器，投递写入后实时刷新 System 投递面板，形成可观察、可扩展的系统事件总线。

## Sprint 99 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | 统一事件入口 | `db.ts` 新增 `emitWorkbenchEvent(event, context?)`，内部复用 `triggerWebhookEvent`，投递写入后派发 `workbench:webhook-deliveries-updated` |
| P2 | 剪贴板事件 | `captureClipboard` 与 Tauri `clipboard-updated` 监听链路触发 `clipboard.captured` |
| P3 | 错误事件 | `reportFrontendError` 触发 `error.reported`，context 包含 `source / message / severity / deviceId` |
| P4 | 同步事件 | `import / importEncrypted / push / pull` 完成后触发 `sync.completed`，context 包含 `action / deviceId` |
| P5 | 知识索引事件 | `indexVault` 触发 `knowledge.indexed`，context 包含 vault 与文件统计 |
| P6 | UI 实时刷新 | SystemView 监听 `workbench:webhook-deliveries-updated` 后立即重新加载投递队列，保留 5 秒兜底轮询 |
| P7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookSystemEvents` lane：真实 Pull 触发 `sync.completed`，真实 `ErrorEvent` 触发 `error.reported`，校验 payload 与 DOM 投递展示 |

## DoD 检查单

- [x] 事件入口统一：所有系统事件经 `emitWorkbenchEvent` 入队，不散落直接调用 `triggerWebhookEvent`。
- [x] 已接入事件覆盖剪贴板、错误、同步、知识索引四类生命周期。
- [x] System 投递面板在事件入队后即时刷新，不依赖最长 5 秒的轮询等待。
- [x] `verify:ui` / `verify:preview` 的 `webhookSystemEvents` lane 端到端通过。
- [x] `npm run build`、`verify:ui`、`verify:preview` 全绿；本 Sprint 无 Rust 改动。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.99.0-alpha`。

## 范围外（Backlog）

- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）两块未启动大模块暂时搁置，后续有需要再开发。
- 事件总线暂不做持久化 event log、事件 schema 校验与跨设备事件转发。
- 自动化规则仍聚焦 Webhook，不做邮件 / 系统通知等多通道投递。
