# Sprint 38 计划：同步冲突明细与自动解决结果可视化

目标：让跨设备同步的 `updated_at` 自动合并透明化。`SyncResult` 新增 `conflicts` 明细，记录每条同 id 记录的本地/远端时间戳、解决方向（remote / local）与内容预览；System Sync card 展示冲突数量，让用户知道哪些剪贴板/日志条目被哪一方覆盖。

## Sprint 38 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 冲突明细 | `MergeOutcome` 携带本地时间戳，`merge_sync_snapshot` 收集 `SyncConflictItem { id, kind, localUpdatedAt, remoteUpdatedAt, resolvedTo, preview }` |
| A2 | 端到端单测 | 同 id 远端更新 → `resolvedTo: remote`；再次同步旧远端 → `resolvedTo: local`；时间戳相等不产生冲突 |
| A3 | 前端冲突 UI | `SyncResult` 类型与 fallback 同步收集冲突；System card 展示 `N conflict(s) auto-resolved` 与解决方向 |
| A4 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Pull 后冲突 badge 显示 1 conflict |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] remote / local / equal 三条冲突方向单测通过。
- [x] 浏览器 fallback 下 Pull 产生冲突并可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.38.0-alpha`。

## 范围外（Backlog）

- 冲突人工仲裁（手动选择 local / remote）。
- Vault 索引并发数可配置。
- watch 状态 ignore 列表持久化。
