# Sprint 42 计划：Vault 索引并发数可配置

目标：把 Vault 全量索引的并行扫描并发数从硬编码 4 改为可配置，大目录可按机器能力调整 1~16，小文件数自动降级。

## Sprint 42 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 并发参数 | `index_vault_files` 增加 concurrency 参数，clamp 1~16 且不超过文件数；`index_vault_ex` Tauri 命令透传 |
| A2 | 兼容默认 | `index_vault` 与 watch 初始索引保持默认 4，旧调用行为不变 |
| A3 | 端到端单测 | concurrency 0 / 1 / 3 / 16 / 100 下 files 与 ignored 结果一致且不 panic |
| A4 | Knowledge UI | Vault Index 新增 Index concurrency 数字输入（1~16），Index vault 时透传 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言并发输入存在、设置 2 后索引仍正常 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 并发边界与结果稳定性单测通过。
- [x] 前端透传并发数，浏览器 fallback 不改变行为。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.42.0-alpha`。

## 范围外（Backlog）

- 批量仲裁与三方合并策略。
- 多 vault 并行 watch。
- 并发数随设备配置自动调优。
