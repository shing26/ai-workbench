# 2026-08-05 自动巡检历史与提醒评审

## 结论

- `db.ts` 新增 `DocHealthRunRecord` 与 `getDocHealthRunHistory` / `appendDocHealthRun`，运行历史持久化到 `ai-workbench:doc-health-history:v1`，最多保留 50 条；Dismiss 时间持久化到 `ai-workbench:doc-health-alert-dismissed:v1`。
- 自动巡检与手动 Clean 均追加 `{ ranAt, removed, reindexed, failed, triggeredBy }` 记录；最近一次自动巡检发现问题时，Knowledge Document status 显示提醒横幅，Dismiss 后刷新不重现。
- Document status 展示最近 5 次运行历史；`verify:ui` / `verify:preview` 的 `docHealthHistory` / `docHealthDismissPersist` 均为 true。

## 风险与后续

- 历史只保留最近 50 条，无导出与归档；若需要长期审计，后续可增加导出或落库。
- 当前 Backlog 已清空；下一阶段候选池包括 Git 活动看板 dirty 文件预览与提交趋势、索引队列指数退避、真实 Provider 端到端流式联调。
