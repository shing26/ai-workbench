# 2026-08-05 Git Rebase 与冲突处理评审

## 结论

- `rebase_branch(path, base_branch)` 执行 `git rebase`，成功返回 `{ rebased, conflict, files, base, branch, head }`；冲突时用 `git diff --name-only --diff-filter=U` 返回冲突文件列表。
- `abort_rebase(path)` 执行 `git rebase --abort`，清理冲突现场并返回当前分支。
- Projects Git 图谱新增 Rebase onto main 按钮；冲突时展示冲突文件与 Abort rebase 按钮，成功或清理后刷新图谱。
- Rust 单测覆盖干净 rebase 与冲突检测/abort 两条真实 git 仓库链路；两条 UI 验收 lane 全绿。

## 风险与后续

- 冲突只做“检测 + abort”，自动解决与三方合并策略留在 Backlog。
- rebase 会改写提交历史，按钮默认只允许非 base 分支触发，并有明确结果回显。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、冲突自动解决 / 三方合并策略。
