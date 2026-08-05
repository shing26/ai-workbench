# Sprint 60 计划：审计按日/周聚合图表

目标：让同步审计从长列表升级为可一眼读懂的活动趋势。System Sync audit 面板新增 Activity 柱状图，按 UTC 日或周（周一为一周起点）聚合 merge / resolve / other 事件，并对缺失日期补零。

## Sprint 60 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 聚合命令 | 新增 `get_sync_audit_summary(granularity, event, since, until, device_id)`，按 `day` / `week` 分组，返回 `SyncAuditSummary { granularity, total, buckets }` |
| A2 | 周起点与补零 | 周一 UTC 00:00 为一周起点；bucket 数 <= 62 时对缺失 bucket 补零 |
| A3 | TS fallback | `summarizeSyncAudit` 镜像 Rust 语义，非 Tauri 环境同样输出 day / week 聚合 |
| A4 | System Activity 图 | Sync audit 区域新增 Day / Week 切换与柱状图，总事件徽标与柱合计一致 |
| A5 | 单测 | Rust 固定时间记录验证 day = 3 buckets、week = 1 bucket，非法粒度报错 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `syncAuditChart` lane：Day 总数 = 柱合计、Week 切换后仍一致、切回 Day 恢复 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（67/67），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖 day / week 分组与补零。
- [x] `verify:ui` / `verify:preview` 的 `syncAuditChart` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.60.0-alpha`。

## 范围外（Backlog）

- watch 事件时间线。
- 索引任务队列持久化。
- 错误日志趋势 / 聚合。
- RAG 文档状态面板。
- git 活动看板。
