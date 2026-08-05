# Sprint 61 计划：watch 事件时间线

目标：让 vault 变更从“只显示累计计数”升级为可追溯的时间线。Knowledge 每个 vault 目标可展开查看最近事件，包括真实文件路径、事件类型与时间，并支持一键清空。

## Sprint 61 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 事件时间线表 | 新增 `vault_watch_events` 表：`id, vault_path, file_path, event_kind, created_at`，索引 `(vault_path, created_at DESC)` |
| A2 | Rust 事件写入 | `touch_vault_watch_event` 接收真实 `file_path`，每次写回成功插入一条时间线并裁剪到最新 500 条 |
| A3 | Rust 查询 / 清空 | 新增 `list_vault_watch_events(vault_path?, limit)` 与 `clear_vault_watch_events(vault_path?)`，删除目标时级联清理事件 |
| A4 | TS fallback | `listVaultWatchEvents` / `clearVaultWatchEvents` 镜像 Rust 语义，fallback watch 启动时记录一条 created 事件 |
| A5 | Knowledge 时间线 UI | 每个 vault 目标新增 Timeline 按钮，展开显示 `+` / `~` / `-`、文件路径、时间与 Clear 动作 |
| A6 | 单测 | Rust 覆盖时间线排序与按路径过滤、清空、非法 event_kind、删除目标级联清理 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `vaultWatchTimeline` lane：路径包含 Watch Sync Note、数量匹配、Clear 后清空 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（68/68），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖时间线排序 / 过滤 / 清空 / 级联。
- [x] `verify:ui` / `verify:preview` 的 `vaultWatchTimeline` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.61.0-alpha`。

## 范围外（Backlog）

- 索引任务队列持久化。
- 错误日志趋势 / 聚合。
- RAG 文档状态面板。
- git 活动看板。
