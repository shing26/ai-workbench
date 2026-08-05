# Sprint 86 计划：AI 复盘结果一键保存为知识笔记

目标：把 Sprint 84 留下的“AI 复盘结果一键保存为知识笔记”候选池项落地。今日复盘生成完成后，用户可一键把回复保存为 Knowledge 的 `note` 类型笔记，自动带上 `#daily,#recap` 标签与日期标题，并立即可在 Knowledge 视图看到。

## Sprint 86 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 保存状态 | AIStudioView 新增 `recapReady` / `recapSaving` / `recapSaveResult` 状态；点击“今日复盘”并流式结束后按钮才可用，普通发送 / New chat 后重置 |
| A2 | 一键保存 | 新增“保存复盘”按钮（`data-ai-recap-save`），取最近一条非占位 assistant 回复，组装为 `# 今日复盘 YYYY-MM-DD\n\n回复`，通过 store `addThought(..., "#daily,#recap", "note")` 写入知识库 |
| A3 | 结果回显 | 保存后显示 `data-ai-recap-save-result`（含日期）；失败时回显错误信息；保存期间按钮显示 Saving 并防重复点击 |
| A4 | Knowledge 可见 | 保存后 store 刷新 `thoughts`，Knowledge Thought Inbox 立即可见新笔记；RAG 文档数随新增笔记更新 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `aiRecapSave` / `aiRecapKnowledgeVisible` lane：生成复盘 → 保存 → 断言 localStorage 与 Knowledge 视图 |

## DoD 检查单

- [x] `npm run build` 全绿；本轮无 Rust 变更。
- [x] `verify:ui` / `verify:preview` 的 `aiRecapSave` / `aiRecapKnowledgeVisible` 均为 true。
- [x] 保存内容为 `note` 类型、标签 `#daily,#recap`，Knowledge 视图可见。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.86.0-alpha`。

## 范围外（Backlog）

- 不做多端同步自定义 prompt 与使用次数；继续留在 Backlog。
- 不做行内着色与 diff 编辑器、整文件对比视图；继续留在 Backlog。
- 不做复盘结果按用户历史偏好定制模板；继续留在候选池。
