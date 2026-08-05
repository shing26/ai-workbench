# 2026-08-05 Git 活动看板评审

## 结论

- `GitContext` 新增 `lastCommitAt`，从 `logs/HEAD` 末行解析 epoch 秒并转换为毫秒；latest commit 消息去掉 `commit:` 前缀，与 UI 展示语义一致。
- 新增 `get_git_activity` 命令：遍历 `projects` 聚合每个项目的 branch / commitCount / latestCommit / changedFiles / dirty，按 `lastCommitAt DESC` 排序，并汇总 totalProjects / totalCommits / dirtyProjects；无 Git 元数据的项目跳过。
- Projects 顶部新增 Git activity 卡片，展示总数徽标与每项目分支、提交数、dirty / clean 状态、最新提交；TS fallback 基于 localStorage projects 镜像同一聚合语义。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitActivity` 均为 true（>=2 个项目、totalCommits 与行汇总一致、dirty 可见）。

## 风险与后续

- reflog 解析依赖标准行格式；非标准行只影响单个项目的时间与消息，不会拖垮整个看板。
- git 看板按时间范围过滤与提交人维度已排入 Backlog；后续可扩展 dirty 文件预览与提交趋势。
