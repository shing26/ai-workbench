# 2026-08-05 文档健康一键清理与重新索引评审

## 结论

- `cleanup_knowledge_files(vault_path?)` 命令按 `knowledge_files` 记录逐条判定：磁盘文件缺失时删除索引记录（removed），文件存在且 stale 时重读 frontmatter 与正文并 upsert（reindexed），读取失败计入 failed；fresh 文档与未选中的 vault 不受影响。
- Document status 面板头部新增 Clean 按钮与 `removed / reindexed` 结果徽标，按当前 vault 过滤生效；清理完成后自动刷新文档列表、vault 统计与 RAG 状态。
- TS fallback 在 `ai-workbench:vault:v1` 上镜像同一语义，`VaultFileRecord` 支持 `exists` / `stale` 模拟状态；UI 验证 seed 1 missing + 1 stale 后点击 Clean，结果 removed=1 / reindexed=1 / 剩余 2 份全部 ok。
- 验证覆盖：`cargo test --lib` 72/72，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `knowledgeDocClean` 均为 true。

## 风险与后续

- stale 重索引依赖磁盘文件可读；权限或编码问题会进入 failed 计数，UI 当前只汇总数量，可后续补充失败明细。
- 自动定时巡检（定时清理 missing / stale）已排入 Backlog，作为下一阶段候选。
