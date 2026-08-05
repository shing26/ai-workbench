# 2026-08-05 Commit / 远端 PR 执行评审

## 结论

- `apply_commit(path, message)` 在真实仓库执行 `git add -A` + `git commit -m`，返回 `committed`、8 位 hash、branch 与 message；无变更时返回 `committed: false` 而非报错。
- `create_remote_pr(path, title, body)` 校验 git remote 与 `gh` CLI，执行 `gh pr create --title --body --head` 并解析 PR URL；无 remote / 无 gh 时返回可读错误。
- Projects 草稿面板新增 Commit changes 与 Create PR 按钮，执行结果、错误与刷新后的 Git 图谱实时可见。
- Rust 单测覆盖真实 git 仓库 commit、nothing-to-commit、无 remote 错误与 PR 参数构造；两条 UI 验收 lane 全绿。

## 风险与后续

- `git add -A` 会暂存项目内全部改动，适合个人项目工作流；多人协作建议先审查 `git status`。
- 真实 PR 创建依赖 `gh` 登录态，命令错误会原样回显，前端已提供错误区块。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、PR 冲突解决与自动 rebase。
