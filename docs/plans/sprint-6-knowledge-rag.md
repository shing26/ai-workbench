# Sprint 6 计划：Knowledge 本地 RAG 检索

目标：让 Knowledge 视图具备真实可用的本地检索，不依赖外部向量模型：Rust 后台对 thoughts 建立 BM25 索引，前端输入查询后返回相关笔记。

## Sprint 6 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust BM25 检索 | `search_thoughts(query)` 对 thoughts 分词打分，返回相关结果与 score；`get_rag_index_status` 返回索引文档数与状态 |
| D2 | 前端搜索 | Knowledge 视图搜索框调用检索命令，结果可点击进入预览 |
| D3 | 索引状态展示 | Knowledge 卡片显示 RAG 索引状态（indexed / pending）与文档数 |
| D4 | 浏览器 fallback | 非 Tauri 环境用简单关键词检索，保证 UI 验证可运行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib` 全绿 |

## 范围外（进入 Backlog）

- 外部 Embedding 模型接入
- 跨文件/Obsidian Vault 检索
- 检索结果自动注入 AI 上下文

## DoD 检查单

- [ ] `search_thoughts` 与 `get_rag_index_status` 已注册并有单测。
- [ ] Knowledge 搜索返回相关内容，点击可预览。
- [ ] 索引状态显示真实文档数。
- [ ] 动效仍遵守 150ms 与 reduced-motion。
- [ ] PR 已合并到 develop，复盘已更新。
