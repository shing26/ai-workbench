# 2026-08-05 AI 复盘结果一键保存为知识笔记评审

## 结论

- AIStudioView 新增 `recapReady` / `recapSaving` / `recapSaveResult`：点击“今日复盘”并等待流式结束后，`data-ai-recap-save` 按钮才可用；普通发送或 New chat 会重置状态，避免保存非复盘回复。
- “保存复盘”取最近一条非占位 assistant 回复，组装为 `# 今日复盘 YYYY-MM-DD\n\n回复`，通过 `addThought(..., "#daily,#recap", "note")` 写入既有 thoughts 链路；保存成功回显 `data-ai-recap-save-result`，失败回显错误，保存期间防重复点击。
- 保存后 store 刷新 thoughts，Knowledge Thought Inbox 立即可见新笔记，RAG 文档数同步增加。
- `npm run build` 全绿；`verify:ui` / `verify:preview` 的 `aiRecapSave` / `aiRecapKnowledgeVisible` 均为 true，断言保存结果、localStorage 内容（tags / type）与 Knowledge 视图可见性。

## 风险与后续

- 保存内容取“最近一条 assistant 回复”，不区分是否由复盘触发之外的消息产生；当前 UI 通过 `recapReady` 状态收紧入口，后续可改为按消息 id 精确绑定。
- 复盘笔记只存本机 thoughts，未纳入跨设备同步的加密链路；多端同步继续留在 Backlog。
