# 18 — S3-1: Projects grid mode + ProjectDetailView

**What to build:** Projects 平铺特例落地（tier=grid）+ 详情页内部恢复三层层级。

**Blocked by:** S2-1（tier prop）

**Status:** open

- [ ] `BentoCard` `tier='grid'` 分支：同权集合 + hover 临时聚焦（lift 2px + border-accent），动效 150ms
- [ ] ProjectsView 默认 grid 平铺（替换现全宽卡堆叠）
- [ ] 新建 `ProjectDetailView`：点击卡片进入，内部 Stage（项目主视图）/ Rail（收益/Git）/ Fold（AI 操作）
- [ ] CommandPalette 选 project → 跳 Projects + 预置该卡选中态（Q7 联动）

**Definition of Done:** Projects 是唯一 grid 模式视图；点击进详情恢复三层；多焦点平铺有明确表述。
