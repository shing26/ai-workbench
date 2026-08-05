# 2026-08-05 Webhook 定时器 / 触发器规则评审

## 结论

- 新增 `webhook_rules` 表与 `WebhookRule` 数据模型，`list_webhook_rules` / `create_webhook_rule` / `set_webhook_rule_enabled` / `delete_webhook_rule` / `get_webhook_rule` / `list_due_webhook_rules` / `mark_webhook_rule_run` 覆盖 CRUD、due 判定与状态回写。
- `spawn_webhook_scheduler` 后台线程每秒检查 enabled 规则，`now - last_run_at >= interval_seconds * 1000` 时真实投递并写回 `last_run_at / last_status / last_message`；新增 5 个 Tauri 命令。
- System Webhook delivery 卡片新增 Scheduled rules 区：规则名 / 间隔输入、Save rule、规则列表、Enable / Disable、Run now、Delete；`db.ts` fallback 持久化到 `ai-workbench:webhook-rules:v1`。
- `cargo test --lib` 90/90，fmt、clippy、`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `webhookRules` 均为 true。

## 风险与后续

- 当前只支持固定间隔定时；基于剪贴板 / 错误日志 / 时间窗口的复杂触发器条件留在 Backlog。
- Webhook 签名校验与失败重试策略留在下一阶段候选池。
