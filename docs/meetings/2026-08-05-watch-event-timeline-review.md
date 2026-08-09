# 2026-08-05 watch 事件时间线评审

## 结论

- 新增 `vault_watch_events` 时间线表，`touch_vault_watch_event` 每次写回成功都插入一条带真实 `file_path` 的记录，并按 `id DESC` 裁剪到最新 500 条。
- `sync_vault_event` 返回变更文件路径数组，watcher 按路径逐条埋点，created / modified / removed 分别映射为 `+` / `~` / `-`。
- 新增 Tauri 命令 `list_vault_watch_events` / `clear_vault_watch_events`，支持按 vault 过滤与全量清空；`delete_vault_watch_target` 级联清理事件。
- Knowledge 每个 vault 目标新增 Timeline 按钮，展开显示事件类型、真实路径、时间与 Clear；浏览器 fallback 在 watch 启动时模拟一条 created 事件，语义与 Rust 一致。
- 验证覆盖：`cargo test --lib` 68/68，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `vaultWatchTimeline` 均为 `{ ok: true, events: 3, kinds: ["created"], countOk: true, cleared: true }`。

## 风险与后续

- 时间线只保留最近 500 条，超量自动裁剪；如需长期审计可增加归档策略。
- UI 验证通过 fallback 模拟 created 事件，真实文件系统监听的删除 / 修改路径仍依赖手工联调。
