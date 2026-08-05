# Sprint 47 计划：目标级索引统计

目标：`knowledge_files` 记录每个文件归属的 vault path，Knowledge UI 每个目标显示独立文件数与最近索引时间，解决多 vault 场景下无法区分各目标索引量的问题。

## Sprint 47 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 数据模型 | `knowledge_files` 新增 `vault_path` 列，旧库启动时自动 ALTER 迁移 |
| A2 | 写入链路 | `upsert_knowledge_file` 接收并写入 `vault_path`，vault 扫描与 watch 同步均传入目标路径 |
| A3 | 统计命令 | 新增 `vault_target_stats` 与 Tauri 命令 `list_vault_target_stats`，按路径分组返回文件数与最近索引时间 |
| A4 | 前端展示 | Knowledge 每个目标行显示 `{count} files`，浏览器 fallback 按目标前缀统计已读文件 |
| A5 | 单元测试 | `vault_target_stats_group_by_vault_path` 覆盖多 vault 分组与旧数据归零 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言两个目标行 `data-vault-target-files` 均大于 0 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 目标级统计单测通过，旧记录计入 `vault_path = ''` 不计入统计。
- [x] 前端目标行文件数与浏览器 fallback 一致。
- [x] `verify:ui` / `verify:preview` 新增目标级统计断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.47.0-alpha`。

## 范围外（Backlog）

- 审计事件导出与按设备/时间筛选。
- 按文件规模动态调整索引并发。
- 三方合并策略与冲突自动化解决。
- watch 目标级事件隔离与独立增量统计。
