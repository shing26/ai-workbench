# 2026-08-05 RAG 命中人工确认评审

## 结论

- AI Studio 新增 `ragConfirmMode` 开关（`data-rag-confirm-mode`，aria-checked），与既有 RAG 开关并列；开启后命中确认不影响 RAG 本身的开关状态。
- `sendText` 拆分为检索 + `dispatchSend`：开启确认且命中大于 0 时进入 `pendingSend` / `pendingSelected` 待确认态，不置 busy；确认后仅注入勾选的命中，普通发送、团队模式、复盘与 regenerate 路径保持不变。
- 确认面板展示每条命中的复选框、score、选中计数与 Send / Cancel；Send 按钮在 0 选中时禁用，取消后清理待确认内容并清空 ragHits。
- New chat 与会话切换会清理待确认内容，避免跨会话残留。
- `verify:ui` / `verify:preview` 新增 `ragConfirmSend` lane：2 条命中 → 取消 1 条 → Send with 1 → badge RAG +1；关闭确认后再发送不出现面板，输入框正常清空。
- `cargo test --lib` 101/101、fmt、clippy、`npm run build`、`verify:ui` / `verify:preview` 全绿。

## 风险与后续

- 命中确认是发送前的静态勾选，不做发送后反馈或“下次记住选择”；后续可加每类命中的优先级排序。
- 复盘快捷入口在确认模式下也会等待确认，属预期行为；如需强制直发可后续加跳过规则。
- Embedding 向量检索、跨文件命中选择器继续留在 Backlog。
