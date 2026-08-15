# 2026-08-14 Provider Control UI 设计评审

## 会议目标

为 Provider Control modal 与 Provider Lab 建立可验收 UI 契约，使新增 / 删除 / 启停 / 编辑 / 测试 / 模型发现不破坏现有 5 视图布局、设计 Token 与验证锚点。

## 设计部决议

1. Provider Control 作为跨模块基础设施 modal，不新增主视图，从 Header / AI Studio / Actions 复用同一入口。
2. 沿用现有深色 Token：`#101014` 画布、`#18181C` 卡片、`border-white/10`、emerald 健康语义、cyan 选中语义；不引入新色彩体系。
3. Provider 卡片固定 8px 以下圆角与稳定高度，编辑输入、状态徽标与按钮不因动态文本改变卡片尺寸。
4. Provider Lab 使用独立区域展示连接测试、流式 smoke 与模型发现结果；disabled Provider 可留在 Lab 中编辑或测试，但不能进入 roundtable / L4 / CLI 交付上下文。
5. 交互反馈 <=150ms，只用 `transform` / `opacity` / `filter`，遵守 `prefers-reduced-motion`。
6. 保留既有 `data-*` / `aria-label` 契约，新增 `data-provider-open` / `data-provider-card` / `data-provider-lab-*` / `data-provider-selected-name` 供自动化验证。

## 可验收 UI 契约

- Header、AI Studio、Actions 均提供 `data-provider-open` 入口。
- Provider modal 提供 `data-provider-preset-add` 预设、`data-provider-save` 保存、`data-provider-delete` 删除、`data-provider-active` 启停、`data-provider-type` 类型选择与 `data-provider-label-input` / `data-provider-base-url-input` / `data-provider-api-key-input` 编辑。
- Provider Lab 提供 `data-provider-lab-health` / `data-provider-lab-smoke` / `data-provider-lab-models`，结果显示在 `data-provider-lab-health-result` / `data-provider-lab-smoke-result` 与模型列表锚点。
- `verify:ui` / `verify:preview` 覆盖 modal 打开、custom preset 保存、卡片数量、Lab 入口与关键锚点存在。

## UI Finish-Gate Reviewer DoD

- [ ] 390px / 1440px 下 Provider modal 无文字溢出、无重叠、卡片不漂移。
- [ ] 主切换与按钮反馈 <=150ms，reduced-motion 下无循环动画。
- [ ] 只使用冻结 Token，无新增纯色渐变、装饰 orb 或大面积单一色域。
- [ ] disabled Provider 不会出现在 AI Studio roundtable 或 Actions L4 的 live 上下文。
- [ ] 所有新增交互有可见 label / aria-label，验证锚点与 `verify:ui` 一致。
- [ ] `npm run lint` / `build` / `test:unit` / `verify:matrix` 全绿。

## 最高风险

- R1：Provider Lab 与 live 路由共用同一 selected 状态，可能把 disabled Provider 误传给业务链路；用 `activeProviderFromSnapshot` 分离 Lab 选中与 live provider。
- R2：显式 `providerType` 被名称 / 端口启发式覆盖；以显式类型为唯一路由依据，legacy 推断只在首次迁移发生。
- R3：浏览器 fallback 与 Rust 健康 / smoke 语义漂移；统一 6 秒健康超时、默认 model 与单次 smoke 请求。
