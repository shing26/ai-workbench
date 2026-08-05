# 2026-08-05 watch 目标级事件统计评审

## 结论

- `vault_watch_targets` 新增 `last_event_at` / `event_count`，`migrate_vault_watch_event_stats` 按列存在性幂等迁移，旧库无需重建。
- `touch_vault_watch_event` 使用 UPSERT：已有目标累加计数并更新最后事件时间，缺失路径自动补一条初始目标记录。
- `start_vault_watch_impl` 在 watch 事件写回成功后埋点，`vault_target_stats` 通过 `LEFT JOIN` 返回事件字段。
- Knowledge 每个目标行新增事件徽标；浏览器 fallback 在启动 watch 时模拟一次事件，与 Rust 观察到的计数语义一致。
- 验证覆盖：`cargo test --lib` 54/54，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言 `C:/vault` 与 `D:/vault` 事件数均为 1。

## 风险与后续

- 事件计数为累计值，清空 vault 不会重置；后续可提供按周/月统计。
- 计数只区分写回成功事件，忽略被 ignore 规则跳过的路径。
