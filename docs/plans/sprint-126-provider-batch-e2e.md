# Sprint 126 计划：System Provider 批量 E2E 测试

目标：为 System Providers 卡片新增一键批量 E2E 流式测试，覆盖全部 active Provider，并展示汇总结果。

## Sprint 126 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 批量测试入口 | Providers 操作区新增 `data-provider-batch-test` 按钮，点击后对全部 active Provider 并行执行 `runProviderE2EStream` |
| R2 | 汇总结果 | 批量完成后显示 `data-provider-batch-result`，格式为 `N/M ok`，失败时追加失败数；运行中显示 busy 状态 |
| R3 | 卡片联动 | 批量结果同步写入每个 Provider 卡片的 `data-provider-e2e-result`，与单卡 E2E 行为一致 |
| R4 | 异常兜底 | 单个 Provider 异常不中断整批，失败项以 `ok=false` 汇总 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `providerBatchE2E`：点击批量按钮后断言 `2/2 ok` 与卡片结果数 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Providers 提供一键批量 E2E 测试入口与汇总结果。
- [x] 批量测试并行覆盖全部 active Provider，单卡失败不中断整批。
- [x] 批量结果 reload 后卡片与汇总保持一致（fallback 行为）。
- [x] `providerBatchE2E` 双端覆盖批量执行与汇总。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
