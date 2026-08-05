# 2026-08-05 部门与 Agent 数据模型评审

## 会议目标

把“一个部门可以多个 Agent”落为正式数据模型，并让 AI Studio / System 可管理、可派发 Agent。

## 设计部与架构部结论

1. 部门表 `departments` 与 Agent 表 `agents` 一对多，Agent 通过 `department_id` 归属部门。
2. Agent 保存角色、模型、可选 Provider 绑定与 system_prompt，为后续多 Agent 编排预留字段。
3. 种子数据按现有部门分工：设计部（UI Designer、Frontend Developer、UI Finish-Gate Reviewer），产品与体验部、后端与系统部、AI 策略与引擎部、质量与工程效率部。
4. AI Studio 新增按部门分组的 Agent 下拉；Single 模式下按 Agent 绑定的 Provider 派发，Inspector 展示 Agent Trace。
5. System 视图新增 Agent directory，提供部门计数与创建 Agent 表单。
6. 浏览器 fallback 与 Tauri 行为同构，保证 `verify:ui` / `verify:preview` 两条 lane 一致。

## 风险

- 旧库升级需 `CREATE TABLE IF NOT EXISTS` 自动补表；`seed_agents_if_empty` 只在空表时写入。
- Agent 的 provider_id 为空时回退到默认 active Provider，避免派发断裂。
- Agent 数量增长后，AI Studio 下拉需按部门分组并保持 max-width，防止顶栏换行。
