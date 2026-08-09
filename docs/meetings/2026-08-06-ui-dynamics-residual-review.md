# 2026-08-06 UI 动效残留补全评审

## 结论

- Projects 新增 `data-project-carousel` 卡片：Orbit 模式用 3D 环形定位（translate3d + rotateY），Fan 模式用扇形堆叠（rotateZ + 前景选中），导航支持按钮、滚轮与方向键，切换 150ms。
- Autoplay 为显式开关：`data-carousel-play` 开启后 rAF 推进位置，hover / focus 暂停；`prefers-reduced-motion` 下自动关闭并停用过渡，不引入默认持续装饰动画。
- Header 新增 Material Settings 入口：`data-material-drawer` 抽屉实时调整 `data-material-preset`、`data-material-opacity`、`data-material-blur`，改写 `--material-opacity-base` / `--material-blur-base` 与 `data-material-global`，localStorage `ai-workbench:material-settings:v1` 持久化。
- 修掉 Motion DoD 的一个隐患：Inspector 宽度断言原先裸取 `aside`，新增 Material 抽屉后首个 aside 会变成抽屉；改为按 `aside.drawer-panel` 定位，布局稳定性断言恢复。
- `verify:ui` / `verify:preview` 新增 `projectCarousel` / `projectCarouselReduced` / `materialDrawer` lane，dev 与生产构建全绿。

## 风险与后续

- 轮播当前只服务 Projects 视图；若要覆盖会话 / Agent 场景可再扩展组件复用。
- Material 设置是全局预设，逐卡独立配色与“仅自定义卡”模式留在 Backlog。
- 后续可加轮播速度控制与拖拽排序，继续作为 UI 候选 Sprint。
