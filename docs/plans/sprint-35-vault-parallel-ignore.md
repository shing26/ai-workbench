# Sprint 35 计划：Vault 大目录并行扫描与 ignore 列表

目标：把 Vault 索引从“串行全量递归”升级为“并行读取解析 + 可配置 ignore 列表”，大目录扫描更快，且可排除 `node_modules`、归档目录等不需要进入 RAG 的内容。

## Sprint 35 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | ignore 匹配 | 新增 `should_ignore_path`，支持目录名（任意层级）与 `**` / `*` glob；命中目录整体跳过 |
| A2 | 并行扫描 | `index_vault_files` 先收集路径，再用 `thread::scope` 分块并行读取解析 Markdown，主线程统一 upsert；`IndexResult` 返回 `{ files, ignored }` |
| A3 | 新命令 | 新增 `index_vault_ex(vault_path, ignore_patterns)`，`index_vault` 保持默认空 ignore 兼容 |
| A4 | Knowledge UI | Vault Index 卡片新增 Ignore patterns 输入，扫描后展示已索引与已忽略计数 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 ignore 输入后 files 减一、ignored 计数可见 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] ignore 目录/glob 与并行扫描集成单测通过。
- [x] 浏览器 fallback 下 ignore 输入生效且计数可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.35.0-alpha`。

## 范围外（Backlog）

- Vault watch 监听 ignore 列表。
- 同步快照定时自动同步与冲突 UI。
- 逐文件冲突预览与人工编辑合并。
