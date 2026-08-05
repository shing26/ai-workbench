# Sprint 82 计划：一键提交选中文件

目标：把 Git 批量预览升级为“可勾选、可提交”。dirty 预览中的每个文件支持勾选，Commit selected 只暂存并提交选中文件，未选文件保持 dirty。

## Sprint 82 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 命令 | 新增 `commit_git_files(path, files, message)`：空 message / 空 files 报错，`git add -- <files>` 后 `git commit -m`，返回 `GitCommitResult`；注册 Tauri 命令 |
| A2 | 前端勾选 | ProjectsView 新增 `selectedFiles` 状态与 `toggleSelectFile`，每个 dirty 文件前加 checkbox（`data-git-select-file`） |
| A3 | 提交入口 | dirty 面板新增 Commit selected 按钮（`data-git-commit-selected`），自动生成或复用 draft message，调用 `commitGitFiles`，成功后清空勾选并刷新 Git activity |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitCommitSelected` lane：勾选 ProjectsView.tsx 后提交，断言结果可见且勾选清空；Rust 单测覆盖只提交选中文件与空选择报错 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、`npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `gitCommitSelected` 为 true。
- [x] Rust 命令只提交选中文件，未选文件保持 dirty。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.82.0-alpha`。

## 范围外（Backlog）

- 不做暂存 / 未暂存分组与提交前 lint 门禁。
- 不做批量选择“全选”；可勾选全部文件后一次提交。
