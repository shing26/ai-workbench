# Sprint 69 计划：文档健康自动定时巡检

目标：把文档健康从“手动点 Clean”升级为“自动定时巡检”。Knowledge Document status 卡片新增自动巡检开关与间隔选择，启用后立即执行一次，并按配置间隔调用 `cleanup_knowledge_files`；配置、上次运行时间与结果持久化到 localStorage，刷新后恢复。

## Sprint 69 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 配置模型 | `db.ts` 新增 `DocHealthAutoConfig { enabled, intervalMs, lastRunAt, lastResult }` 与 `getDocHealthAutoConfig` / `setDocHealthAutoConfig`，默认关闭、间隔 60 分钟 |
| A2 | 自动巡检 UI | Knowledge Document status 新增 Auto toggle 与间隔选择；启用后立即执行一次并按间隔自动清理 missing / stale |
| A3 | 结果反馈 | 每次巡检后刷新文档列表、vault 统计、RAG 状态，并展示 `lastRunAt` 与 `removed / reindexed / failed` 结果 |
| A4 | 持久化 | 开关、间隔、上次运行时间与结果写入 `ai-workbench:doc-health-auto:v1`，刷新后恢复 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `docHealthAuto` lane：seed 1 missing + 1 stale，启用自动巡检后断言 removed=1 / reindexed=1 / 状态 on / 配置持久化 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] TS fallback 与 UI 覆盖自动巡检配置、立即执行与结果展示。
- [x] `verify:ui` / `verify:preview` 的 `docHealthAuto` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.69.0-alpha`。

## 范围外（Backlog）

- git 看板按时间范围过滤与提交人维度。
- 索引队列优先级与失败重试策略。
- 自动巡检的运行历史与通知提醒。
