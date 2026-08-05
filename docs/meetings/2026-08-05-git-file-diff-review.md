# 2026-08-05 Git 逐文件 diff 预览评审

## 结论

- Rust 新增 `GitFileDiff { path, status, diff }` 与 `get_git_file_diff(path, file)`：未跟踪文件用 `git status --porcelain` 判定后读磁盘转 `+` 新增行；已跟踪文件优先 `git diff --unified=3`，为空再走 `git diff --cached` 覆盖暂存内容。
- Projects 的 dirty 预览中每个文件新增 Diff 开关，点击后渲染 `<pre>` unified diff，可再次点击收起；`db.ts` 新增 `GitFileDiff` / `getGitFileDiff`，浏览器 fallback 返回可读 mock diff。
- `verify:ui` / `verify:preview` 的 `gitDirtyDiff` 均为 true，`cargo test --lib` 84/84，fmt、clippy、build 全绿。

## 风险与后续

- diff 目前是纯文本预览，无行内着色、编辑或分块加载；行内着色与 diff 编辑器、整文件对比视图进入 Backlog。
- 未跟踪文件整读磁盘转 `+` 行，超大文件会产生较长 diff；后续如需优化可加分块或行数上限。
