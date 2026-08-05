# 2026-08-05 部门团队编排评审

## 结论

- AI Studio 新增 Team 模式：按部门并行派发最多 3 个 Agent，每个 Agent 使用自己的 system_prompt 独立流式输出，消息气泡带 Agent 与 Role 标签。
- Inspector 新增 Team Trace，展示 Department、Agents、Role、Model 与并行状态；RAG 命中时追加 RAG context。
- System Agent directory 支持行内编辑 system_prompt，保存后立即持久化并展示预览。

## 风险与后续

- 并行流需要等全部 Agent 结束才关闭 busy；Stop 会取消所有 Team run 并标记 `[stopped]`。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、Team 结果汇总、自动生成 Commit/PR 草稿。
