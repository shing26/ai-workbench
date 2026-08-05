# 2026-08-05 AI 生成式今日复盘评审

## 结论

- 新增 `src/lib/dailyRecap.ts`：`buildDailyRecapContext` 聚合 Focus / Habits / Schedule 完成数与总体进度，`buildDailyRecapPrompt` 组装包含三类数据与总体进度的结构化中文提示词。
- AI Studio 新增“今日复盘”按钮（`data-ai-daily-recap`），读取 workbench store 数据后复用 `sendText` 走既有 RAG / 流式 / 会话链路；`send` 拆出 `sendText(text)` 供普通发送与复盘共用。
- `verify:ui` / `verify:preview` 的 `aiDailyRecap` 均为 true，`npm run build` 全绿，本轮无 Rust 变更。

## 风险与后续

- 复盘结果目前只出现在会话中，未自动写入知识库；一键保存复盘笔记进入候选池。
- 复盘提示词固定为“总结完成情况 + 一件可改进事项 + 明日 3 件事”模板，暂不按用户历史偏好定制。
