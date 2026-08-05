# 2026-08-05 错误日志趋势聚合评审

## 结论

- 新增 `error_log_summary` 聚合函数与 Tauri 命令 `get_error_log_summary`：按 UTC 日 / 周分组 `error_logs`，每个 bucket 拆分 error / warning / info，缺失区间补零。
- System Error logs 卡片新增 Day / Week 分段切换、严重度下拉与分层柱状图，总数徽标与柱合计一致；浏览器 fallback 用 `summarizeErrorLogs` 镜像同一语义。
- Rust 单测覆盖 day / week 分组、severity / source 过滤与非法粒度；UI 验证覆盖总数 4、error 2 / warning 1 / info 1、week 2 桶与 error 过滤后总数 2。
- 验证覆盖：`cargo test --lib` 69/69，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `errorLogTrend` 均为 `{ ok: true, total: 4, barTotal: 4, filterOk: true }`。

## 风险与后续

- 聚合按 `updated_at` 分组，历史记录跨设备同步后时间戳以合并结果为准。
- 当前 UI 只提供 severity 过滤，source 过滤保留在命令层，后续可加来源下拉。
