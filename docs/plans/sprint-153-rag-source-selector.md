# Sprint 153 计划：RAG 命中来源跨文件选择器与“记住选择”偏好

目标：RAG 确认发送时按来源文件勾选，记住选择后后续搜索只在该来源内命中，并支持一键 Reset。

## Sprint 153 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| S1 | Rust 搜索结果携带来源 | `RagSearchResult` 新增 `source_kind / source_file / vault_path`；文件命中的 `source_file` 返回 `knowledge_files.path`（不是 UUID id），`vault_path` 随行返回。 |
| S2 | Rust 来源过滤 | `search_thoughts` 新增 `source_filter: Option<RagSourceFilter>`；`enabled + selected` 时只返回 `file_paths` 命中的文件，`all` 或 `selected` 但路径为空时不过滤，thought 命中不受影响。 |
| S3 | 浏览器 fallback 同构 | `RagSearchResult` / `RagSourcePreference` 类型补齐；localStorage key `ai-workbench:rag-source-preference:v1`，`get/setRagSourcePreference` 与 `searchThoughts(query, limit, sourcePref?)` 同构过滤。 |
| S4 | AI Studio 交互 | 确认面板按来源分组勾选；勾选 “Remember this source selection” 后写入偏好并刷新徽标；Reset 清除偏好；New chat / 切换会话 / Cancel 清理临时状态。 |
| S5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `ragSourceSelector` / `ragSourcePersisted` lane：种子两个 vault 文件、勾选来源、记住后 reload 仍生效、搜索只命中记住的文件、Reset 清除；Rust 单测覆盖 selected / all / 空路径语义，总数增至 189。 |
| S6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合并 develop。 |

## DoD 检查单

- [x] RAG 文件命中返回真实路径，浏览器与 Tauri 链路来源一致。
- [x] 记住选择后 reload 仍生效，搜索只命中记住的源；Reset 后恢复全源。
- [x] selected 空路径不过滤，Rust 与浏览器语义一致。
- [x] `verify:ui` / `verify:preview` 的 `ragSourceSelector` / `ragSourcePersisted` lane 双端通过；Rust 单测 189/189。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Webhook payload 高级模板、AI Studio 会话导出、Knowledge 向量分片 / 近似索引为后续 Sprint 候选。
- Connection Layer 与 Monetization Workbench 继续搁置。
