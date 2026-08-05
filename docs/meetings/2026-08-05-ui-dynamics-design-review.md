# 2026-08-05 UI 动态效果设计评审

## 会议目标

参考 UI 模板 `octopus-kaogong-workbench`，为 AI Workbench 的 5 大冻结主视图设计动态 UI 改造方案，并把 UI 改造纳入开发生命周期。

## 模板分析

模板地址：https://github.com/zhangyushaonao/octopus-kaogong-workbench.git

- 技术栈：零依赖静态 HTML/CSS/JS，`styles.css` + `app.js` 承载全部交互。
- 可借鉴机制：3D 环绕卡片、扇形堆叠、玻璃材质、主题与强调色切换、设置抽屉、自动轮播、拖拽吸附。
- 工程约束：动效只使用 `transform`、`opacity`、`filter`，遵守 `prefers-reduced-motion`，无布局抖动。
- 本项目落地方案：不照搬 3D 环绕与自动轮播，改为 150ms 内的轻量动态反馈；只保留对工作台有价值的玻璃材质、焦点光、卡片倾斜、Drawer 滑入与状态脉冲。

## 设计部决议

1. 范围冻结：只改造现有 5 视图与共享布局，不新增视图、不新增色彩体系。
2. Token 不变：`#101014` 画布、`#16161A` Dock/Header、`#18181C` 卡片、`border-white/10`、`rounded-2xl`、emerald + `#007AFF`。
3. 动效上限：所有交互主切换 <=150ms；只用 `transform`、`opacity`、`filter`。
4. Drawer 改造：`AppInspector` 改为固定宽度右侧浮层，用 `translateX` + `opacity` 滑入，不再动画 `width`。
5. Reduced Motion：CSS 兜底 + JS 检测，`prefers-reduced-motion: reduce` 时关闭连续动画、自动播放与卡片倾斜。
6. 自动化验收：扩展 `npm run verify:ui` / `verify:preview`，新增动效时长、固定尺寸、reduced-motion 与布局稳定断言。

## UI Designer 落地清单（12 项）

1. Immersive Canvas Glow：`main` 使用低透明线性环境光，底色仍为 `#101014`。
2. Glass Surface：Dock、Header、Inspector、BentoCard 使用半透明层叠与内高光。
3. 150ms Focus Glow：所有按钮、输入框、select、Badge 的 focus/active 反馈 <=150ms。
4. Motion Guardrail：全局 transition 上限 150ms，不新增循环装饰动画。
5. Fluid Material Card：BentoCard 加流体材质伪层与 hover lift，尺寸不变。
6. Drawer Material：Inspector 固定宽度浮层，150ms 滑入，焦点闭环。
7. Conversation Stage：AI Studio 消息入场、Composer focus glow、busy 指示。
8. MOA Provider Stack：MOA 开启时最多展示 3 个 active Provider 徽章，按序层叠。
9. Project Tilt Card：Projects 卡片 pointer tilt <=7deg，离开 150ms 复位。
10. Selection Rail：Knowledge 选中项 emerald 边框与 soft glow，详情 150ms 刷新。
11. Focus Progress Strip：Actions 今日 Focus 进度条由完成数推导，`scaleX` 动画。
12. Provider Health Grid：System Active/Idle 状态清晰，错误日志保留红色语义。

## UX Architect 动效规格要点

- Dock 切换：视图 140ms、激活指示 120ms、按压 60ms。
- Header 搜索：进入 120ms、退出 80ms。
- BentoCard：hover 120ms、按压 70ms、选中 140ms。
- Drawer：打开 150ms、关闭 130ms、section stagger 90ms。
- AI Studio：消息进入 130-140ms，busy 脉冲 900ms。
- Projects：聚焦 140ms、侧翼 220ms、新增 120ms。
- Actions：check 100ms、进度条 120ms、新增 100ms。
- System：状态 120ms、健康脉冲 1200ms、日志 90ms。

## Visual Storyteller 视觉叙事

- AI Studio：深色海面上唯一的光源，发送后水纹扩散、输入框聚焦亮起、模型切换流光。
- Projects：项目卡像缓慢漂移的浮岛，入场浮升、卡片粘滞、AI 操作轻压。
- Knowledge：知识流像水下沉淀层，输入涟漪、列表沉降、选中微亮。
- Actions：今日焦点是清晰航迹，勾选脉冲、节点微光，短促且行动导向。
- System：控制室暗色仪表盘，心跳脉冲、切换渐隐、错误微颤，只在异常时打破静默。

## UI Finish-Gate Reviewer DoD

- [ ] 5 视图可切换，动画结束无残影、无未渲染区域。
- [ ] 1440px 与 390px 下文字不溢出、卡片不漂移。
- [ ] Token 完全沿用冻结色板，无纯黑黑洞。
- [ ] 主切换 <=150ms，reduced-motion 下关闭连续动画。
- [ ] Dock/Drawer/卡片键盘可访问，焦点不逃逸。
- [ ] 只用 `transform`/`opacity`/`filter` 做动画。
- [ ] `npm run build`、`verify:ui`、`verify:preview` 全绿。

## 最高风险

- R1：Inspector 宽度动画造成布局回流，必须改为固定宽度浮层。
- R2：JS 动效不响应 reduced-motion。
- R3：浮层缺少焦点闭环。
- R4：验收脚本不检查动效与溢出。
- R5：直接照搬 3D 卡片造成遮挡与性能问题。

## Sprint 22 深化契约（设计部）

设计部 UI Designer 已基于模板与 Sprint 2 落地结果产出 Sprint 22 深化契约，完整内容见 `docs/meetings/2026-08-05-sprint-22-ui-dynamics-contract.md`。核心增量：

1. 主题/强调色系统：`data-theme` + `data-accent`，默认 `dark + emerald`，5 个 accent preset，localStorage 持久化。
2. 流体材质卡：hover/focus 触发的单次 140ms flow，只动 `transform/opacity/filter`，尺寸不变。
3. AI Studio 对话舞台：busy 时 stage glow 150ms，composer focus glow 120ms，MOA provider stack 入场 stagger。
4. 动效守卫：交互 transition <=150ms，JS + CSS 双通道响应 reduced-motion。
5. 自动化验收：`verify:ui` / `verify:preview` 新增主题持久化、accent 切换、材质卡尺寸与 reduced-motion 断言。
