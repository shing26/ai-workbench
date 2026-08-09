# Sprint 65 计划：文档健康一键清理与重新索引

目标：Sprint 64 已经能识别 missing / stale 文档，本 Sprint 让用户一键完成健康修复：missing 文档从索引中清理，stale 文档按磁盘最新内容重新索引，并给出 removed / reindexed 结果反馈。

## Sprint 65 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 清理命令 | 新增 `cleanup_knowledge_files(vault_path?)`，missing 删除索引记录、stale 重读磁盘并 upsert，返回 `{ removed, reindexed, failed }` |
| A2 | vault 过滤 | 传入 `vault_path` 时只清理该 vault 的文档；不传时全量清理 |
| A3 | TS fallback | `cleanupKnowledgeFiles` 镜像 Rust 语义；`VaultFileRecord` 支持 `exists` / `stale` 模拟状态，清理后写回 localStorage |
| A4 | Document status 一键处理 | 面板头部新增 Clean 按钮，点击后调用清理命令并展示 `removed / reindexed` 结果；按当前 vault 过滤生效 |
| A5 | 单测 | Rust 覆盖 missing 删除、stale 内容重索引、fresh 保留、vault 过滤与失败计数 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `knowledgeDocClean` lane：前置 1 missing + 1 stale，点击 Clean 后 removed=1 / reindexed=1 / 剩余 2 份全部 ok |

## DoD 检查单

- [x] `cargo test --lib` 全绿（72/72），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖 missing / stale / fresh / vault 过滤。
- [x] `verify:ui` / `verify:preview` 的 `knowledgeDocClean` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.65.0-alpha`。

## 范围外（Backlog）

- 索引任务队列持久化。
- git 活动看板。
- 错误日志来源 / 设备组合筛选。
- 文档健康修复的自动定时巡检。
