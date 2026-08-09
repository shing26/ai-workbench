# Sprint 25 计划：Commit/PR 草稿生成器

目标：让 Projects 视图从 Git 状态一键生成 Conventional Commit 与 PR 描述草稿，覆盖企业级开发周期的“规范化编码”与“PR 审查”环节。

## Sprint 25 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Git 状态读取 | `get_project_git_context` 优先读取 `git status --short`，无 git 时回退最近修改文件 |
| A2 | Rust 草稿命令 | `generate_commit_pr_draft(path, project_name)` 生成 commit message、PR title、PR body，单测验证 Conventional Commit 格式 |
| A3 | 前端数据层 | `generateCommitPrDraft` 在 Tauri 与浏览器 fallback 行为一致 |
| A4 | Projects UI | 项目卡片新增 Commit/PR draft 按钮与草稿面板，支持 Copy commit / Copy PR |
| A5 | 自动化验收 | `verify:ui` / `verify:preview` 断言草稿包含 Conventional Commit、Changes 与 DoD |

## DoD 检查单

- [x] `cargo test --lib` 20/20 通过，fmt、clippy 全绿。
- [x] Projects 卡片可生成并展示 Commit/PR 草稿。
- [x] 草稿符合 `type(scope): summary`、Changes 清单与 DoD 检查单。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.25.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调与 Team 结果汇总。
- 自动执行 git commit / 创建远端 PR 草稿（需用户确认）。
- Prompt 版本管理与自动文件监听同步。
