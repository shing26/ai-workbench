# Sprint 156 计划：向量分片质心与近似索引（ANN）搜索

目标：为 Knowledge 向量索引补齐分片质心与近似最近邻搜索，让 RAG 在大文档库下按 probe 数量快速剪枝，同时保持双端同构与旧库可迁移。

## Sprint 156 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| S1 | SQLite schema 与迁移 | `embedding_config` 新增 `ann_enabled / probe_count`，`vector_shards` 新增 `centroid`；`migrate_vector_index` 幂等补列并保留旧库数据。 |
| S2 | Rust 质心统计 | `refresh_shard_stats` 聚合 shard 内已索引向量并归一化质心，`get_vector_index_status` 返回 `annEnabled / probeCount / centroidsReady`。 |
| S3 | Rust ANN 搜索 | `search_thoughts` 在 `ann_enabled && 1 < probe_count < shard_count` 时按查询向量与 shard 质心余弦相似度保留 top probe shard；关闭 ANN 或 `probe_count == shard_count` 时全量返回。 |
| S4 | 浏览器 fallback | `db.ts` 的 `EmbeddingConfig / VectorShardRecord / VectorIndexStatus` 补齐新字段；`setEmbeddingConfig` clamp probe，`refreshVectorShardStats` 计算质心，`searchThoughts` 同构实现 top-shard 过滤。 |
| S5 | KnowledgeView UI | 新增 ANN 开关与 probe count 输入，shard 卡片显示质心就绪状态与 ANN / probe 徽标。 |
| S6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `vectorAnnSearch` lane；Rust 单测新增质心归一化与 ANN 剪枝用例。 |
| S7 | 文档与合并 | BACKLOG 候选池清空；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合并 develop。 |

## DoD 检查单

- [x] `embedding_config.ann_enabled / probe_count` 与 `vector_shards.centroid` 可读写，旧库迁移幂等。
- [x] shard 质心归一化，`centroidsReady` 状态正确。
- [x] ANN 开启时搜索结果限制在 top probe shard，关闭后恢复全量。
- [x] 浏览器 fallback 与 Rust 行为同构。
- [x] KnowledgeView 可配置 ANN 与 probe，shard 卡片显示质心状态。
- [x] `verify:ui` / `verify:preview` 的 `vectorAnnSearch` lane 双端通过；Rust 单测全部通过。
- [x] 八道质量门全绿。
- [x] PR 合并入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- 候选池已清空，v1.0 发布文档为终点三要素最后一项。
- Connection Layer 与 Monetization Workbench 继续搁置。
