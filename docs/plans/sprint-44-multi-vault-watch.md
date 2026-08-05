# Sprint 44 计划：多 vault 并行 watch

目标：把 Vault watch 从单实例升级为多目标并行，多个 Obsidian / Markdown 文件夹可同时监听、独立启停，配置持久化并在应用启动时全部恢复。

## Sprint 44 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 目标表与迁移 | 新增 `vault_watch_targets` 表（path 主键），`init_connection` 自动把旧 `vault_watch_config` 单行迁移为第一个目标 |
| A2 | 目标 CRUD | `list_vault_watch_targets` / `upsert_vault_watch_target` / `set_vault_watch_target_enabled` / `delete_vault_watch_target`，路径不存在时返回明确结果 |
| A3 | 并行 watcher | `VaultWatchState.active` 改为 watcher 列表，`start_vault_watch_impl` 只替换同路径实例、保留其他实例，`stop_vault_watch(path?)` 支持单目标与全停 |
| A4 | 启动恢复 | `restore_vault_watch` 遍历所有 enabled 目标逐个启动，旧单行配置自动纳入 |
| A5 | 端到端单测 | 双目录两个 watcher 并行新增文件均被索引；目标表 CRUD 与旧配置迁移断言通过 |
| A6 | Knowledge UI | Vault Index 卡片新增目标列表，每行独立 Watch / Stop 与移除；状态 badge 显示当前路径与活跃数 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增第二个 vault 开启、两个目标同时 on、计数 2、全部停止断言 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 并行 watcher 与目标表迁移单测通过。
- [x] 前端目标列表可独立启停，浏览器 fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 新增双 vault 并行断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.44.0-alpha`。

## 范围外（Backlog）

- 并发数随设备配置自动调优。
- 批量仲裁加入同步审计/事件日志。
- 三方合并策略与冲突自动化解。
- 目标级索引统计与增量 watch 事件隔离展示。
