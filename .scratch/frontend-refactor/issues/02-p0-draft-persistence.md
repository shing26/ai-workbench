# 02 — P0-2: Draft & interaction state persistence

**What to build:** 修复切视图丢草稿与交互状态问题，为 Q1/Q5/Q12 打底。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] 引入 `stores/viewState.ts`（`viewState[viewId]` 泛型 store + `useViewState(viewId,key)` hook）
- [ ] 上移 4 类高投入态：AI Studio（input/sessionId/collapsedGroups/ragHits）、Knowledge（selectedId/query/filter/tag）、Projects（grid/carousel 形态）、Actions（selectedDay）
- [ ] `ViewRouter` 从 `key={activeView}` 改为保活挂载（Lazy Mount + Keep Alive，见 S1-1）
- [ ] verify lane：输入草稿 → 切视图 → 切回 → 草稿保留

**Definition of Done:** 切视图不再丢失用户已投入的交互态；瞬态（busy/error）留在组件本地。
