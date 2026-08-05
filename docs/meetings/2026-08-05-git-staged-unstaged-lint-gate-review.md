# 2026-08-05 Git 暂存 / 未暂存分组与提交前 lint 门禁评审

## 结论

- Rust 新增 `git_change_groups`：按 `git status --short` 的 XY 前缀把每个 dirty 文件归类为 `staged` / `unstaged` / `untracked` / `both`，保留原始 status 并处理 rename 箭头；`GitActivityItem` 新增 `change_groups`，`get_git_activity` 同步输出。
- Rust 新增 `run_commit_lint_gate` Tauri 命令：逐文件扫描 `<<<<<<<` / `>>>>>>>` 冲突标记，`.json` 文件再做 `serde_json` 解析；`commit_git_files` 提交前先执行门禁，发现问题返回 `Lint gate failed: file:line message` 并阻止提交。
- Projects dirty 预览按四个分组渲染，文件行带 `data-git-change-group`、分组头带 `data-git-change-group-header`；Commit selected 前先调 `db.runCommitLintGate`，失败时展示 `data-git-lint-gate` / `data-git-lint-gate-issues` 并保持勾选、不发起提交。
- `db.ts` 新增 `GitChangeGroup` / `GitLintIssue` / `changeGroups` / `runCommitLintGate`；浏览器 fallback 对 broken / conflict 文件返回确定性 lint 问题，其余文件放行。
- `cargo test --lib` 92/92，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitStagedUnstaged` / `gitCommitLintGate` 均为 true。

## 风险与后续

- 浏览器 fallback 只模拟 lint 结果，不读取真实文件；真实仓库语义由 Rust 单测覆盖。
- lint 门禁当前只检查冲突标记与 JSON 合法性，ESLint / Prettier 前端门禁继续留在 Backlog。
