# 2026-08-05 RAG 文档状态面板评审

## 结论

- 新增 Tauri 命令 `list_knowledge_files`：按 `indexed_at DESC, path ASC` 返回索引文档，支持 `vault_path` 过滤与 limit clamp 1~200，空路径 legacy 记录也可单独查询。
- Knowledge Vault Index 卡片新增 Document status 面板：数量徽标、按 vault 过滤的下拉框与文档列表，watch / 索引完成后自动刷新。
- 浏览器 fallback 按 watch target 路径前缀推断文档归属 vault，与 Rust 的目标级语义一致。
- 验证覆盖：`cargo test --lib` 70/70，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `knowledgeDocStatus` 均为 `{ ok: true, count: 3, vaults: ["C:/vault","D:/vault"], filterOk: true, filteredCount: 2 }`。

## 风险与后续

- fallback 的 `VaultFileRecord` 不持久化 indexedAt，旧记录显示 n/a；后续可让 fallback 索引写入时间戳。
- 文档面板只展示已索引记录，不检测磁盘上已删除但未同步清理的陈旧文档；可作为后续 Sprint。
