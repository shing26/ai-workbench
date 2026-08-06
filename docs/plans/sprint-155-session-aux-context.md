# Sprint 155 计划：会话复制携带消息版本历史，导出包含 RAG / Inspector Trace 辅助上下文

目标：复制会话时保留消息编辑版本的血缘关系，导出 Markdown 时内嵌 RAG 来源与 Inspector Trace，让会话档案可完整复盘。

## Sprint 155 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| S1 | `message_aux` 表与命令 | 新增 `message_aux(message_id, payload, updated_at)`，`save_message_aux` 校验 JSON 对象并 upsert，`list_message_aux` 按会话返回；新增两个 Tauri 命令，浏览器 fallback 用 `ai-workbench:db:v1` 的 `messageAux` 同构。 |
| S2 | Rust 复制血缘 | `duplicate_session` 按消息 ID 复制：`chat_messages` 新 ID，`message_versions` 保留历史并重映射 `parent_version_id`，`message_aux` 跟随复制。 |
| S3 | 浏览器复制血缘 | `duplicateSession` 同构复制版本与 aux；`deleteSession` / `truncateChatMessages` 按剩余消息清理 aux。 |
| S4 | 发送时持久化上下文 | AI Studio 普通 / MOA / Team 链路完成后把 `{ rag, trace }` 写入用户消息 aux；Team 链路复用同一协议。 |
| S5 | 导出内嵌上下文 | `buildSessionMarkdown` 新增可选 `auxByMessageId`，用户消息后输出 `### RAG context` 与 `### Inspector Trace` 区块；导出面板直接使用。 |
| S6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionAuxContext` lane：种子带版本与 aux 的会话，复制后断言版本血缘与 aux，导出断言 RAG / Trace 区块；Rust 单测增至 201。 |
| S7 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合并 develop。 |

## DoD 检查单

- [x] 复制会话后消息版本历史与父版本血缘完整保留。
- [x] 复制会话携带 RAG / Inspector Trace 辅助上下文。
- [x] 导出 Markdown 包含 `### RAG context` 与 `### Inspector Trace` 区块。
- [x] `verify:ui` / `verify:preview` 的 `sessionAuxContext` lane 双端通过；Rust 单测 201/201。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Knowledge 向量分片 / 近似索引为下一个 Sprint 候选。
- Connection Layer 与 Monetization Workbench 继续搁置。
