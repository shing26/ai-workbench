# Sprint 2 计划：UI 动态效果改造

目标：参考 `octopus-kaogong-workbench` 模板，为 5 大主视图与共享布局加入动态 UI 效果，并把 UI 改造纳入 SDLC。不新增视图、不新增色彩体系，全部动画遵守 150ms 与 reduced-motion。

## Sprint 2 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| U1 | 全局动效 Token 与环境光 | `main` 环境光低透明，底色 `#101014`，全局 transition <=150ms |
| U2 | AppDock / AppHeader 动态反馈 | 激活指示、hover lift、按压反馈、搜索浮层 120ms 进入 |
| U3 | BentoCard 流体材质与 hover | 卡片尺寸不变，hover <=150ms，内容可读，无纯黑背景 |
| U4 | AppInspector Drawer 改造 | 固定 240px 浮层，`translateX`/`opacity` 滑入，Esc 关闭，焦点闭环 |
| U5 | 五视图动态效果 | AI Studio 消息/MOA Stack、Projects Tilt、Knowledge Selection、Actions Progress、System Health |
| U6 | 自动化验收扩展 | `verify:ui` 增加动效时长、固定尺寸、reduced-motion 与布局稳定断言，`verify:preview` 通过 |

## 范围外（进入 Backlog）

- 自动轮播与 3D 环绕照搬。
- 主题/材质自定义设置面板。
- 真实 RAG、Webhook、剪贴板监听。

## DoD 检查单

- [x] 5 视图可切换，动画结束无残影。
- [x] 卡片与浮层尺寸在动画前后一致。
- [x] 主切换 <=150ms。
- [x] `prefers-reduced-motion` 下无连续动画。
- [x] Dock/Drawer/卡片键盘可访问。
- [x] `npm run build`、`verify:ui`、`verify:preview` 全绿。
- [x] PR 已合并到 develop，复盘已更新。
