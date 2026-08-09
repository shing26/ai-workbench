# 2026-08-05 Vault watch 遵守 ignore 列表评审

## 结论

- 新增 `start_vault_watch_ex(vault_path, ignore_patterns)`：启动初始索引应用 ignore，`sync_vault_event` 对增量事件先计算相对路径并执行 `should_ignore_path`，命中路径跳过 upsert/delete；旧 `start_vault_watch` 保持空 ignore 兼容。
- 端到端单测验证 `node_modules` 下新增 Markdown 不入库、普通目录新增正常索引；`cargo test --lib` 37/37，fmt、clippy、build 全绿。
- Knowledge Watch vault 复用 Ignore patterns 输入，watch 开启时 Skipped 计数保持可见；`verify:ui` / `verify:preview` 新增 Skipped 1 断言，两条 lane 全绿。

## 风险与后续

- watch 状态协议未包含 ignore 列表本身，重启应用后前端需重新填写；可后续持久化。
- 下一 Sprint 候选：同步快照定时自动同步与冲突 UI、Vault 索引并发数可配置。
