# Sprint 70 计划：Git 看板时间范围与提交人过滤

目标：把 Git activity 看板从“全量展示”升级为“可按时间范围与提交人下钻”。Projects 卡片新增时间范围（All / 24h / 7d / 30d）与提交人下拉，`get_git_activity` 支持 `sinceMs / untilMs / committer` 过滤；`GitContext` 与 `GitActivityItem` 增加 committer 维度，看板返回全量提交人去重列表供筛选。

## Sprint 70 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | GitContext 提交人解析 | `get_project_git_context` 新增 `committer`，从 reflog 末行解析提交人姓名（兼容姓名含空格），同时保留时间戳解析 |
| A2 | 过滤参数 | `get_git_activity` 新增 `sinceMs? / untilMs? / committer?`，按 `lastCommitAt` 与 committer 过滤后再聚合与排序 |
| A3 | 提交人维度 | `GitActivityBoard` 新增 `committers` 全量去重列表；`GitActivityItem` 新增 `committer` |
| A4 | TS fallback | `getGitActivity(options)` 镜像 Rust 过滤语义，基于 localStorage projects 返回过滤后的看板与全量 committers |
| A5 | Projects UI | Git activity 卡片新增时间范围与提交人下拉，切换后刷新统计与行列表，每行展示 committer |
| A6 | 单测 | Rust 覆盖 reflog 提交人解析（含空格姓名）、时间范围过滤、提交人过滤与 committers 去重 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitActivityFilters` lane：24h 过滤后 1 项、按 Alice 过滤后 1 项、committers 下拉包含 Alice / Bob |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 单测覆盖提交人解析、时间范围与提交人过滤。
- [x] `verify:ui` / `verify:preview` 的 `gitActivity` 与 `gitActivityFilters` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.70.0-alpha`。

## 范围外（Backlog）

- 索引队列优先级与失败重试策略。
- 自动巡检运行历史与通知提醒。
