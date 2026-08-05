# 2026-08-05 Git 批量提交内容预览评审

## 结论

- ProjectsView 新增 `batchDiff` / `batchLoading` 状态与 `loadBatchPreview`，逐个复用 `db.getGitFileDiff` 拉取全部 dirty 文件，合并为带文件名标题的批量内容。
- dirty 预览顶部新增 Preview all 按钮（`data-git-batch-preview`），展开后以 `<pre>` 展示 `data-git-batch-preview-content`，再次点击收起；`batchLoading` 守卫拦截加载中的重复点击。
- `verify:ui` / `verify:preview` 的 `gitBatchPreview` 均为 true，`npm run build` 全绿，本轮无 Rust 变更。

## 风险与后续

- 批量预览只读不提交；一键提交选中文件进入候选池。
- 批量内容统一按 unified diff 合并，未做暂存 / 未暂存分组；行内着色与整文件对比视图继续留在 Backlog。
