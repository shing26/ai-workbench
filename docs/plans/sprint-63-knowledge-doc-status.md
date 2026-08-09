# Sprint 63 计划：RAG 文档状态面板

目标：让 Knowledge 从“只显示 vault 文件总数”升级为可逐份检查的文档状态面板。Vault Index 卡片新增 Document status 区，展示每个索引文档的标题、路径、归属 vault、标签与索引时间，并支持按 vault 过滤。

## Sprint 63 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 文档列表命令 | 新增 `list_knowledge_files(vault_path?, limit?)`，返回 `KnowledgeFileRecord { id, path, title, tags, vaultPath, indexedAt }`，limit clamp 1~200 |
| A2 | 排序与过滤 | 按 `indexed_at DESC, path ASC` 排序，支持按 `vault_path` 精确过滤（含空路径 legacy 记录） |
| A3 | TS fallback | `listKnowledgeFiles` 镜像 Rust 语义，按 watch target 前缀推断 vault，本地存储文件同样可过滤 |
| A4 | Document status UI | Vault Index 卡片新增文档状态区：数量徽标、vault 过滤下拉、文档列表（标题 / 路径 / vault / 索引时间） |
| A5 | 单测 | Rust 覆盖全量列表、按 vault 过滤、limit 截断与空路径 legacy 过滤 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `knowledgeDocStatus` lane：3 份文档、双 vault 归属、过滤 C:/vault 后 2 份 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（70/70），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖列表 / 过滤 / limit / legacy。
- [x] `verify:ui` / `verify:preview` 的 `knowledgeDocStatus` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.63.0-alpha`。

## 范围外（Backlog）

- 索引任务队列持久化。
- git 活动看板。
- 文档缺失 / 过期状态检测。
- 错误日志来源 / 设备组合筛选。
