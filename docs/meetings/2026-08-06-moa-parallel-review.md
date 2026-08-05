# 2026-08-06 真实 MOA 并行评审

## 结论

- Rust `stream_ai_message` 的 MOA 分支改为并发 `spawn_blocking`：按 `selected.take(3)` 并行请求，每路先 emit `## {provider.name}` 再流式输出；单路失败只写 `[{name} error: ...]`，全部结束后统一 emit `done`。
- `src/lib/db.ts` 浏览器 fallback 用 `Promise.allSettled` 并行真实 SSE / NDJSON；`streamProviderLive` 新增 `final` / `manageCancel` 选项，多路共享 runId，取消后最终 `done.cancelled = true`。
- `verify:ui` / `verify:preview` 新增 `moaParallel` lane：3 个本地 SSE mock 断言 `maxActive >= 3`，三个 Provider 标题与回复均渲染，dev 与 preview 全绿。
- `reloadAndWait` 改为 `Page.navigate` + URL marker 轮询，`waitForApp` 对瞬时 CDP 上下文切换重试，解决 reload 竞态导致的 `Runtime.evaluate` 超时。

## 排查询记录

- `verify:ui` 首轮在 reload 后偶发 `Runtime.evaluate` 超时：旧的 `Page.loadEventFired` 等待会在导航前的旧上下文返回就绪，随后 lane 的 evaluate 落在被销毁的上下文上；改为 marker 轮询后稳定。
- MOA lane 首轮 `maxActive = 0`：mock server 的 `Access-Control-Allow-Headers` 只写 `Content-Type`，携带 `Authorization` 的流请求预检被浏览器拦截；补上 `Content-Type, Authorization` 后三路请求同时到达。
- 浏览器 fallback 的取消标记由各分路共享，`streamProviderLive({ final: false, manageCancel: false })` 保证单路结束不误删共享标记，由外层统一清理并收尾。

## 风险与后续

- MOA 当前按 Provider 分路平铺输出，尚未做最终共识摘要；如需“三路结果再汇聚”可排入后续 Sprint。
- Provider 数量超过 3 时只取前 3 个启用项，未做权重排序与动态路由。
- 保留 `moaParallel` lane，修改流式链路、取消语义或 Provider 选择逻辑时重跑 `verify:ui` / `verify:preview`。
