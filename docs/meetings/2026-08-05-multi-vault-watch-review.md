# 2026-08-05 多 vault 并行 watch 评审

## 结论

- 新增 `vault_watch_targets` 表（path 主键、ignore_patterns、enabled、updated_at），`init_connection` 自动把旧 `vault_watch_config` 单行迁移为第一个目标，旧表与旧命令保留兼容。
- `VaultWatchState.active` 从单个 watcher 升级为 watcher 列表：`start_vault_watch_impl` 只替换同路径实例并保留其他实例，`stop_vault_watch(path?)` 支持按路径停止与全停，`restore_vault_watch` 遍历所有 enabled 目标逐个恢复。
- 新命令 `list_vault_watch_targets` / `upsert_vault_watch_target` / `delete_vault_watch_target` 已注册；`VaultWatchStatus` 新增 `paths` 字段。
- 单测覆盖双目录并行 watcher 各索引新文件、目标表 CRUD 与旧配置迁移；`cargo test --lib` 45/45，fmt、clippy、build 全绿。
- Knowledge Vault Index 卡片新增目标列表：每行独立 Watch / Stop / Remove，Active badge 显示并行 watcher 数量；`verify:ui` / `verify:preview` 新增第二个 vault 开启、双目标同时 on、计数 2、全部停止断言，两条 lane 全绿。

## 风险与后续

- 多目标共用同一 `knowledge_files` 索引，未按目标隔离统计；目标级索引统计留在 Backlog。
- reduced-motion 断言偶发取到 media query 重算前的 transform，验证脚本改为轮询等待 `none` 后稳定通过。
