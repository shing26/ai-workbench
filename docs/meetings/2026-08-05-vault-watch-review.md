# 2026-08-05 Vault 自动文件监听同步评审

## 结论

- Rust 引入 `notify`，`start_vault_watch` 先全量索引再递归监听；`.md` 新增/修改自动 upsert，删除自动清理，并 emit `vault-watch-update` 状态。
- `stop_vault_watch` 停止监听线程但保留已索引文件；`get_vault_watch_status` 返回 watching、path、files、updatedAt。
- Knowledge 视图新增 Watch vault / Stop watch 按钮与 Watch 状态 badge，监听事件到达时自动刷新文件数与 RAG 状态。
- Rust 单测验证监听线程能增量同步新增与删除文件；`verify:ui` / `verify:preview` 断言 watch 开关、状态 badge 与文件数 2 → 3。

## 风险与后续

- 大 Vault 目录的初次全量索引仍是同步阻塞，后续可加并行扫描与忽略目录。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动执行 commit / 创建远端 PR。
