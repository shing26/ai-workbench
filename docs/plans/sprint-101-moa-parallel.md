# Sprint 101 计划：真实 MOA 并行聚合

目标：把 AI Studio 的 MOA 模式从“按 Provider 顺序串行聚合”升级为“真实并行聚合”：Rust 后台并发请求前 3 个启用 Provider，浏览器 fallback 用 `Promise.allSettled` 并发消费真实 SSE / NDJSON 流；每条流带 Provider 标题分路展示，单路失败不阻塞其他路，取消语义保持一致。

## Sprint 101 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 并行调度 | `stream_ai_message(moa=true)` 对 `selected.take(3)` 并发 `spawn_blocking`，每路先 emit `## {provider.name}` 再流式输出；单路失败仅 emit `[{name} error: ...]` 片段，全部结束后统一 emit `done` |
| R2 | 浏览器 fallback | `sendAiMessageStream` 的 MOA 分支用 `Promise.allSettled` 并行真实流；`streamProviderLive` 增加 `final` / `manageCancel` 选项，多路共享 runId |
| R3 | 取消兼容 | 并行流共享取消标记：取消后各路提前停止，最终 `done.cancelled = true`，UI 显示 `[stopped]` |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `moaParallel` lane：3 个本地 SSE mock 同时收到请求（`maxActive >= 3`），三个标题与回复都渲染 |
| R5 | 验证脚本稳定 | `reloadAndWait` 改为 `Page.navigate` + URL marker 轮询，`waitForApp` 容忍瞬时 CDP 上下文切换，消除 reload 竞态超时 |

## DoD 检查清单

- [x] MOA 模式 3 个 Provider 真实并行请求，流式内容按 `## Provider` 标题分路渲染。
- [x] 任一 Provider 失败只在该路插入错误片段，其他路正常完成，最终统一 `done` 收尾。
- [x] 取消后所有路提前停止，最终事件带 `cancelled: true`，UI 稳定显示停止状态。
- [x] Rust 114 单测、`cargo fmt`、`cargo clippy --lib -- -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.101.0-alpha`。

## 范围外（Backlog）

- MOA 三路结果再汇聚为最终共识摘要（当前按 Provider 分路平铺展示）。
- Provider 权重 / 路由排序与跨流 token 预算控制。
- 每条流的独立取消与单路重试。
