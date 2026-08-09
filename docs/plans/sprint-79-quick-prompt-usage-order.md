# Sprint 79 计划：Quick Prompt 按使用频次排序

目标：把 AI Studio 的 Quick Prompt 芯片从“固定顺序”升级为“常用优先”。每次点击芯片都会累计使用次数并持久化，重载后仍按使用频次从高到低排序；未使用过的芯片保持内置默认顺序。

## Sprint 79 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 使用次数存储 | `quickPrompts.ts` 新增 `getQuickPromptUsage` / `recordQuickPromptUsage`，持久化到 `ai-workbench:quick-prompt-usage:v1` |
| A2 | 排序渲染 | 新增 `loadQuickPromptsByUsage`：按使用次数降序、同次数按默认顺序稳定排序；AI Studio 初始与刷新均使用该排序 |
| A3 | 点击计数 | 芯片点击时累计该 prompt 次数并重新排序；芯片暴露 `data-quick-prompt-usage`，使用过的芯片显示次数角标 |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `quickPromptUsage` lane：清空计数后点击 2 次 daily-recap、1 次 wind-down，断言 wind-down 排第一、daily-recap 次数为 2，重载后排序保持 |

## DoD 检查单

- [x] `npm run build` 全绿，前端无 Rust 变更。
- [x] `verify:ui` / `verify:preview` 的 `quickPromptUsage` 为 true。
- [x] 使用次数刷新后仍保留，排序按次数稳定生效。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.79.0-alpha`。

## 范围外（Backlog）

- 不做跨设备同步使用次数；多端同步自定义 prompt 仍留在候选池。
- 不做按分类独立排序或编辑次数重置；保留当前全局频次语义。
