# Sprint 39 计划：同步冲突人工仲裁

目标：在 Sprint 38 冲突可视化基础上支持人工裁决。冲突明细携带 local / remote 完整内容，System card 对每条冲突提供 Keep local / Keep remote 按钮；选择后写回数据库并更新时间戳，使该裁决在下次同步中胜出。

## Sprint 39 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 冲突内容快照 | `SyncConflictItem` 新增 `localContent` / `remoteContent`，合并时保留双方完整内容 |
| A2 | Rust 仲裁命令 | 新增 `resolve_sync_conflict(conflict, choice)`，按 kind 更新剪贴板/日志内容并以当前时间戳标记 |
| A3 | 端到端单测 | remote 覆盖后 Keep local 恢复本地内容；Keep remote 保持远端内容；未知 choice 报错 |
| A4 | System UI | 冲突列表逐条展示 preview 与 Keep local / Keep remote 按钮，仲裁后刷新剪贴板并移除该冲突 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Pull 产生冲突后 Keep remote 生效且结果可见 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] local / remote / 未知 choice 三条仲裁单测通过。
- [x] 浏览器 fallback 下 Keep local / Keep remote 可用且结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.39.0-alpha`。

## 范围外（Backlog）

- 冲突明细持久化与历史仲裁记录。
- Vault 索引并发数可配置。
- watch 状态 ignore 列表持久化。
