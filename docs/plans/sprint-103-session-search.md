# Sprint 103 计划：会话搜索增强

目标：把 AI Studio 会话栏的搜索从“标题/模型精确 includes”升级为日常可用的会话检索：模糊子序列匹配标题与模型，支持消息全文命中并展示摘要，可按时长范围过滤，浏览器 fallback 与 Tauri 后台语义一致。

## Sprint 103 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 搜索层 | 新增 `search_sessions(query, since, until, limit, includeMessages)`：标题 / 模型 / 消息全文命中，模糊子序列评分，pinned 加权，时间范围过滤与 limit |
| R2 | 浏览器 fallback | `db.ts` 新增 `searchSessions`，使用与 Rust 同构的 `sessionMatchScore` / `sessionSnippet`，复用 `ai-workbench:db:v1` 的 sessions 与 chatMessages |
| R3 | AI Studio UI | 搜索框 180ms 防抖；新增时间范围（Any / Today / 7d / 30d）与全文开关；命中行显示摘要与 matchType，空态区分 Searching / No matching sessions |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionSearchEnhanced` lane：模糊标题、消息全文、全文关闭后不命中、恢复列表 |
| R5 | 完整验证 | `npm run build`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`、`verify:preview` 全绿 |

## DoD 检查清单

- [x] 搜索 `sprnt rg` 可通过模糊子序列命中 `sprint RAG check`。
- [x] 搜索 `Streaming fallback` 可通过消息全文命中并展示包含关键词的摘要，matchType 为 `message`。
- [x] 关闭全文开关后消息内容不再参与命中，标题/模型未命中时显示空态。
- [x] Rust 新增 3 条搜索单测：标题/模型/消息、模糊排序、时间范围与 limit；总计 117 单测通过。
- [x] `npm run lint` 0 errors / 0 warnings，`npx prettier --check .` 全绿；无数据库表结构变更；PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.103.0-alpha`。

## 范围外（Backlog）

- 会话内消息级跳转与高亮定位。
- 拼音首字母 / 中文分词模糊匹配。
- 搜索历史、保存的过滤条件与跨会话全文聚合统计。
- MOA 共识摘要与 Provider 权重 / 路由排序。
