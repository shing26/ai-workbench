# Sprint 9 计划：跨文件 / Obsidian Vault 索引

目标：把本地 Markdown 文件夹（Obsidian Vault）纳入 RAG，扫描 `.md` 文件、解析 frontmatter 并持久化到 SQLite，让 Knowledge 搜索与 AI Studio RAG 注入都能引用本地文件。

## Sprint 9 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | 数据模型 | SQLite 新增 `knowledge_files` 表（path 唯一、title、tags、content、indexed_at） |
| D2 | Rust 索引 | `index_vault(vault_path)` 递归扫描 `.md`，解析 frontmatter，upsert 入库并返回文件数 |
| D3 | 状态与检索 | `get_knowledge_index_status` 返回文件数；`search_thoughts` 同时检索 thoughts 与 knowledge_files |
| D4 | 前端 Vault Index | Knowledge 视图新增 Vault 路径输入、Index 按钮与文件数 badge；浏览器 fallback 模拟本地文件 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 文件监听与增量索引（当前每次 Index 全量扫描 upsert）
- 向量 Embedding 模型接入
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] `knowledge_files` 表已建并有 Rust 单测覆盖扫描与检索
- [x] Knowledge 视图可索引 Vault 并显示文件数
- [x] `verify:ui` 能稳定断言 Vault 索引与文件命中
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
