# Sprint 15 计划：流式链路健壮性

目标：加固 AI Studio 流式链路——连接/总超时、增量读取、错误短映射、可中断性与前端状态呈现；浏览器 fallback 可模拟失败路径以便自动化验收。

## Sprint 15 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| S1 | Rust 流式超时 | `stream_client()` 使用 connect timeout 8s + total timeout 30s，openai/ollama 共用 |
| S2 | 增量 SSE 读取 | `stream_openai_compatible` / `stream_ollama` 用 `BufReader.read_line` 逐行读取，取消时立即停止 |
| S3 | 错误短映射 | 超时/连接失败/HTTP 状态码映射为简短错误，不泄露完整 body/密钥；Ollama 缺少 `done:true` 时报错 |
| S4 | 前端状态 | AI Studio 显示 connecting/streaming/error/stopped 状态条，失败显示 Retry 按钮 |
| S5 | 自动化验收 | `verify:ui` 新增流式错误映射断言；完整验证套件通过 |

## 范围外（进入 Backlog）

- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 消息分叉与版本历史
- Provider 周期心跳与状态告警

## DoD 检查单

- [x] Rust 单测覆盖错误映射与截断
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
