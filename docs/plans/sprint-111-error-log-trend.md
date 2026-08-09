# Sprint 111 计划：错误日志趋势优化

目标：为 System 错误日志趋势加入 24h / 7d / 30d 时间范围与峰值告警。24h 使用小时粒度分桶，7d / 30d 使用日粒度；最高桶超过均值 3 倍时显示异常峰值徽标，帮助快速定位日志突增。

## Sprint 111 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 聚合扩展 | `error_log_summary` 支持 `hour` 粒度与可选 `since_ms` / `until_ms` 范围过滤；Tauri 命令 `get_error_log_summary` 同步传参 |
| R2 | 浏览器同构 | `summarizeErrorLogs` / `getErrorLogSummary` 支持 `hour` 粒度与 `sinceMs` / `untilMs`，与 Rust 同一分桶语义 |
| R3 | System UI | Error logs 卡片改为 24h / 7d / 30d 范围切换；图表按范围自动切换 hour / day 粒度；新增 `data-error-peak` 峰值徽标（top bucket 超过均值 3 倍且 count >= 3 时显示） |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 的 `errorLogTrend` lane 覆盖 24h / 7d / 30d 过滤，新增 `errorLogPeakAlert` lane 覆盖尖峰徽标出现与切换范围后消失 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持 hour 粒度与时间范围过滤，单测覆盖范围边界与小时分桶。
- [x] System Error logs 卡片提供 24h / 7d / 30d 切换，图表粒度和明细列表随范围联动。
- [x] 峰值告警按“最高桶 >= 3 倍均值”触发，验证 lane 双端覆盖。
- [x] Rust 121 条单测通过，lint / format / build 全绿。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
