# Sprint 68 计划：错误日志来源 / 设备组合筛选

目标：把 Error logs 从“只能按严重度过滤”升级为“来源 + 设备组合筛选”。`error_logs` 新增 `device_id` 列，跨设备同步后仍能区分日志来自哪台设备；System 错误日志卡片提供来源与设备下拉，趋势图、总数与明细列表共用同一过滤条件。

## Sprint 68 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Schema 扩展 | `error_logs` 新增 `device_id TEXT NOT NULL DEFAULT ''`，迁移幂等，旧库升级不丢记录 |
| A2 | Rust 数据链路 | `ErrorLog` / `report_frontend_error` / `list_error_logs` / `merge_error_log` 携带 device_id，同步快照保留设备归属 |
| A3 | 聚合过滤 | `error_log_summary` 与 `get_error_log_summary` 新增 `device_id?`，与 source / severity 组合过滤 |
| A4 | TS fallback | `ErrorLog.deviceId`、`summarizeErrorLogs`、`getErrorLogSummary` 镜像 Rust 语义，localStorage 种子与报告写入 deviceId |
| A5 | System UI | Error logs 卡片新增来源下拉与设备下拉，趋势图、总数徽标、明细列表共用 source / severity / device 组合过滤 |
| A6 | 单测 | Rust 覆盖 device_id 迁移字段、device 过滤、source + device 组合过滤与同步快照保留设备归属 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `errorLogSourceDevice` lane：seed 多来源 / 多设备后断言来源、设备与组合过滤后的总数和明细 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 单测覆盖 device_id 迁移、组合过滤与同步保留。
- [x] `verify:ui` / `verify:preview` 的 `errorLogSourceDevice` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.68.0-alpha`。

## 范围外（Backlog）

- 文档健康修复的自动定时巡检。
- git 看板按时间范围过滤与提交人维度。
- 索引队列优先级与失败重试策略。
