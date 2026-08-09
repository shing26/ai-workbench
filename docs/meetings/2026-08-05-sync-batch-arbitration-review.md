# 2026-08-05 同步冲突批量仲裁评审

## 结论

- Rust 新增 `resolve_conflicts(conn, conflicts, choice)`：用 `unchecked_transaction` 批量调用 `resolve_conflict`，一次事务提交全部裁决；未知 choice 逐条报错并回滚，返回成功解决数量。
- Tauri 新增 `resolve_sync_conflicts(conflicts, choice)` 并注册到 invoke handler；前端 `resolveSyncConflicts` 在 Tauri 分支 invoke，浏览器 fallback 逐条复用 `resolveSyncConflict`，语义一致。
- 单测覆盖剪贴板 + 日志两条冲突批量 Keep local：内容写回、未解决列表清空、已解决历史 2 条；`cargo test --lib` 43/43，fmt、clippy、build 全绿。
- System Sync snapshot 卡片新增 Keep all local / Keep all remote 批量按钮，裁决后刷新状态、冲突列表与提示信息；`verify:ui` / `verify:preview` 新增第二次 Pull → 批量 Keep remote → badge 消失与历史保留断言，两条 lane 全绿。

## 风险与后续

- 批量仲裁目前为全量选择，未提供逐条预选；三方合并策略留在 Backlog。
- 第二次 Pull 会产生重复导入条目的冲突，已通过历史断言按具体记录定位验证。
