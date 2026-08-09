# 09 — S1-4: events.ts single subscription + useEvent

**What to build:** 事件监听上移 store 层，单一订阅 + 按 topic 分发，避免多视图重复监听。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] 新建 `stores/events.ts`：`init()` 时注册一次事件源（fsm/stream/vault/health/clipboard）
- [ ] 内部 Ring Buffer（N=500）+ `Map<topic, Set<listener>>` 分发器
- [ ] `useEvent(topic, handler)` hook：组件卸载自动退订
- [ ] AI Studio 流式特殊处理：`stream-chunk` 挂 store 的 `activeStream` 订阅，按 runId 路由（复用 `AIStudioView.tsx:419` 逻辑）
- [ ] 浏览器 fallback：`CustomEvent('workbench:*')` 走同一入口

**Definition of Done:** 一份底层监听、N 个视图订阅零重复；事件流永续不依赖视图挂载。
