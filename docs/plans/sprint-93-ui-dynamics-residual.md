# Sprint 93 计划：UI 动效残留补全

目标：把 `octopus-kaogong-workbench` 模板中 Sprint 22 明确放到 Backlog 的 4 项动效落地为对工作台真正有用的交互：Projects 3D Orbit / Fan Stack 项目轮播（含显式 autoplay）、全局 Material Settings 实时调参抽屉。持续动画只由用户显式开启，且完全遵守 `prefers-reduced-motion`。

## Sprint 93 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| U1 | Projects 轮播骨架 | Projects 视图新增 `data-project-carousel` 卡片：`data-carousel-scene`、`data-carousel-card`（含 project / material 元数据）、`data-carousel-index`、`data-carousel-prev` / `data-carousel-next` |
| U2 | Orbit / Fan 双模式 | `data-carousel-mode="orbit"` / `data-carousel-mode="fan"` 切换；orbit 用 3D 环形定位，fan 用扇形堆叠，选中卡在前景，交互切换 <=150ms |
| U3 | Autoplay | `data-carousel-play` 显式开关，rAF 连续推进位置，hover/focus 暂停；`prefers-reduced-motion` 下自动关闭且过渡归零 |
| U4 | Material 抽屉 | Header 新增 `data-material-settings-open`，打开 `data-material-drawer`：`data-material-preset` / `data-material-opacity` / `data-material-blur` 实时改 CSS 变量与预览，localStorage `ai-workbench:material-settings:v1` 持久化 |
| U5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectCarousel` / `projectCarouselReduced` / `materialDrawer` lane，全 suite 通过 |

## DoD 检查单

- [x] 轮播在 1440px / 390px 下无横向溢出，卡片不空白、无未渲染区域。
- [x] 交互切换与抽屉开合 <=150ms，只用 `transform` / `opacity` / `filter`。
- [x] `prefers-reduced-motion` 下 autoplay 关闭、transition 归零。
- [x] Material 设置实时生效并持久化，重载后恢复。
- [x] `npm run build`、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.93.0-alpha`。

## 范围外（Backlog）

- 不做模板原样的全屏 3D 轮播舞台；当前仅作为 Projects 视图内的工具卡片。
- 不做拖拽排序轮播 / 速度滑杆；后续可加到 Backlog。
- Material 设置目前为全局 preset + 强度，不做逐卡独立配色记忆。
