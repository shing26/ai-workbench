# Sprint 13 计划：Provider 自动路由与健康兜底

目标：AI Studio 增加 Auto 路由模式。开启后发送前按健康度挑选最优可用 Provider；健康检查失败或不可达时自动跳过，回退到下一个可用节点，并把实际路由结果展示给用户。

## Sprint 13 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | 路由函数 | 新增 `routeProvider(providerIds)`：并行健康检查，过滤失败节点，返回 `{ provider, health, fallbackFrom }` |
| D2 | Auto 模式 | AI Studio 模式切换条新增 Auto，开启后不再直接取 active 首个节点，而是走路由；无健康节点时返回明确错误 |
| D3 | 路由可视化 | 顶部显示实际路由 Provider 徽标（`auto → name`）；Inspector 展示路由轨迹（候选、健康度、回退来源） |
| D4 | 浏览器 fallback | localStorage 模拟健康检查与路由结果，UI 验证可运行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- Provider 周期心跳与状态告警
- 按延迟权重/会话级路由策略
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] Auto 模式能跳过不可用 Provider 并展示实际路由
- [x] 无可用 Provider 时给出清晰错误而不是静默失败
- [x] `verify:ui` 能稳定断言 Auto 路由结果
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
