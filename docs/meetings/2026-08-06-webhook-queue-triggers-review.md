# 2026-08-06 Webhook 事件触发器与投递队列评审

## 结论

- `webhook_rules` 新增 `trigger_event TEXT DEFAULT ''`：新库 SCHEMA 直接建列，旧库 `migrate_webhook_trigger_event` 幂等补列；`list_due_webhook_rules` 只选 `trigger_event = ''` 的定时规则，新增 `list_event_webhook_rules` 按事件匹配 enabled 规则。
- 新增持久化投递队列 `webhook_deliveries`：`queued / delivering / success / dead` 四种状态、`attempts`、`next_attempt_at`，带 `(status, next_attempt_at)` 与 `(rule_id)` 两个索引；删除规则时级联清理其投递记录。
- Rust 后台改为 `spawn_webhook_delivery_worker`：每秒先检查定时规则并统一入队，再 `claim_due_webhook_deliveries` 最多取 8 条消费；失败按 `1000ms << attempts` 指数退避，超过 `retries + 1` 次标记 dead，不再由调度循环直接阻塞投递。
- 新增 Tauri 命令 `trigger_webhook_event` / `list_webhook_deliveries` / `retry_webhook_delivery` / `delete_webhook_delivery` / `clear_webhook_deliveries`；`list_webhook_deliveries` 的 limit 收敛到 1~200。
- SystemView 新增事件触发输入（`data-webhook-rule-trigger-input`）、快捷按钮与投递队列面板（`data-webhook-deliveries` / `data-webhook-delivery-item` / `data-webhook-delivery-status` / `data-webhook-delivery-attempts` / `data-webhook-delivery-retry` / `data-webhook-delivery-delete` / `data-webhook-delivery-clear`），每 5 秒刷新规则与队列。
- 浏览器 fallback 使用 `ai-workbench:webhook-deliveries:v1` 保存同一模型：`triggerWebhookEvent` 对匹配 enabled 规则直接生成 success 记录，Retry 重置为 queued / attempts 0，支持 delete / clear。
- `verify:ui` / `verify:preview` 新增 `webhookQueueEvent` lane：创建事件规则 → 断言 event 徽标 → 触发 `sync.completed` → 断言 success → Retry 后 queued 且 `0/3` → Delete 后消失；dev 与生产构建全绿，Rust 109 个单测通过，clippy 零告警。

## 风险与后续

- 事件触发暂不合并 payload 模板变量：`trigger_webhook_event` 只接受完整 context JSON 覆盖，字段级模板拼接留在 Backlog。
- 队列没有自动保留策略，dead 记录需要用户 Retry / Delete / Clear；后续可加天数与数量上限。
- 内置事件仍是快捷按钮示例，尚未接真正的应用事件总线；后续可把同步完成、索引完成、每日复盘等系统事件接入。
