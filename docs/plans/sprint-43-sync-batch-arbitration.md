# Sprint 43 计划：同步冲突批量仲裁

目标：在逐条人工仲裁基础上增加批量仲裁，一次 Pull 产生多条冲突时可通过 Keep all local / Keep all remote 一键裁决，Rust 侧以单事务批量写回，前端与浏览器 fallback 行为一致。

## Sprint 43 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 批量仲裁 | `resolve_conflicts(conn, conflicts, choice)` 用 `unchecked_transaction` 批量调用 `resolve_conflict` 并提交，返回解决数量；未知 choice 报错且事务回滚 |
| A2 | Tauri 命令 | 新增 `resolve_sync_conflicts(conflicts, choice)`，注册到 invoke handler，返回 `Result<usize, String>` |
| A3 | 端到端单测 | 构造剪贴板 + 日志两条冲突，批量 Keep local 后两条内容恢复、未解决列表清空、已解决历史 2 条 |
| A4 | 前端透传 | `resolveSyncConflicts(conflicts, choice)` Tauri 分支 invoke，浏览器 fallback 逐条复用 `resolveSyncConflict` 并返回数量 |
| A5 | System UI | 冲突列表顶部新增 Keep all local / Keep all remote 按钮，批量裁决后刷新系统状态与冲突列表并提示结果 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增第二次 Pull → 批量 Keep remote → 冲突 badge 消失且历史保留断言 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 批量事务写回与历史记录单测通过。
- [x] 前端透传批量仲裁，浏览器 fallback 不改变行为。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.43.0-alpha`。

## 范围外（Backlog）

- 三方合并策略与冲突自动化解。
- 多 vault 并行 watch。
- 并发数随设备配置自动调优。
- 批量仲裁加入同步审计/事件日志。
