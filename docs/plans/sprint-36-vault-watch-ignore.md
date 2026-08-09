# Sprint 36 计划：Vault watch 遵守 ignore 列表

目标：让 Sprint 35 的 ignore 语义覆盖 watch 场景：启动监听时初始索引应用 ignore，增量事件（新增/修改/删除）也跳过 ignore 命中的路径，避免 `node_modules` 等目录在监听期间污染 RAG。

## Sprint 36 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 命令 | 新增 `start_vault_watch_ex(vault_path, ignore_patterns)`，`start_vault_watch` 默认空 ignore 兼容 |
| A2 | 事件过滤 | 抽出 `sync_vault_event`，对事件路径先计算相对路径并应用 `should_ignore_path`，命中则跳过 upsert/delete |
| A3 | 端到端单测 | 真实仓库验证：ignore 目录下的新增 Markdown 不入库，普通目录新增正常索引 |
| A4 | Knowledge UI | Watch vault 复用 Ignore patterns 输入，watch 后 Skipped 计数保持可见 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 watch 开启时 Skipped 计数仍为 1 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] watch 事件 ignore 过滤单测通过。
- [x] 浏览器 fallback 下 watch 与 ignore 计数同时可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.36.0-alpha`。

## 范围外（Backlog）

- 同步快照定时自动同步与冲突 UI。
- 逐文件冲突预览与人工编辑合并。
- Vault 索引并发数可配置。
