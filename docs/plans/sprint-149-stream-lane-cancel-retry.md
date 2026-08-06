# Sprint 149 计划：AI Studio 每条流独立取消与单路重试

目标：MOA Parallel / Chain 不再共用单个 run ID，而是每个 Provider 一条独立子流；每条流可单独停止，单条失败后可只重试该路并重算 MOA Consensus。

## Sprint 149 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | 子流协议 | Rust `stream_ai_message` 对 Parallel 使用 `{run_id}-p{index}`、Chain 使用 `{run_id}-s{index}`、Consensus 使用 `{run_id}-c`；每条子流各自发出 done/error/cancelled chunk；浏览器 fallback 完全同构。 |
| L2 | 单路取消 | AI Studio 中每张 MOA 流卡片在 streaming 时提供独立停止按钮，只取消该子流，其它流与 Consensus 继续完成。 |
| L3 | 单路重试 | 失败流卡片提供重试按钮，只重跑该 Provider；成功后基于全部流输出重算 `## MOA Consensus`，其它流内容保持不变。 |
| L4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `streamLaneCancelRetry` lane：一路失败、一路慢流被单独取消、一路正常完成，然后重试失败路并断言共识更新；新增 `streamLaneChainCancel` lane 断言 Chain 首步取消后剩余步骤均收尾、busy 退出；`moaChain` lane 适配多卡片断言。 |
| L5 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE 同步；八道质量门全绿后合入 develop。 |

## DoD 检查单

- [x] MOA Parallel 每路独立停止后其它路与共识继续完成。
- [x] MOA Chain 每步独立停止后链路终止，不伪造后续步骤。
- [x] Chain 中途取消时未开始的后续步骤同步 emit done(cancelled)，busy 不会悬挂。
- [x] 失败单路重试只重跑该 Provider，共识基于全部输出重算。
- [x] Chain 单路重试会截断该步骤之后的旧步骤，不保留伪造的后续结果。
- [x] `verify:ui` / `verify:preview` 的 `streamLaneCancelRetry` lane 双端通过。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；其余候选留在候选池。
