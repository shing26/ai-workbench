# 04 — P0-4: HITL confirmations for unconfirmed batch ops

**What to build:** 为无确认批量操作补 HITL 确认/审批流，兑现"关键决策权在人"。

**Blocked by:** None — can start immediately.

**Status:** completed

**目标操作:** `clear_sync_audit`、`prune_webhook_deliveries`（手动 prune）、`archiveWeekDone`（批量归档）、`clear_vault_watch_events`、`clear_resolved_sync_conflicts`、webhook retention prune。

- [ ] 逐一为上述操作补二次确认（UI 层）或独立审批流（删除类走审批面板，非弹窗）
- [ ] 归档类补恢复入口（`archiveWeekDone` 后可从归档找回）
- [ ] `db.ts` / Rust 同构：确认参数或审批状态字段
- [ ] verify lane：无确认不执行；确认后执行；取消不执行

**Definition of Done:** 所有破坏性批量操作均有明确人工确认门槛。
