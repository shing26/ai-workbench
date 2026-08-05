# Sprint 45 计划：同步审计与事件日志

目标：为同步链路增加持久化审计日志，记录 merge / resolve / batch resolve / history clear 事件与详情，System card 可视化最近 200 条，支持一键清理。

## Sprint 45 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 审计表 | 新增 `sync_audit_log` 表（自增 id、event、detail、device_id、created_at）与 created_at 索引 |
| A2 | 审计 CRUD | `append_sync_audit` / `list_sync_audit(limit)`（按时间倒序）/ `clear_sync_audit` |
| A3 | 埋点 | `merge_sync_snapshot` 记录 `sync.merge`（含数量与冲突数）；`resolve_conflict` / `resolve_conflicts` 记录 `sync.resolve` / `sync.resolve.batch`；`clear_resolved_sync_conflicts` 记录 `sync.history.cleared` |
| A4 | Tauri 命令 | 新增 `list_sync_audit(limit)` / `clear_sync_audit`，limit clamp 到 1~200，注册到 invoke handler |
| A5 | System UI | Sync snapshot 卡片新增 Sync audit 面板：事件名、详情、时间与 Clear 按钮，同步操作后自动刷新 |
| A6 | 端到端单测 | merge 后 1 条 `sync.merge`、resolve 后 `sync.resolve`、clear 后 `sync.history.cleared`，最终清空审计 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 断言审计列表含 merge / resolve 事件且 Clear 后清空 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 审计埋点与 CRUD 单测通过。
- [x] System Sync audit 面板展示与清理，浏览器 fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 新增审计断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.45.0-alpha`。

## 范围外（Backlog）

- 并发数随设备配置自动调优。
- 目标级索引统计与增量 watch 事件隔离展示。
- 三方合并策略与冲突自动化解。
- 审计事件导出与按设备/时间筛选。
