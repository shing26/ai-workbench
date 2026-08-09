# Sprint 134 计划：Webhook 投递保留策略

目标：为 `webhook_deliveries` 增加可配置保留策略：按天数清理 success / dead 终态记录，按最大条数裁剪最旧终态记录，支持自动清理开关与手动 Run cleanup，避免投递队列无限增长。

## Sprint 134 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 保留配置 | SQLite 新增 `webhook_retention_config` 单行表（retention_days / max_records / auto_cleanup / updated_at），Rust 提供 get / set，默认 30 天 / 200 条 / 自动开启，参数做上下限钳制 |
| R2 | 清理函数 | `prune_webhook_deliveries` 按天数删除过期 success / dead，再按 max_records 裁剪最旧终态记录；queued / delivering 永不按年龄删除，返回 removedByAge / removedByCount / totalRemoved |
| R3 | 调度与命令 | delivery worker 在 auto_cleanup 开启时每轮自动清理；新增 `prune_webhook_deliveries` / `get_webhook_delivery_stats` Tauri 命令 |
| R4 | 前端面板 | SystemView Webhook 卡片新增保留策略区：天数 / 条数输入、Auto 开关、Save、Run cleanup、统计徽标与结果文本，含 `data-webhook-retention-*` 锚点 |
| R5 | 浏览器 fallback | `db.ts` 新增同构 `WebhookRetentionConfig` / get / set / prune / stats，localStorage key 为 `ai-workbench:webhook-retention:v1` |
| R6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookRetention` lane：种子旧终态记录后 Save 配置并 Run cleanup，断言按年龄 / 条数删除数量、剩余记录与持久化；Rust 单测覆盖配置默认值、钳制、年龄与条数裁剪 |

## DoD 检查清单

- [x] 保留策略可配置并持久化，默认值安全（30 天 / 200 条 / 自动开启）。
- [x] 自动清理接入 worker，手动 Run cleanup 立即可用。
- [x] 双端 lane 覆盖年龄 / 条数裁剪与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
