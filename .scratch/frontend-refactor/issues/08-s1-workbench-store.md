# 08 — S1-3: workbenchStore refactor + viewState

**What to build:** 修复 `sessions` 永不过期 + `viewState[view]` 交互态上移。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] 修复 `workbenchStore.sessions`：所有会话写操作（rename/delete/archive/pin/duplicate）统一走 store action 并刷新
- [ ] 新增 `stores/viewState.ts`（泛型 `viewState[viewId]` + `useViewState(viewId,key)` hook，仅内存）
- [ ] 上移 4 类高投入态（见 P0-2 清单，此处落地）
- [ ] AIStudio 本地 `sessions` 迁移到 store，消除"裸 db 写入 vs store 写入"混用

**Definition of Done:** store 数据永不过期；交互态可被任意视图读；类型安全窄化。
