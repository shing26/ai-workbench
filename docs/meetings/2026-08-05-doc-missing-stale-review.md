# 2026-08-05 文档存在性与过期检测评审

## 结论

- `list_knowledge_files` 每条记录新增 `exists` / `stale`：磁盘文件存在性用 `Path::exists`，mtime 比 `indexed_at` 晚超过 1 秒判定 stale，文件不存在时 stale 恒为 false。
- Knowledge Document status 面板新增 ok / stale / missing 徽标与 missing / stale 计数；浏览器 fallback 返回 `exists: true, stale: false`，与 Web 环境无文件系统访问的语义一致。
- Rust 单测覆盖真实文件 fresh / 回拨 indexed_at 后 stale / 删除文件后 missing 三态；UI 验证断言 3 份文档全部 ok、missing 0、stale 0。
- 验证覆盖：`cargo test --lib` 71/71，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `knowledgeDocStatus` 均含 `statuses: ["ok","ok","ok"]`。

## 风险与后续

- stale 判断依赖文件系统 mtime 与索引时间戳，跨设备同步后时间语义以本地磁盘为准。
- 浏览器 fallback 无法探测真实文件，后续可让 Tauri 端提供文件状态快照给 fallback 展示。
