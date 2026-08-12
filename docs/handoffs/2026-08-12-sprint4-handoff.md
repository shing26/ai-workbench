# AI Workbench Handoff - Sprint 4 归档与知识反哺

日期：2026-08-12
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-12-sprint3-handoff.md`
落地计划：`docs/plans/one-person-enterprise-refactor.md`（候选池前 5 项已勾选）

## 本次目标

完成 Sprint 4：手动归档旅程 → 生成归档总结 → Knowledge 索引；归档卡片豁免活性衰减并可重新打开；新建/挂载项目时检索关联旧旅程并注入 Studio 上下文。

## 已完成

### 项目挂载（补齐旅程闭环入口）

- `src/views/ProjectsView.tsx`：新增「挂载到 Studio」按钮（`data-project-mount`）：
  - 调用 `getProjectGitContext` 读取 git 状态，写入 `vibeContext` 并跳转 AI Studio。
  - 这是当前唯一把 `vibeContext` 置为非空的入口（此前严格收敛后丢失了挂载 UI，导致 Studio 旅程文档与 Actions 验证无法真正跑通）。
- `src/views/AIStudioView.tsx`：圆桌发言前用 `searchThoughts(项目名 + 旅程 归档)` 检索相关历史旅程，作为 `[相关旅程档案]` system 消息注入，满足「新建/打开项目检索旧旅程并注入论证上下文」。

### 手动归档与重新打开

- `src/views/ProjectsView.tsx`：
  - 「归档旅程」按钮（`data-project-archive`）：汇总已完成 DoD、待办、CLI 运行记录（成功/失败）生成归档 Markdown，写入 Knowledge（tags：`#prism,#journey,#archived,#project-<id>`，type：doc），随后 `journeyStage → archived`。
  - 已归档项目显示「重新打开」按钮（`data-project-reopen`），一键恢复 `ready`。
- `src/views/KnowledgeView.tsx`：
  - 归档卡片豁免活性衰减：tags 含 `archived` 时显示 `📚 已归档旅程`（purple），不再按 🔥/⚠️/❄️ 计算。
  - 归档卡片新增「重新打开」（`data-prism-reopen`）：通过 `#project-<id>` 标签定位项目并恢复 `ready`。

### 遗留修复

- `src/components/layout/AppHeader.tsx`：移除 `prism` CLI 选项，选择器改为由 `detectCliTools` 探测结果驱动（与 CLI 模态一致），启动时自动刷新探测。
- `src/views/ProjectsView.tsx`：CLI 派发的 `specPath` 改为使用 `journeyDocPath`，移除残留硬编码 `docs/plans/sprint-8.md`。
- `scripts/ui-verify.mjs`：
  - React 受控输入改用原生 setter 赋值（项目名称/路径、任务输入），解决 headless 自动化下 React 状态未更新的问题。
  - 新增项目卡片断言（mount / archive / CLI）与失败快照输出（异常 + localStorage + DOM）。

## 质量门结果（2026-08-12 实跑）

- `npm run lint` ✅
- `npm run build` ✅（JS 343.48 kB / CSS 76.61 kB）
- `npm run verify:preview` ✅（5 视图、Dashboard 三栏、项目 mount/archive、CLI 模态、质量门面板全绿）
- `cargo test` ✅ 133/133（本轮未改 Rust）
- 完整 `node scripts/verify-matrix.mjs` 在 Sprint 3 收尾已全绿；本轮前端变更后建议再跑一次作为发布前基线。

## 工作区注意

- 用户脏文件不提交：`package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts`、`src-tauri/Cargo.toml`。
- 浏览器 fallback（`src/lib/db.ts`）与 Rust（`src-tauri/src/db.rs`）必须同构；新命令需在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册。
- dev server：`npm run dev`（浏览器 `localhost:1420`）；桌面：`npm run tauri dev`；验证：`npm run verify:preview` 或 `node scripts/verify-matrix.mjs`。
- Windows 桌面构建：先执行 `$env:PATH = "C:\Users\Shing\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;$env:PATH"` 再运行 `npm run tauri build`。
- PowerShell 写中文易破坏 UTF-8，编辑用 `apply_patch`，读取用 `Get-Content -Encoding UTF8`。

## 下一步建议

1. **Sprint 5（收敛与发布）**：移除 Prism 残留与 P0 外 UI、前后端契约审计（新增 `detect_cli_tools`、`run_quality_gate(dodPath)` 已注册并同构）、`verify:matrix` 纳入质量门、v1.0 发布文档。
2. 用 `tauri dev` 实测真实 CLI 进程、`detect_cli_tools` 探测结果与 Obsidian 联动。
3. 可选：为归档流程补一条 UI 自动化断言（先创建旅程文档 → 挂载 → 归档 → Knowledge 卡片出现）。
