# Sprint 53 计划：vault 索引进度事件

目标：让 Vault 全量索引在后台线程异步执行，通过 Tauri Event 持续推送进度，Knowledge 视图实时显示进度条与完成状态，避免界面等待阻塞。

## Sprint 53 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 进度回调 | `index_vault_files_inner` 支持 `on_progress`，每 5 个文件或全部写完时回调 `(done, total)` |
| A2 | 后台索引命令 | `start_vault_index` spawn 后台线程并返回 `runId`，完成或错误时 emit `vault-index-progress` 终态 |
| A3 | 前端监听 | `startVaultIndex` / `listenVaultIndexProgress` 封装 IPC 与浏览器 fallback 3 步模拟 |
| A4 | 视图展示 | Knowledge Vault Index 显示 `data-index-progress` 进度条与 `data-index-progress-status` 状态，完成后刷新状态 |
| A5 | 单元测试 | 3 文件 vault 断言进度回调最后一次为 `(3, 3)` |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言进度条到 100 且状态含 `Indexed` |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 进度回调与 `start_vault_index` 单测通过，事件含 `runId` / `done` / `total` / `status`。
- [x] Knowledge 视图显示进度条与完成状态，浏览器 fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 新增进度断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.53.0-alpha`。

## 范围外（Backlog）

- 可取消索引任务与取消队列。
- 结构化文档（Markdown/JSON）的字段级三方合并。
- 自定义审计日期范围。
- watch 事件按文件类型的细分统计。
