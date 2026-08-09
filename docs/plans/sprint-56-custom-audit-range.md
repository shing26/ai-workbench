# Sprint 56 计划：自定义审计日期范围

目标：为 Sync audit 提供任意起止日期筛选，列表与导出共用同一范围语义，补齐 Today / 7 天之外的长周期审计场景。

## Sprint 56 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 后端范围查询 | `list_sync_audit_range` 支持 `since` + `until`，SQL 增加 `created_at <= until` |
| A2 | 导出一致 | `export_sync_audit_range` 复用同一范围查询，JSON/CSV 与列表所见一致 |
| A3 | 前端自定义 | System audit 新增 `Custom` 选项与起止日期输入，列表与导出透传 `since/until` |
| A4 | 单元测试 | 固定 created_at 事件按起止范围筛选，越界范围返回空 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 断言自定义范围有结果、未来范围为空 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 自定义范围单测通过：`since` + `until` 过滤、JSON 导出一致。
- [x] System 提供 `Custom` 日期输入，列表与导出透传起止时间。
- [x] `verify:ui` / `verify:preview` 的 `customOk` 为 true，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.56.0-alpha`。

## 范围外（Backlog）

- watch 事件按文件类型的细分统计。
- 索引任务队列（同时只跑一个任务）。
- 结构化合并的对象数组按 key 去重。
- 审计统计图表（按日/周聚合）。
