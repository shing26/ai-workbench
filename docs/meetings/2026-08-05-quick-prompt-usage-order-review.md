# 2026-08-05 Quick Prompt 使用频次排序评审

## 结论

- `quickPrompts.ts` 新增 `getQuickPromptUsage` / `recordQuickPromptUsage` / `loadQuickPromptsByUsage`，使用次数持久化到 `ai-workbench:quick-prompt-usage:v1`，刷新后仍保留。
- AI Studio 芯片按使用次数降序稳定排序，同次数保持内置默认顺序；点击芯片累计次数、重排并显示次数角标，芯片暴露 `data-quick-prompt-usage`。
- `verify:ui` / `verify:preview` 的 `quickPromptUsage` / `quickPromptUsagePersist` 均为 true，`npm run build` 全绿，本轮无 Rust 变更。

## 风险与后续

- 使用次数仅存本机 localStorage，不跨设备；多端同步自定义 prompt 与使用次数继续留在 Backlog。
- 排序为全局频次，未按 category 分组，也未提供手动固定顺序；后续需要时再进入候选池。
