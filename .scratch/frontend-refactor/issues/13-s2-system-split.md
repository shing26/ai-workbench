# 13 — S2-2: SystemView split into 6 components

**What to build:** 4721 行 SystemView 按层级拆 6 组件，~100 useState 摊入子组件。

**Blocked by:** S2-1（层级定义）

**Status:** open

- [ ] 拆 `SystemStage` / `SystemRail`（TokenRail + HealthRail）/ `SystemFold` + 骨架 `SystemView`
- [ ] 每子组件 state 就地封装；SystemView 近无状态（只读 store + 分发）
- [ ] 逐卡抽取 + 每卡一步验收（verify 保持绿）
- [ ] Webhook/Sync 全家桶表单平移进 SystemDrawer（S2-3）

**Definition of Done:** SystemView 骨架极薄；每组件独立；8 项质量门全绿。
