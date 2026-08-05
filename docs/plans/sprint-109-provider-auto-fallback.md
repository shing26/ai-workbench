# Sprint 109 计划：多 Provider 自动降级

目标：Single / Auto 模式下，主 Provider 流式失败时自动按传入顺序降级到下一个可用 Provider，并在消息正文、头部徽标与 Inspector 中展示回退链，避免一次请求因单个节点故障直接失败。

## Sprint 109 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 自动降级 | `stream_ai_message` 新增 `auto_fallback` 参数：非 MOA 分支按 `provider_ids` 顺序逐个尝试，失败时 emit `stream-fallback` 事件并追加 `[auto fallback: A → B]` 文本块 |
| R2 | 浏览器同构 | `sendAiMessageStream` 在 `autoFallback` 下按传入顺序降级；`StreamFallback` 本地事件与 Tauri 事件同一模型 |
| R3 | UI 回退链 | AIStudioView 监听 `stream-fallback`，头部展示 `data-ai-fallback-chain` 徽标，Inspector 新增 `Fallback chain` 区块 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `autoFallback` lane：本地 500 + SSE 双 mock 断言消息标记、回复、徽标与 Inspector；Rust 新增 marker 单测 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Single / Auto 模式主 Provider 失败后自动切换下一 Provider。
- [x] 回退链在消息正文、头部徽标与 Inspector 三处可见。
- [x] Rust 与浏览器 fallback 行为一致，验证 lane 双端覆盖。
- [x] Rust 121 条单测通过，lint / format / build 全绿。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
