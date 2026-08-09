# Sprint 100 计划：AI Studio 会话工作台

目标：把 AI Studio 会话栏从“可管理列表”升级为“会话工作台”：支持置顶、消息数展示、一键复制会话、Markdown 导出/复制/下载，方便日常对话沉淀与迁移。

## Sprint 100 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| D1 | Rust 数据模型 | `sessions` 新增 `pinned INTEGER NOT NULL DEFAULT 0`，新库 SCHEMA 直接建列，旧库走 `migrate_session_pinned` 幂等补列 |
| D2 | Rust 命令 | 新增 `set_session_pinned(id, pinned)` 与 `duplicate_session(id)`；`list_sessions` 返回 `pinned` 与 `message_count`，按置顶优先、创建时间倒序 |
| D3 | 浏览器 fallback | `db.ts` 新增 `setSessionPinned` / `duplicateSession` / `buildSessionMarkdown`，localStorage 同一模型，旧数据自动补 `pinned=false` 与消息数 |
| D4 | AI Studio UI | 会话行新增置顶按钮、消息数元信息、复制会话与导出 Markdown 操作；导出面板支持预览、复制、下载 `.md` |
| D5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionWorkspace` lane：置顶排序、消息数、复制会话、Markdown 导出与面板关闭 |

## DoD 检查单

- [x] 会话可置顶/取消置顶，置顶会话始终排在未置顶之前。
- [x] 会话列表显示消息数，Rust 与浏览器 fallback 行为一致。
- [x] 复制会话会生成 `(copy)` 标题并完整复制该会话消息。
- [x] 导出面板可预览、复制、下载 Markdown 转写。
- [x] `npm run build`、Rust 114 单测、clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.100.0-alpha`。

## 范围外（Backlog）

- 复制会话不复制消息版本历史（版本仍绑定原消息 ID）。
- 导出只覆盖当前会话文本，不含 RAG 命中、Inspector Trace 等辅助上下文。
- 暂不做会话归档、批量导出与跨设备会话导入。
