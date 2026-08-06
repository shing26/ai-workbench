# Sprint 139 计划：Webhook 规则执行日志与失败告警

目标：为 Webhook 规则补齐可追溯的执行日志：每次手动 Run、定时调度、事件投递的终态都写入运行记录，System 视图展示最近运行与失败告警，方便定位故障端点与自动化诊断。

## Sprint 139 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | 运行记录表 | 新增 `webhook_rule_runs` 表（id / rule_id / kind / status / http_status / attempts / message / created_at）+ 索引；新库 SCHEMA 自动建表，`record_webhook_rule_run` 写入后按规则裁剪保留最近 50 条 |
| L2 | 记录链路 | `run_webhook_rule_inner` 记录 `manual` 成功 / 失败；delivery worker 的 success / dead 终态记录 `scheduled` / `event` 运行，含 http_status、attempts、message |
| L3 | 查询命令 | 新增 Tauri 命令 `list_webhook_rule_runs(rule_id?, limit?)`，按 `created_at DESC` 返回 |
| L4 | TS API | `db.ts` 新增 `WebhookRuleRun` 与 `listWebhookRuleRuns`，浏览器 fallback 用 `ai-workbench:webhook-rule-runs:v1` 持久化，`runWebhookRule` / `triggerWebhookEvent` 写入同构记录并裁剪 |
| L5 | 前端展示 | SystemView Webhook 卡片新增 Run log 区：`data-webhook-rule-runs` 列表、`data-webhook-rule-run-item` 行、status / http / attempts / message / time 徽标；最近 24h 有失败时展示 `data-webhook-rule-fail-alert` 告警条 |
| L6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookRuleRunLog` lane：种子规则与 3 条运行记录，断言列表、failed 徽标、告警条；Run now 后断言新增 manual 运行与 DOM 刷新 |
| L7 | Rust 单测 | 覆盖记录写入、按规则查询、成功 / 失败 status、裁剪保留最近 50 条 |

## DoD 检查单

- [x] 手动、定时、事件三种投递路径都会写入运行日志，System 可查看最近运行。
- [x] 最近 24h 失败运行以告警条提示，Run now 会即时追加日志。
- [x] `verify:ui` / `verify:preview` 的 `webhookRuleRunLog` lane 双端通过。
- [x] `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE / BACKLOG 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
- 不做邮件 / 桌面通知通道与熔断恢复指数退避调度；继续留在候选池。
