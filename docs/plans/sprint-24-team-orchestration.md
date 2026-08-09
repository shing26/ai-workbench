# Sprint 24 计划：部门团队并行编排与 system_prompt 编辑器

目标：把“一个部门可以多个 Agent”从数据模型推进到可执行编排。AI Studio 新增 Team 模式，按部门并行派发最多 3 个 Agent，每个 Agent 独立注入自己的 system_prompt 并流式输出；System 的 Agent directory 支持直接编辑并持久化 system_prompt。

## Sprint 24 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust prompt 更新命令 | `update_agent_system_prompt` 更新并返回 Agent；种子 Agent 自带 system_prompt；单测验证更新与持久化 |
| A2 | 前端数据层 | `updateAgentSystemPrompt` 在 Tauri 与 localStorage fallback 行为一致 |
| A3 | Team 模式 | AI Studio 新增 Team 模式与部门选择器；最多 3 个 Agent 并行流式输出并带 Agent 标签 |
| A4 | Prompt 注入 | 单 Agent 与 Team 派发都把对应 Agent 的 system_prompt 注入 system 消息 |
| A5 | Prompt 编辑器 | System Agent directory 行内编辑 system_prompt，保存后持久化并展示预览 |
| A6 | 自动化验收 | `verify:ui` / `verify:preview` 覆盖 Team 并行派发、Team Trace 与 prompt 编辑持久化 |

## DoD 检查单

- [x] `cargo test --lib` 19/19 通过，fmt、clippy 全绿。
- [x] Team 模式并行输出 3 个设计部 Agent，Inspector 显示 Team Trace。
- [x] Agent system_prompt 可编辑、保存并持久化（localStorage 与 SQLite 双路径）。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.24.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调与 Team 结果汇总。
- Agent 汇总结论（讨论式共识）与 Prompt 版本管理。
- 自动生成 Commit/PR 草稿。
