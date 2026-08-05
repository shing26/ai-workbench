# Sprint 22 计划：UI 动态效果深化

目标：参考 `octopus-kaogong-workbench` 模板，把 Sprint 2 已排入 Backlog 的主题/强调色、流体材质与 AI Studio 对话舞台动效落地，并将 UI 改造完整纳入 SDLC。不照搬 3D 环绕与自动轮播，不改动既有 5 大主视图。

## 设计契约

- 设计部评审：`docs/meetings/2026-08-05-ui-dynamics-design-review.md`
- Sprint 22 设计部契约：`docs/meetings/2026-08-05-sprint-22-ui-dynamics-contract.md`
- 约束：交互动效 <=150ms；只使用 `transform/opacity/filter`；尊重 `prefers-reduced-motion`；禁止持续装饰性动画。

## Sprint 22 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| U1 | 首帧主题/强调色脚本 + 主题 Store | 刷新后无闪烁，`data-theme` / `data-accent` 持久化，`system` 跟随系统主题 |
| U2 | Header ThemeSwitcher | 含 Dark/Light/System 分段与 5 个 accent swatch；`aria-expanded` / `data-accent-option` / `aria-pressed` 齐全；Esc 关闭并归还焦点 |
| U3 | 流体材质卡 | `BentoCard` 支持 `material`，卡片尺寸动画前后一致，hover 仅 lift/filter/flow，单次 140ms |
| U4 | AI Studio 对话舞台 | 空闲无 ambient；busy 时 glow 150ms 出现；composer focus glow 120ms；MOA provider stack 入场 stagger 一次 |
| U5 | 动效守卫 | 交互 transition <=150ms，reduced-motion 下动画/transition 归零，tilt 不写入 |
| U6 | 自动化验收 | `verify:ui` / `verify:preview` 新增主题、强调色、材质卡、动效时长与 reduced-motion 断言 |

## DoD 检查单

- [x] 5 大主视图可切换，动画结束无残影、无溢出。
- [x] 卡片与浮层尺寸在动画前后一致。
- [x] 主题/强调色切换持久化，浅色主题下文字可读。
- [x] 交互主切换 <=150ms，`prefers-reduced-motion` 下关闭连续动画。
- [x] Dock/Drawer/卡片键盘可访问，焦点可见。
- [x] `npm run build`、`cargo test --lib`、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.22.0-alpha`。

## 范围外（Backlog）

- 3D orbit / fan carousel / 自动轮播照搬。
- Material Settings 实时调参抽屉。
- 全仓库 Tailwind emerald/blue class 迁移为 accent token（后续单独 Sprint）。
