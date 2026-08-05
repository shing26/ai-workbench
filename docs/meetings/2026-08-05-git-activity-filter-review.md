# 2026-08-05 Git 看板过滤评审

## 结论

- `GitContext` / `GitActivityItem` 新增 `committer`，从 `logs/HEAD` 末行解析提交人姓名；解析按时间戳 / 时区倒推 email 列，`John Doe <...>` 这类含空格姓名也能正确提取。
- 新增 `get_git_activity(sinceMs?, untilMs?, committer?)`：先按 `lastCommitAt` 与 committer（大小写不敏感）过滤，再聚合 `totalProjects / totalCommits / dirtyProjects` 并按时间排序；`GitActivityBoard` 返回全量去重 `committers` 供下拉使用。
- Projects Git activity 卡片新增 All / 24h / 7d / 30d 时间范围与提交人下拉，统计徽标、行列表与 committer 徽标共用同一过滤条件；TS fallback 镜像同一语义。
- 验证覆盖：`cargo test --lib` 77/77，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitActivity` 与 `gitActivityFilters` 均为 true（24h 后 1 项、committers 含 Alice / Bob、Alice 过滤后 1 项）。

## 风险与后续

- reflog 解析依赖标准行格式；非标准行只影响单个项目的时间与提交人，不影响整张看板。
- 索引队列优先级与失败重试策略、自动巡检运行历史与通知提醒继续保留在 Backlog。
