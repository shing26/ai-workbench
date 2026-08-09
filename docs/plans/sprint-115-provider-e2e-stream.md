# Sprint 115 计划：真实 Provider 端到端流式联调

目标：把 Provider 联调从“smoke 只数 chunk”升级为“端到端流式联调报告”：System Provider 卡片新增 E2E test 按钮，按真实流式链路发送探针消息，返回 chunk 数、字符数、耗时与回复预览；Rust 与浏览器 fallback 同构，验证 lane 用本地 SSE mock 覆盖完整链路。

## Sprint 115 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 联调命令 | 新增 `run_provider_e2e_stream(provider_id)`：复用 `stream_openai_compatible_with` / `stream_ollama_with` 计数 chunk / chars 并计时，返回 `ProviderE2eResult { ok, chunks, chars, durationMs, message }` |
| R2 | 浏览器 fallback | `runProviderE2EStream`：可真实流式 Provider 走 `streamProviderLive`（带 `onChunk` 计数），否则返回确定性 mock；与 Rust 同构 |
| R3 | System UI | Provider 卡片新增 `data-provider-e2e-test` 按钮与 `data-provider-e2e-result`，展示 ok / chunks / chars / ms |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `providerE2EStream` lane：点击 E2E 后断言结果含 chunks / chars / ms |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器 fallback 同构支持 `run_provider_e2e_stream`，返回统一指标。
- [x] System Provider 卡片提供 E2E test 按钮与结果展示。
- [x] `providerE2EStream` lane 双端覆盖 chunk / chars / duration 断言。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
