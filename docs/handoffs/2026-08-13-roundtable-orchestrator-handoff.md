# AI Workbench Handoff - 两轮论证 Orchestrator（Deep Module）

日期：2026-08-13
仓库：`D:\ai-workbench`（分支 `develop` / 本轮分支 `codex/roundtable-orchestrator`）
上一份交接：`docs/handoffs/2026-08-13-journey-doc-module-handoff.md`

## 本次提交

- `3a2cf0c` feat(roundtable): extract two-round debate orchestrator

## 本次会话做了什么

1. 读取系统临时目录中的上一份架构报告 `architecture-review-20260813-042416.html`，确认候选 01（旅程文档）与 09（四级门禁单一 manifest）已完成。
2. 选定候选 02：把 Studio 两轮论证从 946 行 view 中抽成独立 deep module。
3. 按 `/grill-with-docs` 有 codebase 决策流程写入 `CONTEXT.md` 论证会话词汇与 `docs/adr/ADR-007-Roundtable-Orchestrator.md`。
4. 判断为单 session 范围，直接 `/implement`：新增 `src/lib/roundtable.ts`，以 `RoundtableOrchestrator` 收敛 seat runs、stream refs、完成/失败/取消、共识收敛与消息持久化。
5. `AIStudioView` 改为只订阅 `RoundtableSnapshot`，删除 run/seat/pending refs 与内联 chunk listener。
6. 按 `/tdd` 先写红测试，再实现；新增 4 条 orchestrator 单测（并行派发、最少 2 席、失败 lane、会话切换清空）。

## 架构决策

- **候选 02 / ADR-007**：两轮论证编排收敛为前端 `roundtable` deep module。
- module interface 是 `RoundtableOrchestrator`，注入 `sendStream` / `listenChunks` / `buildConsensus` / `saveMessage` 四个 adapter；测试可无 React 依赖覆盖完整时序。
- Rust 不改编排职责：Rust 继续提供流式 Provider、`build_moa_consensus` 与消息持久化；Tauri UI 与浏览器 fallback 共用同一 TS orchestrator。
- UI 验证契约未变：`data-roundtable-output`、`data-studio-*`、`data-ai-message-role` 等锚点保持原语义。

## 质量门（2026-08-13 实跑）

- `npm run lint` / `npm run build` / `npm run test:unit`（17 通过）✅
- `cargo test`（142 通过）+ `cargo clippy --all-targets -- -D warnings` + `cargo fmt --check` ✅
- `npm run verify:matrix` L1-L3 GREEN；L4 AI 语义终审需在 app 内执行（SKIP）✅
- `prettier --check`、`node scripts/audit-contract.mjs` ✅

## 工作区注意

- 未提交用户脏文件：`src-tauri/Cargo.toml`、`.reasonix/`、`1.html`、`2.html`、`reasonix.toml`；未触碰。
- `src/data/agencyCatalog.ts` 是 gitignored 生成文件；本轮从主仓库复制到 worktree 以满足本地 build，不进入提交。
- 本机 Rust 工具链需使用 `D:\cargo_home\bin` 与 `CARGO_TARGET_DIR=D:\ai-workbench\src-tauri\target` 才能稳定跑 cargo 命令；直接走 `C:\Users\Shing\.cargo\bin` 的 `.cmd` shim 会让 build script 找不到 `rustc`。
- 浏览器 fallback 的 `writeJourneyDoc` 仍不写文件（与 `writeNote` fallback 一致），本轮不改变该行为。

## 下一个候选

上一份架构报告剩余候选（按建议优先级）：

1. 03 · 交付终端单一状态 owner：gate result、fix round、CLI run 生命周期统一归属。
2. 04 · 按域拆分 workbenchStore：journey / studio / delivery store 替代宽 facade。
3. 07 · Agency 目录真实导入 seam：移除 `prism_agents.rs` 与 ADR-005 遗留 fallback。
4. 10 · VerificationReport 统一 schema：让 auto-fix 消费结构化 report。
5. 11 · 共享 UI anchor contract：`data-*` / view id 单一真源。

## Suggested skills

- `/grill-with-docs`：下一个候选走同样有 codebase 的决策流程
- `/to-spec` + `/to-tickets`：multi-session 时拆 tracer-bullet tickets
- `/code-review`：每个候选收尾双轴审查
