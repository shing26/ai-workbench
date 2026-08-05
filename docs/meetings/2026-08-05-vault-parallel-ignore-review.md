# 2026-08-05 Vault 并行扫描与 ignore 列表评审

## 结论

- `index_vault_files` 重构为两阶段：递归收集 `.md` 路径时应用 ignore 规则，随后 `thread::scope` 最多 4 个 worker 并行读取解析文件，主线程统一 upsert；`IndexResult` 返回 `{ files, ignored }`。
- ignore 支持目录名任意层级匹配与 `**` / `*` glob；`node_modules` 与 `archive/**` 集成单测验证跳过且搜索结果不含被忽略内容。
- 新增 `index_vault_ex(vault_path, ignore_patterns)`，旧 `index_vault` 默认空 ignore 保持兼容；`start_vault_watch` 初始索引仍为空 ignore。
- Knowledge Vault Index 新增 Ignore patterns 输入与 Skipped 计数；`verify:ui` / `verify:preview` 新增 ignore 断言，两条 lane 全绿；`cargo test --lib` 36/36，fmt、clippy、build 全绿。

## 风险与后续

- watch 监听暂不感知 ignore 列表，忽略目录的新增文件仍会进入索引，列入下一候选。
- 并行 worker 固定 4 个，未做动态调节；超大目录后续可改为可配置并发数。
