# 2026-08-05 AI Studio Quick Prompts 评审

## 结论

- 新增 `src/lib/quickPrompts.ts`，以 `QuickPrompt { id, label, category, text }` 定义 6 个生活 / 工作高频模板，AI Studio composer 上方渲染芯片行。
- 点击芯片后把结构化提示词填入输入框并聚焦，芯片暴露 `data-quick-prompt` / `data-quick-prompt-label` / `data-quick-prompt-category`。
- `verify:ui` / `verify:preview` 的 `quickPrompts` lane 均为 true，`npm run build` 通过；本轮无 Rust 变更，既有 82 个 Rust 测试保持全绿。

## 风险与后续

- Quick Prompt 为静态常量，暂不支持用户自定义、编辑与按使用频次排序；自定义模板管理进入下一阶段候选池。
- 6 个模板文案默认中文，后续如需多语言可把文案外置到本地化资源。
