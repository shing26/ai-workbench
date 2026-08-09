# 06 — S1-1: ViewRouter keep-alive (Lazy Mount + Keep Alive)

**What to build:** `ViewRouter` 从 `key={activeView}` 强制重挂载改为保活挂载。

**Blocked by:** P0-2（草稿持久化同分支）

**Status:** open

- [ ] `ViewRouter` 维护 `mountedViews: Set<ViewId>`，首访才挂载，之后 `hidden` 切换
- [ ] 启动只挂初始视图（AI Studio），其余按需挂载
- [ ] 保活视图的 interval 走 `useActiveThrottle`（S1-5）
- [ ] 提供 `KeepAliveView` 组件封装 hidden 切换逻辑

**Definition of Done:** 切视图不卸载；草稿/事件流不丢；启动只挂 1 个视图。
