# Sprint 114 计划：AI 复盘结果一键保存更多入口

目标：让“今日复盘”的保存入口不只停留在 Quick Prompt 行：AI Studio 复盘消息本身提供 `data-ai-recap-message-save` 一键保存；Knowledge Thought Inbox 新增 `data-knowledge-recap-save` 复盘草稿一键存档。新增 `src/lib/recapDraft.ts` 跨视图共享最近复盘草稿，保存后双端同步显示已保存状态。

## Sprint 114 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 复盘草稿模块 | `src/lib/recapDraft.ts`：`loadRecapDraft` / `saveRecapDraft` / `markRecapDraftSaved`，localStorage key `ai-workbench:recap-draft:v1` |
| R2 | AI Studio 消息入口 | 复盘回复完成后写入草稿；对应 assistant 消息新增 `data-ai-recap-message-save` 按钮，点击直接保存该消息，保存后按钮禁用并显示已保存 |
| R3 | Knowledge 入口 | Thought Inbox 新增 `data-knowledge-recap-save`：有未保存草稿时一键写入笔记，保存后状态变 saved；无草稿显示提示 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `recapSaveEntries` lane：消息按钮存在且可点、Knowledge 入口完成保存、返回 AI Studio 后消息按钮同步已保存 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 复盘草稿跨视图持久化，保存状态双端同步。
- [x] AI Studio 复盘消息与 Knowledge Thought Inbox 均提供一键保存入口。
- [x] `recapSaveEntries` lane 双端覆盖消息入口、Knowledge 存档与已保存回显。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
