# Sprint 49 计划：按文件规模动态索引并发

目标：Auto 模式下由 Rust 后端根据 vault 文件数量与大型文件占比动态选择实际索引并发，避免小文件集线程过载、大文件集 IO 风暴，并在 UI 显示实际使用的工作线程数。

## Sprint 49 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 并发规划 | `plan_index_concurrency(file_count, large_file_count, cores)`：≤32 文件用 1，≤256 或大文件 ≥8 用 min(4, cores)，其余用 min(16, cores) |
| A2 | 自动模式 | `index_vault_files` 收到 `concurrency = 0` 时按文件规模自动规划；`IndexResult` 返回实际 `concurrency_used` |
| A3 | 前端透传 | Knowledge Auto 开启时 `indexVault` 传 0，浏览器 fallback 按文件数模拟同规则并返回实际值 |
| A4 | 结果展示 | Knowledge Vault Index 显示实际工作线程数（`N workers`）与 `data-index-result-workers` |
| A5 | 单元测试 | 覆盖 0/32/100/300 文件、大文件分支与真实 vault 自动索引的并发上限 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言手动并发 clamp 后实际值 1~2，Auto 索引实际值 1~16 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 自动并发规划单测通过，真实 vault 自动索引并发在 1~文件数内。
- [x] Knowledge UI 显示实际工作线程数，浏览器 fallback 与 Rust 规则一致。
- [x] `verify:ui` / `verify:preview` 新增手动与 Auto 实际并发断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.49.0-alpha`。

## 范围外（Backlog）

- 三方合并策略与冲突自动化解决。
- watch 目标级事件隔离与独立增量统计。
- 审计按时间范围与设备 ID 组合筛选。
- 索引进度事件与可取消队列。
