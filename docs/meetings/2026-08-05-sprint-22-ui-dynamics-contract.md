# Sprint 22 UI Dynamics 设计部契约

状态：设计契约（设计部 UI Designer，未修改仓库文件）。范围固定为工具优先的轻量动态 UI，不复制 3D orbit/fan carousel、自动轮播或模板 Material Settings drawer。

## 设计决策

1. 主题/强调色采用模板 `data-theme` + `data-accent` 思路，迁入现有 `#101014 / #16161A / #18181C` token 体系；默认 `dark + emerald`。
2. 强调色只控制激活态、选中态、焦点、主按钮与 glow；warning/error/success 语义色保持不变。
3. 流体卡片只借用模板的伪元素分层思路，实现为 hover/focus 触发的单次 140ms flow，不做持续自动运动。
4. 所有新动画只使用 `transform / opacity / filter`；颜色、border、background 只做静态变化。
5. `prefers-reduced-motion` 由 CSS 与 JS 同时处理；AI Studio busy 状态动画属于状态反馈，空闲时无 ambient。

## Motion Token

| 组件 | 时长 | 缓动 | 属性 |
|---|---|---|---|
| Dock hover / active | 120ms | `var(--ease-out)` | transform, filter |
| Dock press | 70ms | ease-out | transform |
| Popover 进入 | 120ms | `var(--ease-out)` | transform, opacity, filter |
| Popover 退出 | 80ms | ease-out | transform, opacity |
| 流体卡 hover lift | 120ms | `var(--ease-out)` | transform, filter |
| 流体材质 flow | 140ms 单次 | `var(--ease-out)` | transform, opacity, filter |
| Pointer tilt 复位 | 120ms | `var(--ease-out)` | transform |
| Composer focus glow | 120ms | `var(--ease-out)` | transform, opacity, filter |
| Conversation stage glow | 150ms | `var(--ease-out)` | transform, opacity, filter |
| Message enter | 140ms | `var(--ease-out)` | transform, opacity |
| Provider stack 入场 | 140ms stagger | `var(--ease-out)` | transform, opacity, filter |
| Busy dot / caret | 900ms 状态驱动 | ease-in-out | transform, opacity |
| Health pulse | 1200ms 状态驱动 | ease-in-out | transform, opacity |

规则：交互式 transition 与入场动画全部 <=150ms；busy/health 状态指示可大于 150ms，但 reduced-motion 下必须停。

## 新增 CSS 变量与类名

- 变量：`--color-accent` / `--color-accent-soft` / `--color-accent-strong` / `--color-accent-rgb` / `--color-accent-ink` / `--material-a` / `--material-b` / `--material-c`
- 类名：`.theme-switcher` / `.theme-segment` / `.accent-swatch` / `.material-card` / `.material-cyan` / `.material-original` / `.material-rain` / `.material-chrome` / `.conversation-stage` / `.composer` / `.provider-stack`
- 属性：`data-theme` / `data-theme-resolved` / `data-accent` / `data-material`
- Keyframes：`material-drift` / `composer-glow` / `stage-glow` / `provider-in`

## Accent Preset

| Preset | Accent | Soft | Strong | RGB | Ink |
|---|---|---|---|---|---|
| emerald | #10B981 | rgba(16,185,129,.14) | #34D399 | 16 185 129 | #ECFDF5 |
| ocean | #007AFF | rgba(0,122,255,.16) | #4DA3FF | 0 122 255 | #EAF4FF |
| iris | #8B5CF6 | rgba(139,92,246,.16) | #A78BFA | 139 92 246 | #F5F3FF |
| amber | #F59E0B | rgba(245,158,11,.16) | #FBBF24 | 245 158 11 | #FFFBEB |
| sakura | #F472B6 | rgba(244,114,182,.16) | #F9A8D4 | 244 114 182 | #FDF2F8 |

## 验收清单

- 主题切换持久化，刷新后 `data-theme` 一致；`system` 模式跟随 `prefers-color-scheme`。
- accent swatch `aria-pressed` 与 `documentElement.dataset.accent` 一致。
- 材质卡 `.material-card[data-material]` 存在，hover 前后 `offsetWidth/offsetHeight` 一致。
- 交互动画时长 <=150ms，reduced-motion 下 <=0.02ms 且 tilt 为 `none`。
- `verify:ui` 与 `verify:preview` 全绿。

## 风险与约束

- 现有视图仍写死 emerald / #007AFF / amber class；本 Sprint 只迁移 shell、共享控件、AI Studio 与显式材料卡。
- 浅色主题需保证 accent 文字对比度；amber-300 这类低对比浅色不做主文字。
- blur 有性能成本，材质卡每视图不超过约 4 张，伪元素非交互态保持低 opacity。
- tilt 需 JS `matchMedia` guard，CSS reduced-motion 无法覆盖 inline style。
- 3D orbit、fan stack、autoplay、material drawer 实时调参继续留在 Backlog。
