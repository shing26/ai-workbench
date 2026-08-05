# Sprint 81 计划：Git 批量提交内容预览

目标：把 Sprint 78 的“单文件 diff”升级为“批量提交内容预览”。dirty 预览面板新增 Preview all 按钮，一次加载全部 changed files 的 unified diff 并合并展示，方便提交前整体检查。

## Sprint 81 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 批量加载 | ProjectsView 新增 `batchDiff` / `batchLoading` 状态与 `loadBatchPreview`，逐个复用 `db.getGitFileDiff` 拉取全部 dirty 文件 |
| A2 | 批量面板 | dirty 预览顶部新增 Preview all 按钮（`data-git-batch-preview`），展开后以 `<pre>` 合并展示每个文件的 diff（`data-git-batch-preview-content`），可再次点击收起 |
| A3 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `gitBatchPreview` lane：展开后断言至少 2 块 `diff --git`、两个 dirty 文件均可见，收起后内容消失 |

## DoD 检查单

- [x] `npm run build` 全绿，前端无 Rust 变更。
- [x] `verify:ui` / `verify:preview` 的 `gitBatchPreview` 为 true。
- [x] 批量预览覆盖全部 changed files，单文件 diff 行为不变。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.81.0-alpha`。

## 范围外（Backlog）

- 不在批量预览中直接提交；一键提交选中文件进入候选池。
- 不做暂存 / 未暂存分组；保持当前统一 unified diff 语义。
