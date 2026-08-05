# Sprint 110 计划：跨流 Token 预算与成本控制

目标：为 AI 工作台增加月度 Token 预算：每次流式回复按文本估算 Token 并跨会话累计；超预算时自动降级到本地 Ollama Provider，或按配置直接拦截，让日常使用可感知成本上限。

## Sprint 110 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 预算模块 | 新增 `src/lib/tokenBudget.ts`：`estimateTokens`（len/4）、月度 key 自动翻转、localStorage key `ai-workbench:token-budget:v1` |
| R2 | System 配置 | System 新增 Token budget 卡片：月度上限输入、已用/进度、Auto degrade 开关、Reset month，提供 `data-token-budget-*` 锚点 |
| R3 | AI Studio 联动 | 头部 `data-token-budget-badge` 展示用量与 degrade/over 状态；流完成时记录估算 Token；超预算且开启降级时只路由本地 Ollama，关闭时拦截并回显错误 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `tokenBudget` lane：降级回复、徽标、拦截、重置与恢复 5 个子步骤 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 月度预算持久化、跨会话累计、月度翻转。
- [x] System 可配置上限与 Auto degrade，AI Studio 徽标与 Inspector 展示 Budget。
- [x] 超预算自动降级本地 Provider；关闭降级时明确拦截。
- [x] `tokenBudget` lane 双端覆盖降级、拦截、重置与恢复。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
