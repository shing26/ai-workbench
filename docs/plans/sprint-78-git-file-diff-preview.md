# Sprint 78 计划：Git dirty 逐文件 diff 预览

目标：把 Sprint 73 的 dirty 文件预览从“路径清单”升级为“可读改动”。每个 dirty 文件可点击加载 unified diff：已跟踪文件用 `git diff`，暂存内容用 `git diff --cached`，未跟踪文件直接读磁盘并转成新增行。

## Sprint 78 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust diff 命令 | 新增 `GitFileDiff { path, status, diff }` 与 `get_git_file_diff(path, file)`，注册 Tauri 命令 |
| A2 | 状态判定 | `git status --porcelain` 判定跟踪 / 未跟踪；未跟踪文件读盘生成 `+` 行，已跟踪文件返回 unified diff |
| A3 | TS fallback | `db.ts` 新增 `GitFileDiff` 与 `getGitFileDiff`，浏览器 fallback 返回可读 mock diff |
| A4 | Projects UI | dirty 预览中每个文件新增 Diff 开关，点击后显示 `<pre>` diff，可再次点击收起 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitDirtyDiff` lane：展开 dirty 预览后点击文件 Diff，断言 `diff --git`、`+`、`-` 可见 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Rust 命令覆盖已跟踪 / 暂存 / 未跟踪三类 diff。
- [x] `verify:ui` / `verify:preview` 的 `gitDirtyDiff` 为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.78.0-alpha`。

## 范围外（Backlog）

- 不做行内着色与 diff 编辑器；仅展示纯文本 unified diff。
- 不新增整文件对比视图；单文件 diff 进入候选池。
