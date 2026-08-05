# 2026-08-05 审计按日/周聚合图表评审

## 结论

- `get_sync_audit_summary` 按 `day` / `week` 聚合 `sync_audit_log`：日以 UTC 零点对齐，周以周一 UTC 00:00 起算；统计 merge / resolve / other 三类并补零，bucket 数上限 62。
- System Sync audit 区域新增 Activity 图：Day / Week 分段切换、总数徽标、柱状条按 `bucket.count` 渲染；列表、导出与图表共用同一过滤条件。
- TS fallback 的 `summarizeSyncAudit` 与 Rust 共用 UTC 日 / 周语义，浏览器环境输出一致。
- 验证覆盖：`cargo test --lib` 67/67，fmt、clippy、build 全绿；两条 lane 的 `syncAuditChart` 的 total / barTotal / weekTotal 均为 10，切回 Day 恢复。

## 风险与后续

- 聚合完全在内存中完成，200 条审计上限下开销可忽略；后续若扩大保留量，可考虑 SQL `GROUP BY` 下推。
- preview 曾因 `dist` 旧构建导致图表停在 No activity，发布流程以 `npm run build` 后重新验证为准。
- 后续可做 watch 事件时间线、索引队列持久化、错误日志趋势 / 聚合、RAG 文档状态面板、git 活动看板。
