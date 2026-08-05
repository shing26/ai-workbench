# Sprint 51 计划：审计时间与设备组合筛选

目标：Sync audit 在事件筛选之外支持时间范围与设备来源组合过滤，列表与 JSON / CSV 导出使用同一过滤条件。

## Sprint 51 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 查询扩展 | `list_sync_audit` 增加 `since` 与 `device_id` 参数，SQL 与事件条件组合过滤 |
| A2 | 导出扩展 | `export_sync_audit` 透传 `since` / `device_id`，导出内容与列表一致 |
| A3 | 前端透传 | `listSyncAudit` / `exportSyncAudit` 支持 since / deviceId，浏览器 fallback 同步过滤 |
| A4 | System UI | Sync audit 新增时间范围（All time / Today / Last 7 days）与设备（All / Current）下拉框 |
| A5 | 单元测试 | 覆盖设备过滤、未来时间返回空、导出组合过滤 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言 Today 范围下筛选结果仍完整且事件类型不变 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] since / device_id 组合过滤单测通过，导出与列表一致。
- [x] System UI 时间与设备筛选可用，浏览器 fallback 语义一致。
- [x] `verify:ui` / `verify:preview` 新增时间范围断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.51.0-alpha`。

## 范围外（Backlog）

- watch 目标级事件隔离与独立增量统计。
- 索引进度事件与可取消队列。
- 结构化文档（Markdown/JSON）的字段级三方合并。
- 审计按小时粒度与自定义日期范围筛选。
