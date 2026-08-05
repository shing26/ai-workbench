# Sprint 26 计划：Team 结果汇总

目标：部门 Agent 并行输出结束后，AI Studio 自动生成一条 Team Summary 汇总消息，并在 Inspector 中展示摘要，形成“并行分工 → 汇总结论”的完整闭环。

## Sprint 26 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 汇总命令 | `build_team_summary(contents)` 提取每个 Agent 输出的首条有效行并拼接，单测验证过滤规则 |
| A2 | 前端数据层 | `buildTeamSummary` 在 Tauri 与浏览器 fallback 行为一致 |
| A3 | AI Studio 汇总 | Team 模式所有 Agent 结束后追加 `Team Summary` 消息并保存会话 |
| A4 | Inspector 摘要 | Team Trace 标题升级为 `Team Trace + Summary`，新增 Summary 区块 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言 `.team-summary` 气泡与摘要行数 |

## DoD 检查单

- [x] `cargo test --lib` 21/21 通过，fmt、clippy 全绿。
- [x] Team 模式结束后出现 Team Summary 气泡并持久化到会话。
- [x] Inspector 显示 Team Trace + Summary。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.26.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调与讨论式共识。
- 自动文件监听同步与 Prompt 版本管理。
- 自动执行 commit / 创建远端 PR 草稿。
