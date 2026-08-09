# 2026-08-05 同步审计与事件日志评审

## 结论

- 新增 `sync_audit_log` 表：自增 id、event、detail、device_id、created_at，created_at 倒序索引；`append_sync_audit` / `list_sync_audit(limit)` / `clear_sync_audit` 覆盖写入、查询与清理。
- 埋点覆盖同步主链路：`merge_sync_snapshot` 记录 `sync.merge`（clips/logs 增减与冲突数），`resolve_conflict` 记录 `sync.resolve`，`resolve_conflicts` 额外记录 `sync.resolve.batch`，`clear_resolved_sync_conflicts` 记录 `sync.history.cleared`。
- Tauri 新增 `list_sync_audit(limit)` / `clear_sync_audit`，limit clamp 1~200；System Sync snapshot 卡片新增 Sync audit 面板（事件名、详情、时间、Clear），同步操作后自动刷新。
- 单测覆盖 merge / resolve / clear 三类事件与清空；`cargo test --lib` 46/46，fmt、clippy、build 全绿。
- `verify:ui` / `verify:preview` 新增审计列表含 merge / resolve 事件与 Clear 后清空断言，两条 lane 全绿。

## 风险与后续

- 审计日志会持续增长，当前上限 200 条展示并按需清理，未做自动归档；导出与筛选留在 Backlog。
- 浏览器 fallback 的 `sync.resolve.batch` 按逐条 resolve 记录，与 Rust 的单条批量摘要略有差异，语义等价。
