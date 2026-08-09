# 2026-08-05 文档健康自动定时巡检评审

## 结论

- Knowledge Document status 新增 Auto toggle 与 5m / 15m / 30m / 1h / 6h 间隔；启用后立即执行一次 `cleanup_knowledge_files`，之后按配置间隔自动巡检，关闭时清理定时器。
- `DocHealthAutoConfig`（开关、间隔、上次运行时间与结果）持久化到 `ai-workbench:doc-health-auto:v1`，刷新后恢复；每次巡检后刷新文档列表、vault 统计与 RAG 状态，并展示 `lastRunAt` 与 `removed / reindexed` 结果。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `docHealthAuto` 均 seed 1 missing + 1 stale 后启用自动巡检，断言 removed=1 / reindexed=1 / 状态 on / 配置持久化，`docHealthAutoPersist` 断言刷新后仍为 on 且结果保留。

## 风险与后续

- 自动巡检使用前端定时器，应用窗口关闭后不会继续运行；后续如需后台常驻，可迁移到 Rust 后台任务。
- 自动巡检运行历史与通知提醒已排入 Backlog。
