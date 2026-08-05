# Sprint 84 计划：Webhook 定时器 / 触发器规则

目标：把 Sprint 83 的手动 Webhook 投递升级为可持久化、可调度的定时规则。System 视图可创建规则（名称 / URL / payload / method / token / 间隔），Rust 后台每秒检查到期规则并真实投递，结果回写规则状态。

## Sprint 84 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 数据模型 | 新增 `webhook_rules` 表（id / name / url / payload / method / token / interval_seconds / enabled / last_run_at / last_status / last_message / created_at / updated_at）；`list_webhook_rules` / `create_webhook_rule` / `set_webhook_rule_enabled` / `delete_webhook_rule` / `get_webhook_rule` / `list_due_webhook_rules` / `mark_webhook_rule_run` |
| A2 | Rust 调度 | 新增 Tauri 命令 `list_webhook_rules` / `create_webhook_rule` / `set_webhook_rule_enabled` / `delete_webhook_rule` / `run_webhook_rule`；后台 `spawn_webhook_scheduler` 每秒检查到期规则并投递，写回状态 |
| A3 | TS fallback | `db.ts` 新增 `WebhookRule` 与 CRUD / `runWebhookRule`，浏览器 fallback 用 `ai-workbench:webhook-rules:v1` 持久化并返回确定性 `HTTP 200` mock |
| A4 | System UI | Webhook delivery 卡片新增 Scheduled rules 区：规则名 / 间隔输入、Save rule（`data-webhook-rule-save`）、规则列表（`data-webhook-rule-item`）、Enable / Disable、Run now、Delete |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookRules` lane：创建 / 持久化 / 开关 / Run now / 删除全链路；Rust 单测覆盖 CRUD、due 选择、真实投递后状态回写 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、`npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `webhookRules` 为 true。
- [x] Rust 单测覆盖 webhook_rules CRUD、due 选择与投递状态回写。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.84.0-alpha`。

## 范围外（Backlog）

- 不新增基于剪贴板 / 错误日志 / 时间窗口的复杂触发器条件；只做固定间隔定时。
- 不新增 Webhook 签名校验与失败重试策略。
