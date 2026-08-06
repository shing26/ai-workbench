# Sprint 112 计划：MOA 链式路由

目标：为 AI Studio 的 MOA 模式增加第二种执行拓扑「链式路由」：前 3 个启用 Provider 按优先级顺序串行执行，每个后续 Provider 的请求携带上一路输出作为上下文（`[Previous agent output from X]`），逐步精化答案；最终一步即最终回答，不再追加并行共识摘要。UI 提供 Parallel / Chain 切换、链式徽标与 Inspector Chain 追踪，验证脚本覆盖顺序、串行度与上下文传递。

## Sprint 112 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 链式执行 | `stream_ai_message` 新增 `moa_chain` 参数；`moa_chain=true` 时按优先级顺序逐路请求前 3 个 Provider，每路先 emit `## {name}`，后续请求在原始 messages 后追加 `{role:"user", content:"[Previous agent output from {name}]\n{output}"}`；失败只插入错误片段并继续 |
| R2 | 浏览器同构 | `sendAiMessageStream` 新增 `moaChain`；本地 fallback 串行消费真实 SSE / NDJSON，每步携带上一步输出，取消语义与并行 MOA 一致 |
| R3 | AI Studio UI | MOA 模式新增 `data-moa-chain-mode` Parallel / Chain 切换；Chain 时头部 `data-moa-chain-badge` 显示 `A → B → C`，MOA badge 状态显示 chain，Inspector 展示 Chain 步骤与最终 Provider |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `moaChain` lane：3 个本地 SSE mock 断言请求顺序、`maxActive <= 1`、上下文传递与链式徽标 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器 fallback 同构支持 `moa_chain`，链式上下文以 `[Previous agent output from X]` 追加。
- [x] AI Studio MOA 提供 Parallel / Chain 切换，Chain 徽标与 Inspector 展示链路。
- [x] `moaChain` lane 双端覆盖请求顺序、串行度、上下文传递与最终回答。
- [x] Rust 122 条单测通过，lint / format / build / verify 全绿。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
