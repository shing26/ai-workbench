# 2026-08-05 Vault watch 配置持久化评审

## 结论

- 新增 `vault_watch_config` 单行表，`get_vault_watch_config` / `set_vault_watch_config` 读写 path、ignorePatterns、enabled 与 updatedAt。
- `start_vault_watch_ex` 成功即保存 enabled=true；`stop_vault_watch` 保留 path/ignore 并保存 enabled=false；Tauri 启动时自动重启已开启的 watch。
- Knowledge 视图挂载时恢复路径与 ignore 输入，watch 未运行时自动 start；浏览器 fallback 与 Rust 行为一致。
- 验证覆盖：`cargo test --lib` 41/41，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 reload 后配置恢复断言，两条 lane 全绿。

## 风险与后续

- 自动恢复依赖配置中的路径仍存在；路径失效时启动失败会被静默忽略，用户可在视图内重新配置。
- Vault 索引并发数可配置与多 vault 并行 watch 仍留在 backlog。
