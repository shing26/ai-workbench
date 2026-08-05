# 2026-08-05 Agent Prompt 版本管理评审

## 结论

- `agent_prompt_versions` 表记录每次更新前的旧 Prompt；`list_agent_prompt_versions` 按时间返回历史，`restore_agent_prompt` 恢复前会把当前版本再留档，形成完整血缘。
- System Agent directory 的 Prompt 编辑器新增 Versions 列表与 Restore 按钮。
- Rust 单测覆盖“两次更新 → 两个版本 → 恢复 v1 → 三个版本”的完整链路，两条 UI 验收 lane 全绿。

## 风险与后续

- 版本按创建时间排序，恢复动作也会产生新版本，用户可随时回到任意历史点。
- 下一 Sprint 候选：自动文件监听同步、真实 Provider 端到端流式联调。
