# 2026-08-05 同步快照定时自动同步评审

## 结论

- System Sync snapshot 卡片新增 Auto sync 开关与 10s / 30s / 60s / 5m 间隔选择；启用时立即执行一次 pull → push 双向同步，之后按间隔自动续跑，关闭时清理定时器。
- `getSyncAutoConfig` / `setSyncAutoConfig` 持久化 `{ enabled, intervalMs, remoteUrl }` 到 localStorage；Token 不落盘，只留在当前会话输入。
- `verify:ui` / `verify:preview` 新增 Auto sync 启用、立即同步结果、关闭三条断言，两条 lane 全绿；build 与 Rust 37/37 全绿。

## 风险与后续

- 自动同步是前端进程内调度，应用完全退出后不运行；若需系统级后台同步，后续再做 Tauri 后台定时任务与 Keyring Token。
- 冲突 UI 与三方合并策略可视化仍未实现，列入下一候选。
