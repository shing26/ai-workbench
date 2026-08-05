# 2026-08-05 错误日志来源 / 设备组合筛选评审

## 结论

- `error_logs` 新增 `device_id TEXT NOT NULL DEFAULT ''`，`migrate_error_log_device` 按列存在性幂等补列；`ErrorLog`、`report_frontend_error`、`list_error_logs` 与 `merge_error_log` 全程携带设备归属，同步快照合并后仍可区分来源设备。
- `get_error_log_summary` 新增 `device_id?` 参数，与 source / severity 组合过滤；System Error logs 卡片新增来源下拉与设备下拉，趋势图、总数徽标与明细列表共用同一过滤条件。
- 前端 `reportFrontendError` 自动读取当前 sync device id 并随 Tauri 命令写入；浏览器 fallback 在 localStorage 上镜像同一过滤语义。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `errorLogSourceDevice` 均为 true（frontend 2 条、current 2 条、tauri + current 0 条、tauri + remote 2 条）。

## 风险与后续

- 来源 / 设备下拉选项来自当前 `logs` 列表（最近 30 条），过滤本身不依赖完整列表，但选项集与明细窗口一致。
- 旧库中未写入 `device_id` 的历史日志显示为 `unknown`，可后续通过设备重映射或迁移回填。
