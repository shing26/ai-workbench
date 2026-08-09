# 2026-08-05 watch 事件类型细分评审

## 结论

- `vault_watch_targets` 新增 `created_events` / `modified_events` / `removed_events`，迁移按列存在性幂等补列，旧库自动升级。
- `touch_vault_watch_event` 改为接收 `event_kind`，`created` / `modified` / `removed` 分别累计，`event_count` 继续作为总数。
- lib.rs watcher 从 `EventKind::Create / Modify / Remove` 映射事件类型，Knowledge 目标行显示 `+N` / `~N` / `-N` 徽标。
- 验证覆盖：`cargo test --lib` 63/63，fmt、clippy、build 全绿；两条 lane 的 `created` 均为 1、`modified` / `removed` 均为 0。

## 风险与后续

- 事件类型按 notify 的单次 event 判定，批量变更可能被拆成多条记录，不影响累计口径。
- 当前只统计数量，不保存文件路径明细；后续可加事件时间线。
