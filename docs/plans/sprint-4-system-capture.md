# Sprint 4 计划：System & Automation 真实采集

目标：把 System 视图从示例数据升级为真实本地采集，完成剪贴板历史与错误日志的 SQLite 持久化、后台监听、前端实时刷新，并延续 150ms 动效约束。

## Sprint 4 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| B1 | SQLite 迁移：clipboard_history、error_logs | 启动自动建表，空表自动写入示例历史 |
| B2 | Rust 剪贴板监听 | 后台轮询剪贴板文本，变化时写入 SQLite 并通过 Tauri Event 推送前端 |
| B3 | Rust 错误日志 | `report_frontend_error` 命令把前端 error/unhandledrejection 写入 SQLite |
| B4 | 前端实时订阅 | System 视图监听 `clipboard-updated` 事件并轮询日志，全局错误自动上报 |
| B5 | System 视图真实数据 | 剪贴板历史与错误日志显示来源、时间、内容，保留 Provider 配置卡片 |
| B6 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib` 全绿 |

## 范围外（进入 Backlog）

- AI Studio 真流式输出（Sprint 5 候选）
- RAG 向量索引真实执行
- Webhook、云同步、移动端

## DoD 检查单

- [ ] 剪贴板新内容在 Tauri 下写入 SQLite 并推送到 System 视图。
- [ ] 前端异常写入 error_logs，System 视图可读。
- [ ] 示例数据只在空表时写入，旧库升级不覆盖真实记录。
- [ ] 动效仍遵守 150ms 与 reduced-motion。
- [ ] PR 已合并到 develop，复盘已更新。
