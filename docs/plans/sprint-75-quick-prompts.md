# Sprint 75 计划：AI Studio 日常 Quick Prompts

目标：围绕“AI 工作台便捷日常的生活和工作”，在 AI Studio 对话输入区上方提供 6 个高频 Quick Prompt（生活与工作各 3 个）。一键把结构化提示词填入输入框并聚焦，减少重复输入，不新增 Dock 视图、不改变 5 大主视图范围。

## Sprint 75 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Prompt 数据模型 | 新增 `src/lib/quickPrompts.ts`：`QuickPrompt { id, label, category: life/work, text }`，内置 6 个模板 |
| A2 | AI Studio UI | composer 上方新增 Quick Prompt 芯片行，点击后 `setInput(prompt.text)` 并聚焦输入框 |
| A3 | 可访问性 | 每个芯片带 `data-quick-prompt` / `data-quick-prompt-label` / `data-quick-prompt-category` |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `quickPrompts` lane：>=4 个芯片、life/work 两类齐全、点击后输入框内容正确 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Quick Prompt 数据模型与 AI Studio UI 覆盖生活 / 工作两类高频模板。
- [x] `verify:ui` / `verify:preview` 的 `quickPrompts` 为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.75.0-alpha`。

## 范围外（Backlog）

- Quick Prompt 暂不支持自定义编辑与持久化；自定义模板管理进入下一阶段候选池。
- 不按 category 分组展示，也不做按最近使用排序。
