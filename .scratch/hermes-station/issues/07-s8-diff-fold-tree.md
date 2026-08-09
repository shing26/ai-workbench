# 07 — S8-3: Inline Git Diff fold tree on project cards

**What to build:** 项目卡片内 `x files changed ▾` 折叠树，展开 Inline 变动树 + 侧滑 Diff 对比。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 项目卡片变更文件数变为可点击（`data-diff-fold-toggle`），点击展开文件树
- [ ] 每文件显示 `+N, -M` 行数（从 `getProjectGitContext` changes / `getGitFileDiff` 派生）
- [ ] 点击文件 → 侧滑抽屉对比 Diff（复用现有 git diff 面板逻辑）
- [ ] reduced-motion 下树展开即时
- [ ] verify lane：展开树 → 文件行数正确 → 打开 Diff 抽屉

**Definition of Done:** Diff 折叠树无卡顿展开，行数准确。AC-1.2。
