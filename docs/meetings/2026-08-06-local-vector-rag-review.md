# 2026-08-06 本地向量 RAG 评审

## 结论

- 新增 `src/lib/embed.ts` 与 Rust 镜像实现 `embed_text` / `cosine_similarity`：256 维确定性 hash 向量，Unicode token + 1-4 char gram，双端结果一致；空文本返回零向量。
- `search_thoughts` 升级为混合评分：BM25 词频 + 1.2 * 向量余弦，Rust 结果新增 `vector_score`，浏览器 fallback 用同构 `hybridRagScore`；零向量不会因余弦噪声进入结果。
- `knowledge_files` 新增 `embedding TEXT`：新库直接建列，旧库由 `migrate_knowledge_embedding` 幂等补列；`upsert_knowledge_file` 写入 JSON 向量，`RagIndexStatus` 新增 `vectorIndexed`。
- Knowledge 搜索结果新增 `data-cross-file-hits` 文件选择器：命中文件数 >=2 时显示 chips，逐文件开关过滤，结果行带 `data-rag-file` / `data-rag-vector-score`，底部 `data-vector-status="on"`。
- `verify:ui` / `verify:preview` 新增 `vectorRagCrossFile` lane，dev 与生产构建全绿；Rust 106 个单测通过，clippy 零告警。

## 风险与后续

- 当前向量是本地 hash 近似，语义能力弱于真实 Embedding 模型；后续可接 Ollama / OpenAI embeddings 作为可切换后端。
- 检索为全量线性扫描，文件量大时可加向量分片 / 近似索引结构，留待真实数据规模验证。
- 跨文件过滤只区分来源路径，未做“只检索当前文件”的索引级限定，可作为后续优化。
