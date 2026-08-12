# AI Workbench Handoff - Sprint 5 收敛与发布（v1.0.0）

日期：2026-08-12
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-12-sprint4-handoff.md`
落地计划：`docs/plans/one-person-enterprise-refactor.md`（候选池已全部勾选）
发布文档：`docs/releases/v1.0.0.md`

## 本次目标

完成 Sprint 5：移除 Prism CLI 功能残留、前后端契约审计、`verify:matrix` 纳入质量门、v1.0 发布文档，收尾整个 P0 旅程闭环。

## 已完成

### Prism CLI 功能残留清理

- `src/components/layout/AppHeader.tsx`：移除 `prism` 下拉选项，CLI 选择器由 `detectCliTools` 结果驱动（与 CLI 模态一致），启动自动刷新探测。
- `src/views/ProjectsView.tsx` / `PrismModals.tsx`：所有 CLI 派发 `specPath` 改用 `journeyDocPath`，删除 `docs/plans/sprint-8.md` 硬编码与 `prism-cli` 命令模板。
- 品牌词（PRISM ENGINE / Prism Station / `data-prism-*` / `--prism-*` CSS 变量）保留为视觉主题，不属于功能残留。

### 前后端契约审计

- 新增 `scripts/audit-contract.mjs`：
  - 扫描前端 `invoke('...')` / `invoke<T>('...')` 字符串字面量调用点。
  - 解析 Rust `tauri::generate_handler![...]` 注册列表。
  - 实跑结果：141 个前端命令，0 个在 Rust 侧缺失，0 个动态命令名；18 个 Rust 侧未从前端调用的命令为保留的后端/FSM/密钥接口。

### verify:matrix 与质量门

- `scripts/verify-matrix.mjs` 串联 L1-L4（L4 为 MOCK 降级：新增 diff 行安全扫描 + 调试输出扫描），失败非零退出。
- `scripts/ui-verify.mjs` 增加失败快照（异常 + localStorage + DOM）与 React 受控输入原生 setter 支持。
- 质量门全绿：`build`、lint、prettier、`cargo fmt --check`、clippy、`cargo test`（133/133）、`verify:preview`、`verify:matrix`、`audit-contract`。

### v1.0 发布文档

- 新增 `docs/releases/v1.0.0.md`：发布定位、5 大视图功能、技术栈、质量门结果、运行方式、已知限制、v1.1 候选。

## 质量门结果（2026-08-12 实跑）

- `node scripts/audit-contract.mjs` ✅（0 missing / 0 dynamic）
- `node scripts/verify-matrix.mjs` ✅（L1-L4 全绿）
- `npm run verify:preview` ✅（含项目 mount/archive、CLI 模态、质量门面板断言）
- `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test` ✅

## 工作区注意

- 用户脏文件不提交：`package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts`、`src-tauri/Cargo.toml`。
- 浏览器 fallback（`src/lib/db.ts`）与 Rust（`src-tauri/src/db.rs`）必须同构；新命令需在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册，并同步 `scripts/audit-contract.mjs` 复跑。
- dev server：`npm run dev`（浏览器 `localhost:1420`）；桌面：`npm run tauri dev`。
- 验证命令：`npm run verify:preview`、`node scripts/verify-matrix.mjs`、`node scripts/audit-contract.mjs`。
- Windows 桌面构建：先执行 `$env:PATH = "C:\Users\Shing\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;$env:PATH"` 再运行 `npm run tauri build`。

## 下一步建议

1. 用 `tauri dev` 实测真实 CLI 进程、`detect_cli_tools` 探测结果与 Obsidian 联动（浏览器 fallback、Rust 单测与桌面 debug 构建此前已验证）。
2. 为归档流程补端到端 UI 自动化（创建旅程 → 挂载 → 归档 → Knowledge 卡片出现）。
3. v1.1 引入 vitest 并纳入 L2；把 `verify:matrix` 接入 npm scripts（需用户确认后修改 `package.json`）。
4. 候选池已清空；后续新功能按 P0 外的 Backlog 单独排期。
