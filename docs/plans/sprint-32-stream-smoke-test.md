# Sprint 32 计划：Provider 端到端流式联调

目标：把“真实 Provider 端到端流式联调”从不可验证的 backlog 项变成可执行能力。Rust 流式核心改为可注入 sink 的纯函数，用本地 SSE 服务做端到端单测；System Provider 卡片新增 Stream test 按钮，对真实 Provider 发一次两段式流请求并回显分块数。

## Sprint 32 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 流式核心重构 | `stream_openai_compatible_with` / `stream_ollama_with` 支持 `is_cancelled` 与 `emit` 注入，原 Tauri 命令行为不变 |
| A2 | Smoke Test 命令 | `run_provider_stream_smoke_test(provider_id)` 对配置 Provider 发起流请求，返回 `{ ok, chunks, message }` |
| A3 | 端到端单测 | 本地 `TcpListener` 模拟 OpenAI SSE 服务，断言两段 delta 正确解析；无 `[DONE]` 时返回明确错误 |
| A4 | System UI | Provider 卡片新增 Stream test 按钮与结果回显，浏览器 fallback 返回确定性 2 chunk |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 stream smoke 结果可见 |

## DoD 检查单

- [x] `cargo test --lib` 31/31 全绿，fmt、clippy 全绿。
- [x] 本地 SSE 服务端到端验证真实 HTTP + 分块解析路径。
- [x] System 卡片一键联调可回显 chunk 数或错误。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.32.0-alpha`。

## 范围外（Backlog）

- 云端同步传输。
- 流式取消的真实网络中断（当前仍为停止渲染）。
- 冲突自动解决 / 三方合并策略。
