# Sprint 73 计划：Git 活动看板 dirty 文件预览与提交趋势

目标：让 Projects Git activity 从“只看统计数字”升级为“能看清改动、能感知节奏”。dirty 项目行可展开预览实际变更文件；看板顶部新增最近 7 天 UTC 日粒度提交趋势条，与时间范围 / 提交人过滤共用同一数据源。

## Sprint 73 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | dirty 路径解析 | `git_change_paths` 剥离 `git status --short` 的 XY 前缀并处理 rename 箭头，`GitActivityItem` 新增 `changed_paths` |
| A2 | 提交趋势模型 | 解析 reflog 全部时间戳，按 UTC 日聚合为 `commit_trend`，最多保留最近 7 个有提交的日桶 |
| A3 | TS fallback | `GitCommitTrend` / `changedPaths` 类型与浏览器 fallback 镜像同一趋势与预览语义 |
| A4 | Projects UI | dirty 行新增 Preview 展开 / 收起与文件列表；Git activity 卡片新增 7 日趋势条 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitDirtyPreview` / `gitCommitTrend` lane |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] TS fallback 与 Projects UI 覆盖 dirty 预览与提交趋势。
- [x] `verify:ui` / `verify:preview` 的 `gitDirtyPreview` / `gitCommitTrend` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.73.0-alpha`。

## 范围外（Backlog）

- 提交趋势暂为 UTC 日粒度，不做周粒度切换与按提交人拆分。
- dirty 预览只展示路径，不提供逐文件 diff；diff 预览进入下一阶段候选池。
