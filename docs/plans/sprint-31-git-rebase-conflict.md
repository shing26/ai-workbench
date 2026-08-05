# Sprint 31 计划：自动 Rebase 与冲突处理

目标：Projects 的 Git 工作流补上“同步主分支”闭环。当前分支可一键 rebase 到指定 base 分支，冲突时列出冲突文件并支持 Abort，PR 前同步不再依赖手工终端操作。

## Sprint 31 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust Rebase 命令 | `rebase_branch(path, base_branch)` 执行 `git rebase`，成功返回 `{ rebased, conflict, files, base, branch, head }`；冲突时返回 `conflict: true` 与冲突文件列表 |
| A2 | Rust Abort 命令 | `abort_rebase(path)` 执行 `git rebase --abort`，清理冲突现场 |
| A3 | 前端数据层 | `GitRebaseResult` 类型与 rebase/abort 同构封装，localStorage fallback 返回确定性成功结果 |
| A4 | Projects UI | Git 图谱新增 Rebase onto main 按钮；冲突时展示冲突文件与 Abort rebase 按钮，成功后刷新图谱 |
| A5 | 自动化验收 | Rust 单测覆盖干净 rebase 与冲突检测/abort；`verify:ui` / `verify:preview` 断言 rebase 结果可见 |

## DoD 检查单

- [x] `cargo test --lib` 29/29 全绿，fmt、clippy 全绿。
- [x] 干净仓库可自动 rebase；冲突仓库返回文件列表并可 abort。
- [x] 浏览器 fallback 下 Rebase 与 Abort 按钮可用且结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.31.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调。
- rebase 冲突自动解决 / 三方合并策略。
- 跨设备云端同步传输。
