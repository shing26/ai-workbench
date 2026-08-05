# Sprint 85 计划：Git 暂存 / 未暂存分组与提交前 lint 门禁

目标：把 Sprint 82 评审留下的“暂存 / 未暂存分组与提交前 lint 门禁”Backlog 项落地。Projects dirty 文件按 staged / unstaged / untracked / both 分组展示；Commit selected 提交前先跑 lint 门禁，检测未解决的冲突标记与非法 JSON，失败时阻止提交并回显问题。

## Sprint 85 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 分组 | `git_change_groups` 解析 `git status --short` 的 XY 前缀并保留 `staged` / `unstaged` / `untracked` / `both` 语义，输出 `GitChangeGroup { path, status, group }`；`GitActivityItem` 新增 `change_groups` |
| A2 | Rust lint 门禁 | `run_commit_lint_gate` 检测 `<<<<<<<` / `>>>>>>>` 冲突标记与 `.json` 解析错误，返回 `GitLintIssue[]`；`commit_git_files` 先跑门禁，发现问题返回 `Lint gate failed` 并阻止提交 |
| A3 | TS fallback | `db.ts` 新增 `GitChangeGroup` / `GitLintIssue` / `changeGroups` 与 `runCommitLintGate`；浏览器 fallback 对 broken / conflict 文件返回确定性问题，其余文件放行 |
| A4 | Projects UI | dirty 预览按 staged / unstaged / untracked / both 分组渲染（`data-git-change-group` / `data-git-change-group-header`）；Commit selected 前调用 `runCommitLintGate`，失败展示 `data-git-lint-gate` 并阻止提交 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitStagedUnstaged` / `gitCommitLintGate` lane；Rust 单测覆盖 XY 分组与冲突标记 / 非法 JSON 拦截 |

## DoD 检查单

- [x] `cargo test --lib` 全绿（92/92），fmt、clippy、build 全绿。
- [x] `verify:ui` / `verify:preview` 的 `gitStagedUnstaged` / `gitCommitLintGate` 均为 true。
- [x] Rust 单测覆盖 staged / unstaged / untracked 分组与 lint gate 拦截。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.85.0-alpha`。

## 范围外（Backlog）

- 不做行内着色与 diff 编辑器、整文件对比视图；继续留在 Backlog。
- 不做多端同步自定义 prompt 与使用次数；继续留在 Backlog。
- 不做 AI 复盘结果一键保存为知识笔记；继续留在候选池。
