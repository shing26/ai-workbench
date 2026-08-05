# Sprint 46 计划：索引并发自动调优

目标：根据设备可用并行度自动推荐 Vault 索引并发数（1~16），Knowledge UI 提供 Auto 开关，同时保留手动输入覆盖。

## Sprint 46 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 推荐算法 | 基于 `available_parallelism` 计算推荐并发，clamp 到 1~16，不可用时回退 4 |
| A2 | Tauri 命令 | 新增 `recommend_index_concurrency`，返回 `{ recommended, cores }`，注册到 invoke handler |
| A3 | 前端透传 | `recommendIndexConcurrency` Tauri 分支 invoke，浏览器 fallback 用 `navigator.hardwareConcurrency` 计算 |
| A4 | Knowledge UI | Vault Index 新增 Auto 开关：开启时并发输入禁用并显示推荐值，Index 使用推荐并发；关闭恢复手动输入 |
| A5 | 单测 | 推荐值在 1~16 且不超过实际核心数 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言 Auto 开启后输入禁用、推荐值在 1~16，关闭后恢复可编辑 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 推荐并发边界单测通过。
- [x] 前端 Auto 开关行为与浏览器 fallback 一致。
- [x] `verify:ui` / `verify:preview` 新增 Auto 断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.46.0-alpha`。

## 范围外（Backlog）

- 目标级索引统计与增量 watch 事件隔离展示。
- 审计事件导出与按设备/时间筛选。
- 三方合并策略与冲突自动化解。
- 按文件规模动态调整并发而非仅按核心数。
