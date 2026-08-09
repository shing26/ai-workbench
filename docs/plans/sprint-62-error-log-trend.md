# Sprint 62 计划：错误日志趋势与聚合

目标：让 Error logs 从“最近列表”升级为可一眼读懂的诊断趋势。System 错误日志卡片新增日 / 周聚合柱状图，按 error / warning / info 分层展示，并支持严重度过滤。

## Sprint 62 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 聚合命令 | 新增 `get_error_log_summary(granularity, source?, severity?)`，按 UTC 日 / 周分组返回 `ErrorLogSummary { granularity, total, buckets }` |
| A2 | 严重度分层 | bucket 内统计 `error` / `warning` / `info`，未知 severity 归入 info；bucket 数 <= 62 时补零 |
| A3 | TS fallback | `summarizeErrorLogs` 镜像 Rust 语义，非 Tauri 环境同样输出日 / 周聚合 |
| A4 | System Error 图 | Error logs 卡片新增 Day / Week 切换、严重度下拉与分层柱状图，总数徽标与柱合计一致 |
| A5 | 单测 | Rust 固定时间记录验证 day = 3 buckets、week = 1 bucket，severity / source 过滤与非法粒度报错 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `errorLogTrend` lane：总数、分层计数、Week 切换、error 过滤后总数与柱合计一致 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（69/69），fmt、clippy、build 全绿。
- [x] Rust 单测覆盖 day / week 分组、severity / source 过滤与补零。
- [x] `verify:ui` / `verify:preview` 的 `errorLogTrend` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.62.0-alpha`。

## 范围外（Backlog）

- 索引任务队列持久化。
- RAG 文档状态面板。
- git 活动看板。
- 错误日志来源 / 设备组合筛选。
