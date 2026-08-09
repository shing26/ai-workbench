# Sprint 19 计划：剪贴板/日志跨设备同步

目标：为剪贴板历史与错误日志增加跨设备同步能力。以“同步快照文件”为传输介质：任一设备可导出本地数据，另一设备导入后按时间戳合并，冲突项保留较新版本。

## Sprint 19 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| S1 | 同步数据模型 | `clipboard_history` / `error_logs` 增加 `updated_at`；新增 `SyncSnapshot`、`SyncResult` 结构体 |
| S2 | Rust sync 命令 | `export_sync_snapshot` 写入快照 JSON；`import_sync_snapshot` 合并并按 `updated_at` 解决冲突；单测覆盖双设备合并 |
| S3 | 前端数据层 | `exportSyncSnapshot` / `importSyncSnapshot` / `getSyncStatus`，浏览器 fallback 用 localStorage 模拟快照 |
| S4 | 同步 UI | System 视图新增 Sync 卡片：设备标识、导出/导入按钮、上次同步时间与合并统计 |
| S5 | 自动化验收 | `verify:ui` 新增双设备合并断言（远端新增剪贴板与日志合并进本地）；完整验证链通过 |

## 范围外（进入 Backlog）
- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 自动文件监听与云端同步传输
- 多版本图谱与分支可视化

## DoD 检查单

- [x] Rust 单测覆盖快照导出/导入与时间戳冲突解决
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
