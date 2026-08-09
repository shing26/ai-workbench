# Sprint 23 计划：部门与 Agent 数据模型

目标：建立“一个部门可以多个 Agent”的数据模型，并把 AI Studio 升级为可选中 Agent 派发；System 视图新增 Agent directory 管理入口。数据全部本地 SQLite（浏览器 fallback 用 localStorage 同构模拟）。

## 数据模型

- `departments`：id、name、description、color、created_at。
- `agents`：id、department_id（外键）、name、role、model、provider_id、system_prompt、is_active、created_at。
- 关系：1 个部门可拥有多个 Agent；Agent 可选绑定 Provider。

## Sprint 23 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 表结构与种子数据 | `departments` / `agents` 建表，设计部等 5 部门与 12+ Agent 种子，单测验证 agent_count 与级联 |
| A2 | Tauri 命令 | `list_departments` / `list_agents` / `create_department` / `create_agent` 注册并返回 camelCase |
| A3 | 前端数据层 | `db.ts` 增加类型与函数，浏览器 fallback 与 Tauri 行为一致 |
| A4 | AI Studio 派发 | Agent 下拉按部门分组；发送时按 Agent 的 provider 派发；Inspector 显示 Department / Agent / Role / Model |
| A5 | System Agent directory | System 视图展示部门与 Agent 列表，支持创建 Agent |
| A6 | 自动化验收 | `verify:ui` / `verify:preview` 覆盖 Agent 下拉、Inspector Trace 与 System 目录 |

## DoD 检查单

- [x] `cargo test --lib` 新增部门/Agent 测试通过，fmt、clippy 全绿。
- [x] 5 大主视图不受影响，AI Studio 默认 Agent 可用。
- [x] System Agent directory 展示设计部 3 个 Agent，可新增 Agent。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.23.0-alpha`。

## 范围外（Backlog）

- Agent 的 system_prompt 编辑器与 Prompt 版本管理。
- 多 Agent 并行编排（部门内多 Agent 分工）与真实 Provider 流式联调。
- 自动生成 Commit/PR 草稿。
