# 2026-08-05 同步冲突历史持久化评审

## 结论

- 新增 `sync_conflicts` 表，`merge_sync_snapshot` 将每条冲突明细持久化：同 id/kind 未解决记录原位更新，已解决记录保留、新冲突重新入表。
- `resolve_conflict` 裁决后写回 `resolved_choice` / `resolved_at`；`list_sync_conflicts` 支持 unresolved / resolved / all，`clear_resolved_sync_conflicts` 只清理已解决记录。
- System Sync snapshot 卡片改用持久化未解决列表，新增 Show resolved history 与 Clear resolved，裁决后历史可见且 reload 后保留。
- 验证覆盖：`cargo test --lib` 40/40，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增历史可见与 reload 持久化断言，两条 lane 全绿。

## 风险与后续

- `sync_conflicts` 按 (id, kind, created_at) 保留历史，长期运行需依赖 Clear resolved 控制增长。
- 批量仲裁与三方合并策略仍留在 backlog。
