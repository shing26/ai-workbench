# AI Workbench Handoff - Sprint 3 交付与验证

日期：2026-08-12
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-12-strict-convergence-handoff.md`
落地计划：`docs/plans/one-person-enterprise-refactor.md`（候选池前 4 项已勾选）

## 本次目标

完成 Sprint 3：CLI 自动识别、任务挂旅程文档、四级验证矩阵、验证失败自动修复回环（最多 2 轮）。

## 已完成

### CLI 自动识别

- `src-tauri/src/cli_spawn.rs`：
  - `ALLOWED_COMMANDS` 扩展为 `claude / aider / codex / gemini / opencode / qwen / cursor / windsurf`（含 `.exe` / `.cmd` / `.bat` Windows 变体）。
  - 新增 `detect_cli_tools()`：遍历 PATH 探测候选 CLI，返回 `Vec<db::CliToolDetection>`；新增单元测试。
- `src-tauri/src/lib.rs`：新增并注册 Tauri 命令 `detect_cli_tools`，探测结果写入 `cli_tools` 表。
- `src/lib/db.ts`：新增 `detectCliTools()` 包装；浏览器 fallback 保留核心 CLI（claude/aider）并合并已保存探测结果，保持前端可用。
- `src/components/modals/prismModalsStore.ts` + `PrismModals.tsx`：
  - 移除 `prism` / `prism-cli` 选项。
  - CLI 选择器改为由探测结果驱动，只展示 `detected === true` 的 CLI；默认优先 `claude`。
  - 新增“刷新探测”按钮（`data-cli-refresh`）与空探测提示。
  - CLI 派发支持 `payload.prompt` 覆盖（自动修复回环复用）。

### 任务挂旅程文档

- `src/views/ActionsView.tsx`：按当前项目 `journeyDocPath` 组装 CLI 命令，移除硬编码 `docs/plans/sprint-8.md`；无旅程文档时提示先生成旅程。
- `PrismModals.tsx` 的 `buildCliPrompt` 同步支持空 specPath 的降级文案。

### 四级验证矩阵

- `src-tauri/src/lib.rs`：
  - `QualityGateResult` 增加 `levels: Vec<QualityGateLevel>`（level / name / status / errors / durationMs）。
  - `run_quality_gate` 改为异步 + `spawn_blocking`，新增可选 `dod_path` 参数。
  - L1：`tsc --noEmit`、`eslint .`、`cargo check`、`cargo clippy -D warnings`（自动识别根目录或 `src-tauri/` 的 Cargo.toml）。
  - L2：`cargo test`、`npm run build`。
  - L3：`node scripts/preview-verify.mjs`（无头浏览器 + CDP 断言）。
  - L4：读取旅程文档（DoD）→ `git diff` 变更审计（硬编码密钥正则：`sk-` / `AKIA` / PEM，以及新增行中的 `console.log(` / `dbg!(`）→ 复用 `build_moa_consensus_inner` 生成 QA/CISO 语义审查摘要。
- `src/lib/db.ts`：`runQualityGate(projectPath, dodPath?)` 与 `QualityGateLevel` 类型同步。
- `src/views/ActionsView.tsx`：
  - 新增四级验证面板（`data-quality-gate` / `data-gate-run` / `data-gate-level` / `data-gate-fix`）。
  - `v` 快捷键触发验证（任务列表为空也可用）。
  - 失败后“自动修复”按钮组装错误日志 + 旅程文档路径的 Prompt 重派 CLI，每轮人工确认，最多 2 轮。

### verify:matrix 脚本

- 新增 `scripts/verify-matrix.mjs`：串联 L1-L4（L4 为 MOCK 降级：新增 diff 行安全扫描 + 调试输出扫描），输出 JSON 汇总并在失败时非零退出。
- `scripts/ui-verify.mjs`：CLI 模态增加 `data-cli-kind` 断言，Actions 增加 `data-quality-gate` 断言。

## 质量门结果（2026-08-12 实跑）

- `npm run build` ✅（JS 339.28 kB / CSS 76.15 kB / Agency catalog 450.69 kB lazy chunk）
- `npm run lint` ✅
- `npx prettier --check "src/**/*.{ts,tsx,css}" "scripts/*.mjs"` ✅
- `cargo fmt --check` ✅
- `cargo clippy --all-targets --all-features -- -D warnings` ✅
- `cargo test` ✅ 133/133（新增 `detection_covers_known_candidates`）
- `npm run verify:ui` / `npm run verify:preview` ✅（5 视图、Dashboard 三栏、CLI 模态 kinds、质量门面板全绿）
- `node scripts/verify-matrix.mjs` ✅ L1-L4 全绿（L4 MOCK 降级）

## 工作区注意

- 用户脏文件不提交：`package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts`、`src-tauri/Cargo.toml`。
- 浏览器 fallback（`src/lib/db.ts`）与 Rust（`src-tauri/src/db.rs`）必须同构；新命令需在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册。
- dev server：`npm run dev`（浏览器 `localhost:1420`）；桌面：`npm run tauri dev`；验证：`npm run verify:preview` 或 `node scripts/verify-matrix.mjs`。
- Windows 桌面构建：先执行 `$env:PATH = "C:\Users\Shing\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;$env:PATH"` 再运行 `npm run tauri build`。
- PowerShell 写中文易破坏 UTF-8，编辑用 `apply_patch`，读取用 `Get-Content -Encoding UTF8`。

## 下一步建议

1. **Sprint 4（归档与知识）**：手动归档旅程 → 生成归档总结 → Knowledge 索引；归档卡片豁免活性衰减；可重新打开；新建/打开项目时检索关联旧旅程并注入 Studio 上下文。
2. **Sprint 5（收敛与发布）**：移除 Prism 残留与 P0 外 UI、前后端契约审计、`verify:matrix` 纳入质量门、v1.0 发布文档。
3. 可选：用 `tauri dev` 实测真实 CLI 进程与 Obsidian 联动（浏览器 fallback、Rust 单测与桌面 debug 构建此前已验证）。
