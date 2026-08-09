# Sprint 145 计划：真实 Embedding、增量重建与分片索引

目标：把 Knowledge 向量能力从“本地哈希特征向量”升级为可配置真实 Embedding 模型（OpenAI-compatible / Ollama，本地哈希兜底），支持向量增量后台重建，并引入按路径哈希分片的分片索引与状态面板。

## Sprint 145 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| K1 | 向量数据模型 | `knowledge_files` 新增 `shard_id` / `embedding_model` / `embedding_dim` / `embedding_status` / `embedding_error`；新增 `embedding_config` 单行表与 `vector_shards` 分片表；新库 SCHEMA 直接建列建表，旧库 `migrate_vector_index` 幂等补列并播种分片。 |
| K2 | 真实 Embedding 提供方 | `embed_with_config` 支持 `local` / `openai`（`/embeddings`）/ `ollama`（`/api/embed`）；请求失败回退本地向量并标记 `failed` + 错误原因；响应解析单测覆盖两种 API 形状。 |
| K3 | 增量重建 | `rebuild_vector_index(force)` 只处理 `embedding_status != indexed` / 模型不匹配 / embedding 为空 / force 的文件，按批处理并回写分片统计；`spawn_vector_rebuild_worker` 在 auto_rebuild 开启时后台增量补齐。 |
| K4 | 分片搜索与状态 | `search_thoughts` 返回 `shardId` / `embeddingModel`，查询向量优先用配置模型、失败回退本地；新增 `get_vector_index_status` / `get_embedding_config` / `set_embedding_config` / `rebuild_vector_index` Tauri 命令，浏览器 fallback 同构。 |
| K5 | Knowledge UI | 新增 Vector index 卡片：配置表单（mode / base_url / api_key / model / shards / auto）、Rebuild 按钮、状态统计与分片列表（`data-vector-index-*` / `data-vector-shard-item`）。 |
| K6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `vectorIndexConfig` / `vectorIndexRebuild` / `vectorShardSearch` lane；Rust 单测覆盖迁移、配置钳制、分片分配、重建生命周期与响应解析。 |
| K7 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八门禁全绿后合入 develop。 |

## DoD 检查单

- [x] 旧库打开后 `knowledge_files` 自动补向量列，`vector_shards` 播种并可按 shard_id 查询。
- [x] 配置切换模型后增量重建只处理待重建文件，失败保留原因且搜索仍可用。
- [x] `search_thoughts` 结果携带分片与模型元数据，双端一致。
- [x] `verify:ui` / `verify:preview` 的 `vectorIndexConfig` / `vectorIndexRebuild` / `vectorShardSearch` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Knowledge 语义聚类 / 文档去重、向量近似索引继续留在候选池。
- Connection Layer 与 Monetization Workbench 继续搁置。
