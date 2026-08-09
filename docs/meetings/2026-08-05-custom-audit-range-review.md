# 2026-08-05 自定义审计日期范围评审

## 结论

- `list_sync_audit_range` / `export_sync_audit_range` 在原有 `since` 基础上增加 `until`，SQL 以 `created_at <= until` 收口，列表与导出复用同一查询。
- System 的 Sync audit 时间选择器新增 `Custom`，出现起止日期输入；切换日期即时刷新列表，导出沿用相同范围。
- 旧 Tauri 命令签名保持兼容：`until` 为 `None` 时仍走原查询路径，避免破坏既有调用。
- 验证覆盖：`cargo test --lib` 63/63，fmt、clippy、build 全绿；两条 lane 的 `customOk` 均为 true，未来范围断言为空。

## 风险与后续

- 日期输入以本地时区当天 00:00 至 23:59:59.999 计算，跨时区设备共享审计时可能偏移。
- 自定义范围仅作用于审计查询，不改变事件写入与清理策略。
