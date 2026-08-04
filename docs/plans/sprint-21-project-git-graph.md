# Sprint 21 计划：项目级 Git 图谱

目标：让 Projects & Vibe Coding 真正承接“从想法到代码落地”。读取项目本地 `.git` 元数据，在项目卡片展示分支、提交数、最新提交与文件变更，作为项目级版本图谱。

## Sprint 21 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| P1 | Git 元数据解析 | `get_project_git_context` 返回 `branch`、`commitCount`、`latestCommit`（hash/author/message）与 `changes` |
| P2 | 项目图谱 UI | 项目卡片新增 Git 图谱区：分支徽章、提交计数、最新提交行、最近文件变更 |
| P3 | 浏览器 fallback | `getProjectGitContext` 提供确定性的 mock 数据供自动化验证 |
| P4 | 自动化验收 | Rust 单测覆盖 `.git` HEAD/logs 解析；`verify:ui` 新增项目图谱断言 |

## 范围外（进入 Backlog）
- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 自动文件监听与云端同步传输
- 自动生成 Commit/PR 草稿

## DoD 检查单

- [x] Rust 单测覆盖分支/提交数/最新提交解析
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
