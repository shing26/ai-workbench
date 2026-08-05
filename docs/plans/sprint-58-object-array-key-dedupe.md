# Sprint 58 计划：结构化合并对象数组按 key 去重

目标：修复结构化合并中对象数组因 key 顺序不同而被重复保留的问题，去重时按规范化后的 key/value 判断。

## Sprint 58 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 规范化序列化 | `canonical_json` 递归排序对象 key 后输出稳定字符串 |
| A2 | 数组去重 | `merge_json_value` 数组分支改用 `canonical_json(item)` 作为去重标记 |
| A3 | 前端一致 | TS fallback 新增 `canonicalJson`，与 Rust 同语义 |
| A4 | 单元测试 | `{id,label}` 与 `{label,id}` 视为同项，合并后数组长度 2 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 对象数组合并后 `notes.length === 2` |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 对象数组按 key 去重单测通过，Rust 与 fallback 语义一致。
- [x] `verify:ui` / `verify:preview` 的 `structuredSync.notesLength` 均为 2，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.58.0-alpha`。

## 范围外（Backlog）

- 索引任务队列（同时只跑一个任务）。
- 审计按日/周聚合图表。
- watch 事件时间线。
- 嵌套数组的深层对象 key 排序边界测试。
