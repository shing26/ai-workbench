# Sprint 67 计划：Git 活动看板

目标：把 Projects 里分散的 per-project Git 状态收拢为一张活动看板：聚合各项目的分支、提交数、最近提交、变更文件数与 dirty 状态，按最近提交时间排序，一眼看出哪些项目正在推进。

## Sprint 67 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | GitContext 扩展 | `get_project_git_context` 新增 `lastCommitAt`，从 reflog 末行解析 commit 时间戳（秒转毫秒） |
| A2 | 聚合命令 | 新增 `get_git_activity`：遍历 projects 表调用 GitContext，返回 `GitActivityBoard { totalProjects, totalCommits, dirtyProjects, items }` |
| A3 | 排序与统计 | items 按 `lastCommitAt DESC` 排序；`dirty` 由 changes 非空判定，`changedFiles` 为 changes 数量 |
| A4 | TS fallback | `getGitActivity` 镜像 Rust 语义，基于 localStorage projects 返回聚合看板 |
| A5 | Projects 看板 UI | Projects 顶部新增 Git activity 卡片：总数 / dirty 计数 + 每项目 branch / commits / latest / changed / dirty 徽标 |
| A6 | 单测 | Rust 覆盖 reflog 时间解析与多项目聚合排序 / 统计 |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitActivity` lane：>=2 个项目、totalCommits > 0、dirty 标记可见 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 单测覆盖时间解析与聚合排序。
- [x] `verify:ui` / `verify:preview` 的 `gitActivity` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.67.0-alpha`。

## 范围外（Backlog）

- 错误日志来源 / 设备组合筛选。
- 文档健康修复的自动定时巡检。
- git 看板按时间范围过滤与提交人维度。
