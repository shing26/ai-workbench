# 2026-08-05 同步审计筛选与导出评审

## 结论

- `list_sync_audit` 新增可选 `event` 过滤，SQL 使用 `(?1 IS NULL OR event = ?1)`，不传时保持全量行为；limit clamp 1~200 不变。
- 新增 `export_sync_audit`：JSON 走 `serde_json::to_string_pretty`，CSV 手写表头与转义（逗号、双引号、CR/LF），非法格式返回明确错误。
- 前端 `listSyncAudit(limit, event)` 与 `exportSyncAudit(format, event)` 双通道：Tauri invoke 直达 Rust，浏览器 fallback 从 `ai-workbench:sync-audit:v1` 过滤并生成同构文本。
- System Sync audit 面板新增事件筛选下拉框、JSON / CSV 导出按钮与导出数量提示；导出通过 Blob 下载文件。
- 验证覆盖：`cargo test --lib` 49/49，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言筛选后仅剩 `sync.resolve`、导出提示 `Exported 3 sync audit event(s)`、Clear 后清空。

## 风险与后续

- CSV 导出不做 RFC 4180 之外的方言选项，后续若需要可分号分隔或 BOM。
- 筛选目前只按事件精确匹配，时间范围与设备组合筛选留在 backlog。
