# 2026-08-05 Vault 目标级索引统计评审

## 结论

- `knowledge_files` 新增 `vault_path TEXT NOT NULL DEFAULT ''`，`init_connection` 对旧库执行幂等 ALTER，避免破坏既有索引数据。
- `upsert_knowledge_file` 全链路携带 vault path：`index_vault_files`、`upsert_markdown_path`、`sync_vault_path` 与 watch 事件统一传参，单元测试调用点同步更新。
- 新增 `vault_target_stats(conn)` 按 `vault_path <> ''` 分组，返回 `{ path, files, last_indexed_at }`；`list_vault_target_stats` 已注册 Tauri handler。
- Knowledge 每个 vault 目标行显示独立文件数；浏览器 fallback 遍历 `readVaultFiles()` 按路径前缀统计，与 Rust 语义一致。
- 验证覆盖：`cargo test --lib` 48/48，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言 `C:/vault` 与 `D:/vault` 文件数均大于 0。

## 风险与后续

- 历史索引记录 `vault_path` 为空，不会被统计，需要重新索引目标后才显示准确文件数；迁移保持非破坏。
- watch 增量同步目前只更新文件内容，后续可补充按目标粒度的增量事件计数与最后同步时间。
