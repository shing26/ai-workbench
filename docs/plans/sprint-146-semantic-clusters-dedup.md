# Sprint 146 计划：语义聚类与文档去重

目标：基于已有向量索引，为 Knowledge 增加语义聚类与文档去重能力：按向量相似度将文档聚成簇，识别高相似重复文档，支持忽略（dismiss）与合并（merge）操作，并在浏览器 fallback 保持同构。

## Sprint 146 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| C1 | 聚类数据模型 | 新增 `knowledge_clusters` / `knowledge_cluster_members` / `knowledge_cluster_config` / `knowledge_dedup_candidates` 四张表与索引；新库 SCHEMA 直接建表，旧库由 `migrate_knowledge_clusters` 幂等播种配置。 |
| C2 | 聚类与去重算法 | `recompute_knowledge_clusters` 按余弦相似度贪心聚类并持久化簇、代表文本与成员相似度；`refresh_knowledge_dedup_candidates` 计算高相似对，跳过已 dismiss / merged 组合，文件消失后自动转 merged。 |
| C3 | 去重操作 | `dismiss_knowledge_duplicate` 标记忽略；`merge_knowledge_duplicate` 删除重复文件、刷新分片统计并标记 merged；Tauri 命令与浏览器 fallback 同构。 |
| C4 | Knowledge UI | 新增 Semantic clusters 卡片：阈值输入、Recompute 按钮、簇列表（可展开成员）、去重候选列表（Dismiss / Merge），数据属性覆盖 `data-cluster-*` / `data-dedup-*`。 |
| C5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `knowledgeClusters` / `knowledgeDedupActions` lane；Rust 单测覆盖迁移、聚类分组与去重 dismiss / merge 生命周期。 |
| C6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八门禁全绿后合入 develop。 |

## DoD 检查单

- [x] 旧库打开后聚类四张表自动创建，`knowledge_cluster_config` 播种默认阈值。
- [x] 相似文档聚为一簇，差异文档独立成簇，成员携带相似度。
- [x] 重复文档进入 dedup 列表，dismiss 后不再弹出，merge 后删除重复文件并刷新统计。
- [x] `verify:ui` / `verify:preview` 的 `knowledgeClusters` / `knowledgeDedupActions` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；向量近似索引、Projects 轮播等候选留在候选池。
