# Sprint 132 计划：AI Studio 会话导出到知识库

目标：在 AI Studio 会话导出面板新增“存入知识库”按钮：把整段会话 Markdown 以 `#chat,#session` 标签存为 Knowledge note，形成对话 → 个人知识库的闭环，Tauri 与浏览器 fallback 共用 `createThought` 链路。

## Sprint 132 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 导出面板按钮 | 会话导出面板新增 `data-session-export-knowledge` 按钮与 `data-session-export-knowledge-result` 结果文本，保存中禁用防重复提交 |
| R2 | 知识库写入 | 点击后调用 `addThought(buildSessionMarkdown(...), '#chat,#session', 'note')`，成功显示 `Saved to Knowledge`，失败显示 `Save failed` |
| R3 | 状态复位 | 打开 / 关闭导出面板时清空保存结果与 busy 状态，避免旧状态残留 |
| R4 | 持久化 | 存入的 note 写入 `thoughts` 与 localStorage `ai-workbench:db:v1`，reload 后 Knowledge 视图可见且标签保持 `#chat,#session` |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionSaveKnowledge` / `sessionSaveKnowledgePersisted` 两条 lane |
| R6 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 导出面板可一键把会话 Markdown 存入 Knowledge note。
- [x] 保存结果明确，重复点击在保存中禁用。
- [x] reload 后笔记仍在 Knowledge 视图且标签保持 `#chat,#session`。
- [x] 双端 lane 覆盖保存与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
