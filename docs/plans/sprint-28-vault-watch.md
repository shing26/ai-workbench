# Sprint 28 计划：Vault 自动文件监听同步

目标：把 Knowledge 的 Vault Index 从“手动全量扫描”升级为“自动监听 + 增量同步”。用户点击 Watch 后，Vault 目录内的 Markdown 新增、修改、删除都会自动写入 `knowledge_files`，RAG 搜索立即可用，不再需要反复点 Index vault。

## Sprint 28 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 监听核心 | 引入 `notify`，`start_vault_watch` 先全量索引再递归监听；新增/修改自动 `upsert_knowledge_file`，删除自动清理，命中 `.md` 时通过 `vault-watch-update` 事件推送最新状态 |
| A2 | Rust 命令 | `start_vault_watch` / `stop_vault_watch` / `get_vault_watch_status` 注册；单测验证监听线程能增量同步新增与删除文件 |
| A3 | 前端数据层 | `VaultWatchStatus` 类型与 start/stop/get/listen 同构封装，localStorage fallback 模拟 watch 开关并保留已有 Vault 文件 |
| A4 | Knowledge UI | Vault Index 卡片新增 Watch vault / Stop watch 按钮与 Watch 状态 badge，收到监听事件后刷新文件数与 RAG 状态 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 watch 开关、状态 badge、文件数变化与持久化 |

## DoD 检查单

- [x] `cargo test --lib` 23/23 全绿，fmt、clippy 全绿。
- [x] Vault 目录文件新增/修改/删除无需手动 Index，RAG 索引自动跟随。
- [x] 前端 watch 开关与状态 badge 在浏览器 fallback 下可用。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.28.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调。
- 自动执行 commit / 创建远端 PR。
- 跨设备云端同步传输。
