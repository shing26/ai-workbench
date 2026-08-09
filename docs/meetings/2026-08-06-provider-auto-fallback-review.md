# 2026-08-06 多 Provider 自动降级 Review

## 结论

Sprint 109 完成：AI Studio 在 Single / Auto 模式下会把失败请求自动降级到下一个可用 Provider，并在三处展示回退链。

## 验收证据

- Rust `stream_ai_message` 新增 `auto_fallback`：非 MOA 分支按 `provider_ids` 顺序尝试，失败时 emit `stream-fallback` 并追加 `[auto fallback: A → B]` 文本块；`auto_fallback_marker` 有单测覆盖。
- `src/lib/db.ts` 新增 `StreamFallback` / `listenStreamFallbacks`，浏览器 fallback 与 Tauri 使用同一事件模型和同序降级逻辑。
- AI Studio 头部新增 `data-ai-fallback-chain` 徽标，Inspector 新增 `Fallback chain` 区块；`verify:ui` / `verify:preview` 的 `autoFallback` lane 用 500 + SSE 双 mock 断言消息标记、回复、徽标与 Inspector。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿；Rust 121 条单测通过。

## 遗留

- 自动降级目前覆盖流式请求发起阶段的失败；流中途断开后的续传语义仍保持“已输出内容 + 降级标记 + 下一 Provider 继续”。
- MOA 并行模式下各路已有独立错误片段，暂不叠加自动降级；后续可评估每路内降级。
- Connection Layer 与 Monetization Workbench 继续搁置。
