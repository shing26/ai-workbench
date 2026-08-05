# 2026-08-05 审计时间与设备组合筛选评审

## 结论

- `list_sync_audit` 新增 `since` / `device_id` 参数，SQL 使用 `(?2 IS NULL OR created_at >= ?2)` 与 `(?3 IS NULL OR device_id = ?3)` 与事件条件组合，LIMIT clamp 1~200 不变。
- `export_sync_audit` 复用同一过滤链路，JSON / CSV 导出与列表看到的数据一致。
- 前端 `listSyncAudit` / `exportSyncAudit` 新增可选 since / deviceId，浏览器 fallback 在 localStorage 数组上做同样过滤。
- System Sync audit 面板新增时间范围与设备下拉框，导出按钮沿用当前筛选。
- 验证覆盖：`cargo test --lib` 54/54，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言 Today 范围下 resolve 筛选仍完整、导出与清空链路正常。

## 风险与后续

- 时间范围目前是预置档位，自定义日期与小时粒度留在 backlog。
- 设备筛选用精确匹配，多设备别名场景后续可加模糊匹配。
