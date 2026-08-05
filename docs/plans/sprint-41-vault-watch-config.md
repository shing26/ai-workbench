# Sprint 41 计划：Vault watch 配置持久化

目标：把 Vault watch 的路径、ignore 列表与开关状态持久化到 SQLite / localStorage，应用重启或重新进入 Knowledge 视图后自动恢复，已开启的 watch 自动重启。

## Sprint 41 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 配置表与命令 | 新增 `vault_watch_config` 单行表；`get_vault_watch_config` / `set_vault_watch_config` 读写 path、ignorePatterns、enabled、updatedAt |
| A2 | start/stop 联动 | `start_vault_watch_ex` 成功后保存 enabled=true；`stop_vault_watch` 保留 path/ignore 并保存 enabled=false |
| A3 | 自动恢复 | Tauri 启动时按配置自动重启 watch；Knowledge 视图挂载时恢复输入并在未运行时自动 start |
| A4 | 端到端单测 | 配置跨 reopen 保留 path/ignore/enabled；停止后 enabled=false 但 path/ignore 保留 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言开启 watch 后 reload，路径、ignore 与 watch 状态恢复 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 配置读写与跨 reopen 单测通过。
- [x] 浏览器 fallback 与 Rust 行为一致，reload 后输入与 watch 状态恢复。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.41.0-alpha`。

## 范围外（Backlog）

- Vault 索引并发数可配置。
- 批量仲裁与三方合并策略。
- 多 vault 并行 watch。
