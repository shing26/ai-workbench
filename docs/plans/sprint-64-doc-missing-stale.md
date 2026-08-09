# Sprint 64 计划：文档存在性与过期检测

目标：让 Document status 面板不仅能展示已索引文档，还能识别磁盘上已删除（missing）或索引后又被修改（stale）的文档，避免 RAG 引用陈旧内容。

## Sprint 64 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 存在性检测 | `list_knowledge_files` 每条记录新增 `exists`，按 `Path::exists` 判断磁盘文件是否存在 |
| A2 | Rust 过期检测 | 文件 mtime 比 `indexed_at` 晚超过 1 秒判定 `stale`；文件不存在时 `stale = false` |
| A3 | TS fallback | `KnowledgeFileRecord` 新增 `exists` / `stale`；浏览器 fallback 返回 `exists: true, stale: false` |
| A4 | UI 状态徽标 | 文档行新增 ok / stale / missing 状态徽标，面板头部显示 missing / stale 计数 |
| A5 | 单测 | Rust 覆盖真实文件 fresh / stale / 删除后 missing 三态 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增状态断言：3 份文档全部 ok、missing 0、stale 0 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（71/71），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖 missing / stale 判定。
- [x] `verify:ui` / `verify:preview` 的 `knowledgeDocStatus` 均为 true，状态全部 ok。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.64.0-alpha`。

## 范围外（Backlog）

- 索引任务队列持久化。
- git 活动看板。
- 错误日志来源 / 设备组合筛选。
- missing / stale 文档一键清理或重新索引。
