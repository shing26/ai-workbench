# 10 — S1-5: useActiveThrottle three-tier throttling

**What to build:** 保活视图后台节流 hook，按"活跃/非活跃/文档隐藏"三档降频轮询。

**Blocked by:** S1-1（保活挂载）

**Status:** open

- [ ] 新建 `hooks/useActiveThrottle.ts`：`useActiveThrottle(cb, activeMs, idleMs)`
- [ ] 三档：活跃视图原间隔 / 非活跃降频（System 5s→30s，Knowledge 5s→60s）/ `document.hidden` 暂停
- [ ] 改造点：App.tsx 全局 3s `refreshSystem`（→10s 非活跃）、SystemView 5s interval（webhook 三连）、SystemView auto-sync、KnowledgeView doc-health
- [ ] Live Event Stream 不受节流影响（事件推送驱动，非轮询）

**Definition of Done:** 后台空转最小化；事件流仍实时。
