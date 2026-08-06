# Sprint 113 计划：审计跨时间轴图

目标：把 System Sync audit 的 Activity 柱状图从“只看总数”升级为“跨时间轴分层图”：每个日 / 周桶按 merge / resolve / other 三色堆叠，图例显示分类合计，并在时间轴上方叠加累计趋势线；过滤条件、Day / Week 粒度与总数徽标语义全部保持不变。

## Sprint 113 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 堆叠分段 | Sync audit 图表每个 bucket 渲染 merge / resolve / other 三段，`data-sync-audit-segment` 带 `data-audit-kind` / `data-audit-count`；保留 `data-sync-audit-bar` 与桶总数锚点 |
| A2 | 图例与趋势线 | 图表下方新增 `data-sync-audit-legend` 显示三类合计；桶数 > 1 时新增 `data-sync-audit-trend-line` 累计折线 |
| A3 | 自动化验证 | `verify:ui` / `verify:preview` 的 `syncAuditChart` lane 断言分段合计 = 总数、图例合计 = 总数、趋势线存在，Day / Week 切换后仍一致 |
| A4 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 图表按 merge / resolve / other 分层展示，旧总数锚点不破坏既有 lane。
- [x] 图例与累计趋势线随 Day / Week 和过滤条件联动刷新。
- [x] `syncAuditChart` lane 双端覆盖分段合计、图例合计与趋势线。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
