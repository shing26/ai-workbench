# 2026-08-05 Quick Prompt 自定义与持久化评审

## 结论

- `quickPrompts.ts` 新增 `CustomQuickPrompt`、`loadQuickPrompts` / `listCustomQuickPrompts` / `addCustomQuickPrompt` / `deleteCustomQuickPrompt`，自定义项持久化到 `ai-workbench:quick-prompts:v1`。
- AI Studio Manage 面板支持新增 label / category / text 自定义 prompt 与删除，内置模板不可删除；自定义项与内置项合并渲染并可直接填入输入框。
- `verify:ui` / `verify:preview` 的 `quickPromptManager` / `quickPromptPersist` 均为 true，`npm run build` 通过；本轮无 Rust 变更，既有 82 个 Rust 测试保持全绿。

## 风险与后续

- 自定义 prompt 暂不支持编辑、排序与多端同步；后续可加入编辑与排序。
- `Date.now()` 生成 id 在极端连续新增场景可能冲突，后续可迁移到 `makeId()` 或持久化计数器。
