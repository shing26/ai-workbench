# Sprint 40 计划：冲突明细持久化与历史仲裁记录

目标：把同步冲突从「最近一次同步结果」升级为持久化记录。合并时冲突明细写入 `sync_conflicts` 表，人工裁决后保留 `resolved_choice` / `resolved_at`，重启后仍可查看未解决冲突与已解决历史。

## Sprint 40 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 冲突表与持久化 | 新增 `sync_conflicts` 表；`merge_sync_snapshot` 将冲突明细 upsert，同 id/kind 未解决冲突更新、已解决后新冲突重新入表 |
| A2 | 仲裁历史 | `resolve_conflict` 将裁决写回记录；`list_sync_conflicts(unresolved/resolved/all)` 返回历史，`clear_resolved_sync_conflicts` 清理已解决记录 |
| A3 | 端到端单测 | 合并后未解决记录含 local/remote 内容；裁决后历史带 choice 与时间戳；新一轮冲突与已解决历史共存；清理只删已解决 |
| A4 | System UI | 冲突列表与 badge 改用持久化未解决列表；新增 Show resolved history / Clear resolved；裁决后移除未解决并保留历史 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Keep remote 后历史可见、reload 后历史仍保留 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 未解决 / 已解决 / 全部三种查询与清理单测通过。
- [x] 浏览器 fallback 持久化未解决与已解决历史，reload 后可读。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.40.0-alpha`。

## 范围外（Backlog）

- Vault 索引并发数可配置。
- watch 状态 ignore 列表持久化。
- 批量仲裁与三方合并策略。
