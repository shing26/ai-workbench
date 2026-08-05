# 2026-08-05 同步冲突人工仲裁评审

## 结论

- `SyncConflictItem` 新增 `localContent` / `remoteContent`，合并时保留双方完整内容，为人工仲裁提供依据。
- 新增 `resolve_conflict(conn, conflict, choice)` 与 Tauri 命令 `resolve_sync_conflict`：Keep local / Keep remote 写回对应内容并更新 `updated_at`，未知 choice 明确报错。
- System Sync snapshot 卡片逐条展示冲突 preview 与 Keep local / Keep remote 按钮，仲裁后刷新剪贴板并移除该冲突。
- 验证覆盖：`cargo test --lib` 39/39，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Pull → Keep remote → badge 消失与结果可见断言，两条 lane 全绿。

## 风险与后续

- 冲突明细当前仅存在于最近一次同步结果中，未持久化；建议下一阶段增加仲裁历史记录表。
- 仲裁仅按单条记录处理，批量仲裁与三方合并策略仍留在 backlog。
