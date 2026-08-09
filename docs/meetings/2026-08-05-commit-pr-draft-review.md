# 2026-08-05 Commit/PR 草稿生成器评审

## 结论

- Projects 视图新增 Commit/PR draft 按钮，一键读取 Git 状态并生成 Conventional Commit 与 PR 描述草稿。
- Rust 与浏览器 fallback 共用同一套规则：根据变更文件与分支推断 `feat` / `fix` / `docs` / `test` / `chore`，从文件名生成摘要，PR body 包含 Summary、Changes 与 DoD。
- 卡片内提供 Copy commit / Copy PR 快捷复制。

## 风险与后续

- `git status --short` 优先、最近修改文件回退，避免非 git 目录失败。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、Team 结果汇总、自动文件监听同步。
