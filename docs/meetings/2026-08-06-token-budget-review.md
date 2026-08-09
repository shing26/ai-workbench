# 2026-08-06 跨流 Token 预算 Review

## 结论

Sprint 110 完成：AI Studio 现在会按文本估算 Token 并跨流累计月度用量，System 可配置上限与自动降级策略。

## 验收证据

- `src/lib/tokenBudget.ts` 提供 `estimateTokens` / `loadTokenBudget` / `recordTokenUsage` / `resetTokenBudget` / `getBudgetStatus`，localStorage key 为 `ai-workbench:token-budget:v1`，月度 key 变化时自动清零。
- System Token budget 卡片支持月度上限、Auto degrade、Reset month，`data-token-budget-card` / `-limit` / `-used` / `-bar` / `-auto-degrade` / `-reset` 锚点齐全。
- AI Studio 头部 `data-token-budget-badge` 展示 `tokens x/y` 与 degrade / over 状态；流完成时按回复文本记录估算 Token；超预算且 Auto degrade 开启时仅路由本地 Ollama，关闭时拦截并回显 `token budget exceeded`；Inspector 新增 `Budget` 区块。
- `verify:ui` / `verify:preview` 的 `tokenBudget` lane 覆盖本地降级回复、徽标、配置切换、超限拦截、重置与恢复云 Provider 五步；build / lint / prettier 全绿。

## 遗留

- 当前为字符长度估算（len/4），未使用 Provider 返回的 usage 字段；后续可接入真实 token 计数与按 Provider 单价换算金额。
- 预算拦截文案仍为英文错误；后续可统一中文本地化。
- Connection Layer 与 Monetization Workbench 继续搁置。
