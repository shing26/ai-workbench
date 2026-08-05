# Sprint 29 计划：一键 Commit 与远端 PR

目标：把 Sprint 25 的 Commit/PR 草稿从“只生成文案”升级为“可执行”。用户在 Projects 卡片上生成草稿后，可以直接在仓库内执行 `git add -A` + `git commit`，再调用 `gh pr create` 创建远端 PR，全程有结果回显与失败提示。

## Sprint 29 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust Commit 执行 | `apply_commit(path, message)` 执行 `git add -A` + `git commit -m`，返回 `{ committed, hash, branch, message }`；无变更时不报错并返回 `committed: false` |
| A2 | Rust 远端 PR | `create_remote_pr(path, title, body)` 校验 git remote 与 `gh` CLI，执行 `gh pr create` 并解析 URL；无 remote / 无 gh 时返回可读错误 |
| A3 | 前端数据层 | `GitCommitResult` / `RemotePrResult` 类型与 apply/create 同构封装，localStorage fallback 返回确定性的本地模拟结果 |
| A4 | Projects UI | 草稿面板新增 Commit changes 与 Create PR 按钮，展示 commit hash / PR URL / 错误信息，提交后刷新 Git 图谱 |
| A5 | 自动化验收 | Rust 单测覆盖真实临时 git 仓库 commit 与无 remote 错误；`verify:ui` / `verify:preview` 断言执行结果可见 |

## DoD 检查单

- [x] `cargo test --lib` 27/27 全绿，fmt、clippy 全绿。
- [x] 真实仓库可一键提交，无 remote / 无 gh 时错误提示清晰。
- [x] 浏览器 fallback 下 Commit 与 Create PR 按钮可用且结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.29.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调。
- PR 冲突解决与自动 rebase。
- 跨设备云端同步传输。
