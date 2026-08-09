# 19 — S3-2: Carousel dual-mode (grid default + carousel optional)

**What to build:** ProjectCarousel 双形态共存：grid 默认，carousel 可选视图，默认关自动轮播。

**Blocked by:** S3-1（grid 模式）

**Status:** open

- [ ] Projects 顶部视图切换（grid / carousel）
- [ ] carousel 保留 drag reorder / material memory / speed（功能资产）；`playing` 默认 false（尊重冻结契约）
- [ ] 两者共享 `workbenchStore.projects` 与同一 detail 入口（→ ProjectDetailView）
- [ ] reduced-motion 下 carousel 退化为 grid

**Definition of Done:** grid 为默认；carousel 可选不干扰；drag reorder/material memory 不浪费。
