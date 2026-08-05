# Sprint 27 计划：Agent Prompt 版本管理

目标：为 Agent 的 system_prompt 增加版本历史，保存时自动留档，支持查看与一键恢复，让 Prompt 演进可追溯、可回滚。

## Sprint 27 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 版本表 | `agent_prompt_versions` 建表并建立索引，更新 Prompt 时保存旧版本 |
| A2 | Rust 命令 | `list_agent_prompt_versions` / `restore_agent_prompt` 注册，单测验证历史与恢复 |
| A3 | 前端数据层 | localStorage fallback 记录版本、列出版本、恢复版本，与 Tauri 行为一致 |
| A4 | System UI | Prompt 编辑器新增 Versions 列表与 Restore 按钮 |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言版本行、恢复结果与持久化 |

## DoD 检查单

- [x] `cargo test --lib` 22/22 通过，fmt、clippy 全绿。
- [x] 保存 Prompt 自动产生版本，可列出并恢复。
- [x] 恢复后当前 Prompt 与新版本均持久化。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.27.0-alpha`。

## 范围外（Backlog）

- 自动文件监听同步。
- 真实 Provider 端到端流式联调。
- 自动执行 commit / 创建远端 PR 草稿。
