# Sprint 138 计划：Webhook 自动熔断

目标：把 System 的 Webhook 规则从“失败只记录”升级为带自动熔断的投递策略：连续失败达到阈值后自动停用规则，成功清零计数，手动重新启用时重置计数，避免故障端点被调度器反复击打。

## Sprint 138 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| B1 | 数据模型 | `webhook_rules` 新增 `consecutive_failures INTEGER NOT NULL DEFAULT 0` 与 `auto_disable_after INTEGER NOT NULL DEFAULT 3`；新库 SCHEMA 直接建列，旧库 `migrate_webhook_circuit_breaker` 幂等补列，并加入 `init_connection` 迁移链 |
| B2 | 熔断状态机 | `db::record_webhook_rule_outcome` 按真实投递结果更新规则：2xx 清空连续失败，非 2xx / 网络错误累加；达到 `auto_disable_after` 时 `enabled = 0` 并写入 `Auto-disabled after N consecutive failures`；`auto_disable_after = 0` 表示不自动停用 |
| B3 | 手动启用重置 | `set_webhook_rule_enabled(true)` 同时把 `consecutive_failures` 清零，让重新启用的规则从干净状态开始 |
| B4 | 双链路接入 | `run_webhook_rule_inner` 与 `spawn_webhook_delivery_worker` 终态（success / dead）都调用同一熔断函数；入队时的 202 标记只更新 last_run_at，不干扰失败计数 |
| B5 | TS API | `db.ts` 的 `WebhookRule` 携带 `consecutiveFailures` / `autoDisableAfter`；`createWebhookRule` 支持 `autoDisableAfter`；fallback 按 URL 含 `/fail` 模拟失败，执行与 Rust 相同的累加 / 清零 / 自动停用语义 |
| B6 | 前端交互 | SystemView 表单新增 `data-webhook-rule-auto-disable` 输入；规则行新增 `data-webhook-rule-failures` 与 `data-webhook-rule-auto-disable` 徽标，展示连续失败数与熔断阈值 |
| B7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookRuleCircuitBreaker` lane：种子连续失败 2 次的规则，Run now 后断言 failures=3、enabled=false、lastMessage 含 Auto-disabled；成功规则清零；重新启用后计数重置；表单创建 autoDisableAfter=2 的规则并两次失败触发停用 |
| B8 | Rust 单测 | 覆盖迁移补列、成功清零、失败累加、达到阈值自动停用、`auto_disable_after = 0` 不熔断、重新启用重置计数 |

## DoD 检查单

- [x] 连续失败计数与自动停用正确，成功与重新启用都会重置。
- [x] 定时调度与事件投递的终态都走同一熔断函数，202 入队标记不误改计数。
- [x] `verify:ui` / `verify:preview` 的 `webhookRuleCircuitBreaker` lane 双端通过。
- [x] `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib` 全绿。
- [ ] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
- 不做失败告警（邮件 / 桌面通知）与熔断恢复的指数退避调度；只做自动停用与手动恢复。
