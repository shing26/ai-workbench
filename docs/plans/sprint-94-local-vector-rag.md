# Sprint 94 计划：本地向量 RAG 与跨文件命中

目标：在不引入外部模型依赖的前提下，为 Knowledge 建立本地确定性的 256 维向量索引（Rust 与 TS 镜像实现），并把 BM25 与余弦相似度融合为混合评分；搜索结果支持按来源文件切换过滤，底部展示向量索引状态。

## Sprint 94 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| V1 | 确定性向量嵌入 | Rust `embed_text` 与 TS `embedText` 输出相同的 256 维 hash 向量：fnv1a + Unicode token/1-4 char gram，余弦相似度可区分相近与无关文本 |
| V2 | 混合检索 | `search_thoughts` 同时计算 BM25 与向量余弦，`score = bm25 + 1.2 * vector`，返回 `vector_score`；浏览器 fallback 使用同构实现 |
| V3 | 向量持久化 | `knowledge_files` 新增 `embedding TEXT`，`upsert_knowledge_file` 写入 JSON 向量，`migrate_knowledge_embedding` 幂等补列；`RagIndexStatus` 返回 `vectorIndexed` |
| V4 | 跨文件命中选择器 | 搜索结果含 >=2 个来源文件时显示 `data-cross-file-hits`，chips 可逐文件开关过滤，结果带 `data-rag-file` / `data-rag-vector-score` |
| V5 | 自动化验证 | Rust 单测覆盖确定性、余弦排序、迁移与向量评分；`verify:ui` / `verify:preview` 新增 `vectorRagCrossFile` lane，全 suite 通过 |

## DoD 检查单

- [x] 嵌入结果确定性可复现，空文本零向量不参与评分。
- [x] RAG 混合评分同时依赖 BM25 与向量，结果返回 `vector_score`。
- [x] 旧库通过 `migrate_knowledge_embedding` 平滑补列，索引文件写入 embedding。
- [x] Knowledge 搜索结果跨文件过滤可用，向量状态徽标按真实状态显示。
- [x] `npm run build`、Rust fmt/test/clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.94.0-alpha`。

## 范围外（Backlog）

- 不做真实模型 Embedding（OpenAI / Ollama embeddings），当前为本地确定性 hash 向量，保证离线可用。
- 不做向量增量后台重建与分片索引；文件写入时同步生成 embedding。
- 不做语义聚类 / 文档去重；跨文件过滤只按来源路径分组。
