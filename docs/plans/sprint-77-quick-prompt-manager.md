# Sprint 77 计划：Quick Prompt 自定义与本地持久化

目标：把 Sprint 75 的静态 Quick Prompt 升级为可维护的个人高频入口。用户可在 AI Studio 的 Manage 面板新增自定义 prompt（label / category / text），自定义项持久化到 localStorage，刷新后仍保留，也可删除。

## Sprint 77 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 持久化模型 | `quickPrompts.ts` 新增 `CustomQuickPrompt`、`loadQuickPrompts` / `listCustomQuickPrompts` / `addCustomQuickPrompt` / `deleteCustomQuickPrompt`，存 `ai-workbench:quick-prompts:v1` |
| A2 | Manage 面板 | AI Studio 芯片行新增 Manage 开关，面板含 label / category / text 输入、Add 与自定义项删除 |
| A3 | 合并渲染 | 芯片行渲染内置 + 自定义 prompt，点击自定义项同样填入输入框并聚焦 |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `quickPromptManager` / `quickPromptPersist` lane：新增后立即可见、刷新后仍在、删除后消失 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Quick Prompt 自定义项持久化到 localStorage，内置模板不可删除。
- [x] `verify:ui` / `verify:preview` 的 `quickPromptManager` / `quickPromptPersist` 均为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.77.0-alpha`。

## 范围外（Backlog）

- 暂不支持编辑已有自定义项与拖拽排序；后续可加入编辑与排序。
- 不新增按用户 / 设备同步自定义 prompt；多端同步进入候选池。
