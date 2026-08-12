# 2026-08-13 UI Redesign 设计评审

## 背景

React 版旅程指挥台此前只是换壳，视图内部仍堆叠旧组件。本次评审确认以 `D:\ai-workbench\preview-redesign.html` 为唯一视觉与组件结构基准，目标是对齐每个视图的区块、卡片与间距，并把设计稿样式类以 `pc-` 前缀移植进 `src/index.css`，避免与 Tailwind 冲突。

## 五视图结构契约

| 视图 | 设计稿结构 | React 落地类 |
| --- | --- | --- |
| Dashboard | section-head + 4 格 stat-row + 3 格 focus-row + system-strip | `pc-section-head` / `pc-stat-row` / `pc-focus-row` / `pc-system-strip` |
| Projects | section-head + project-grid + bottom-grid | `pc-project-grid` / `pc-bottom-grid` |
| AI Studio | section-head + studio-grid（画布 + 抽屉） | `pc-studio-grid` / `pc-drawer` |
| Actions | section-head + actions-grid（DoD 队列 + 验证矩阵） | `pc-actions-grid` / `pc-quality-gate` |
| Knowledge | section-head + kb-toolbar + kb-grid / graph-view | `pc-kb-toolbar` / `pc-kb-grid` / `pc-graph-view` |

## Motion Token 与验收

- 主切换与导航过渡 <=150ms，只用 `transform` / `opacity` / `filter` 类属性。
- 遵守 `prefers-reduced-motion`：reduce 下动画时长 <=0.02s。
- 桌面与移动端横向溢出 <=1px。
- 自动化验收由 `scripts/ui-verify.mjs` 的 motion lane 覆盖，纳入 `verify:ui` 与 `verify:preview`。

## 评审结论

- Standards 轴：修复 pc-* 硬编码色值改为 Prism Token、Dock 折叠 200ms 收敛到 150ms、恢复 ui-verify 动效/溢出/reduced-motion 断言。
- Spec 轴：Dashboard 焦点卡改为 badge + title + desc + meta-line；Knowledge 工具栏收敛为内联搜索 + 田字格/图谱，图谱改为节点连线；Actions 移除第三块本地 CLI 面板；AI Studio 固化按钮常驻（无输出时禁用）。
- 质量门：`lint`、`build`、`verify:ui`（含 motion lane）、`verify:preview`、`audit-contract` 全绿。
