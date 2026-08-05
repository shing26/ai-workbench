# Sprint 54 计划：可取消 vault 索引任务

目标：让正在运行的全量索引可以被用户立即取消，取消后停止写入并推送 `cancelled` 终态，避免误触发大库索引后只能等待完成。

## Sprint 54 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 取消状态 | `VaultIndexState` 维护 cancelled runId 集合，提供 `mark` / `is_cancelled` / `clear` |
| A2 | 取消检查 | `index_vault_files_inner` 增加 `should_cancel` 回调，每个文件前检查并返回 `Vault index cancelled` |
| A3 | 取消命令 | `cancel_vault_index(run_id)` 标记取消，`start_vault_index` 终态 `status = cancelled` 并清理标记 |
| A4 | 前端取消 | `cancelVaultIndex` 封装 IPC 与 fallback Set；Knowledge 进度条运行中显示 Cancel 按钮 |
| A5 | 单元测试 | 3 文件 vault 取消后 0 文件入库；cancel state 的 mark / clear 断言 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 点击 Cancel 后断言状态变为 `Cancelled` |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 取消单测通过：取消后不写入文件，取消标记可清除。
- [x] Knowledge 运行中显示 Cancel，取消后显示 `Cancelled`；fallback 支持取消且与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 新增取消断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.54.0-alpha`。

## 范围外（Backlog）

- 结构化文档（Markdown/JSON）的字段级三方合并。
- 自定义审计日期范围。
- watch 事件按文件类型的细分统计。
- 索引队列：同时只跑一个任务，后续任务排队。
