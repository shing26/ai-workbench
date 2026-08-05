# Sprint 33 计划：跨设备云端同步传输

目标：把 Sync snapshot 从“本地文件导入导出”升级为“HTTP 远端 Push / Pull”。配置 Remote URL（可选 Bearer Token）后，剪贴板与错误日志可跨设备推送和拉取，合并语义沿用 Sprint 19 的 `updated_at` 冲突规则。

## Sprint 33 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | db 合并重构 | `build_sync_snapshot` / `merge_sync_snapshot` 从文件导入导出中拆出，`import_sync_snapshot` 复用 |
| A2 | Rust 远端命令 | `push_sync_snapshot(remote_url, token)` PUT JSON，`pull_sync_snapshot(remote_url, token)` GET JSON 后按 `updated_at` 合并；可配置 Bearer Token |
| A3 | 端到端单测 | 本地 `TcpListener` 验证 Push 请求体与 Authorization 头、Pull 解析合并 |
| A4 | System UI | Sync snapshot 卡片新增 Remote URL / Token 输入与 Push / Pull 按钮，回显结果 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Push / Pull 结果可见 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 本地 HTTP 服务端到端验证 Push / Pull / Token / 合并。
- [x] 浏览器 fallback 下 Push / Pull 可用且结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.33.0-alpha`。

## 范围外（Backlog）

- 定时自动同步与冲突 UI。
- 端到端加密。
- 冲突自动解决 / 三方合并策略。
