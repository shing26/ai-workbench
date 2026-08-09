# 2026-08-05 一键提交选中文件评审

## 结论

- Rust 新增 `commit_git_files(path, files, message)`：空 message / 空 files 报错，`git add -- <files>` 只暂存选中文件后 `git commit -m`，与 `apply_commit` 共用 `finalize_commit`，并已注册 Tauri 命令。
- ProjectsView 新增 `selectedFiles` 状态与 `toggleSelectFile`，dirty 文件前有 checkbox（`data-git-select-file`）；Commit selected 按钮（`data-git-commit-selected`）自动生成或复用 draft message，提交后清空勾选并刷新 Git activity。
- `cargo test --lib` 86/86，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitCommitSelected` 均为 true。

## 风险与后续

- 未做暂存 / 未暂存分组与提交前 lint 门禁，进入 Backlog。
- 浏览器 fallback 只模拟提交，不改变真实 dirty 状态；真实仓库语义由 Rust 单测覆盖。
