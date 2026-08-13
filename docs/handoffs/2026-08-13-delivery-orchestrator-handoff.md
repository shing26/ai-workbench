# AI Workbench Handoff - Delivery Orchestrator（Deep Module）

日期：2026-08-13
仓库：`D:\ai-workbench`（分支 `develop` / 本轮分支 `codex/roundtable-orchestrator`）
上一份交接：`docs/handoffs/2026-08-13-roundtable-orchestrator-handoff.md`

## 本次提交

- `feat(delivery)`: add delivery orchestrator deep module
- `docs(delivery)`: add delivery orchestrator handoff

## 本次会话做了什么

1. 按上一份交接选定候选 03：交付终端单一状态 owner。
2. 经 `/grill-with-docs` 有 codebase 决策流程写入 `CONTEXT.md` 交付记录词汇与 `docs/adr/ADR-008-Delivery-Orchestrator.md`。
3. 判断为单 session 范围，直接按 `/tdd` 实现：新增 `src/lib/delivery.ts`，以 `DeliveryOrchestrator` 收敛 gate result、fix round、CLI 生命周期与持久化。
4. 新增 `delivery_runs` SQLite 表与 `list_delivery_runs` / `record_delivery_run` Tauri 命令；浏览器 fallback 使用 `ai-workbench:delivery-runs:v1` 保持同构。
5. `ActionsView` / `CliModal` / `DashboardView` 改为消费 orchestrator snapshot；`workbenchStore.qualityGate` 死状态删除，`FILE_UPDATED` 改调 `refreshGate`。
6. 按 `/code-review` 双轴审查修复 findings，并重跑完整质量门。
7. 收敛 L4 残余风险：新增 CLI/Rust 双端确定性 DoD 语义对齐，L4 从 `SKIP` 转为 `GREEN`。

## 架构决策

- **候选 03 / ADR-008**：`DeliveryOrchestrator` 是 app 级单一状态 owner，提供 `snapshot / subscribe` 与可注入 adapter。
- 一次 delivery attempt 一条记录：点 `v` 创建或更新当前 attempt，自动修复复用同一条并推进 `fixRound`，手动 CLI 派发单独生成一条 CLI run。
- CLI 生命周期由 orchestrator 在 mount 时统一订阅 `cli_log_line` / `cli_exited`，组件不再直接调用 `recordCliRun`，`ActionsView` 移除 8 秒轮询。
- 重启恢复优先选择最近 gate attempt（`gateResult !== null`，首选空 command），后续手动 CLI 不会覆盖 gate / fix 状态；`recentRuns` 仍按最新优先展示全部运行。
- Rust/browser 差异收在 `db.ts` adapter；UI 验证契约 `data-quality-gate` / `data-gate-run` / `data-cli-run` / `data-cli-run-row` / `data-cli-exit-code` 保持原语义。

## 审查结论与修复

Spec/ADR 源：`docs/adr/ADR-008-Delivery-Orchestrator.md`、`CONTEXT.md` 交付记录词汇。

已修复：
- 手动 CLI 在 gate 之后生成独立 run，不再吞并当前 gate attempt。
- `handleExit` 按 `deliveryRunId` 回写对应 run，自动修复与手动 CLI 都能持久化终态。
- `applyRuns` 重启恢复最近 gate attempt，后续手动 CLI 不覆盖 gate result / fix round。
- `runGate` / `refreshGate` 收敛到 `executeGate`，重复验证保持 `fixRound`。
- 旧 localStorage CLI 记录改为非破坏性迁移读取，不删除旧 key。
- Rust `get_delivery_run` / `list_delivery_runs` 提取共用 row mapper。

## 质量门（2026-08-13 实跑）

- `npm run lint` / `npm run build` / `npm run test:unit`（24 通过）✅
- `npm run format:check` / `node scripts/audit-contract.mjs` ✅
- `cargo test`（143 通过）+ `cargo clippy --all-targets --all-features -- -D warnings` + `cargo fmt --check` ✅
- `npm run verify:matrix` L1-L4 GREEN；L4 由 CLI/Rust 确定性 DoD 语义对齐 + 安全扫描执行 ✅
- `prettier --check` 保持兼容 ✅

## 工作区注意

- 未提交用户脏文件：`src-tauri/Cargo.toml`、`.reasonix/`、`1.html`、`2.html`、`reasonix.toml`；未触碰。
- 本机 Rust 工具链需使用 `D:\cargo_home\bin` 与 `CARGO_TARGET_DIR=D:\ai-workbench\src-tauri\target` 才能稳定跑 cargo 命令。
- `npm run verify:matrix` 的 preview-verify 需要端口 4173 空闲；如上次运行残留 `vite preview`，先清理再跑。
- 浏览器 fallback 的 `writeJourneyDoc` 仍不写文件，本轮不改变该行为。

## 下一个候选

上一份架构报告剩余候选（按建议优先级）：

1. 04 · 按域拆分 workbenchStore：journey / studio / delivery store 替代宽 facade。
2. 07 · Agency 目录真实导入 seam：移除 `prism_agents.rs` 与 ADR-005 遗留 fallback。
3. 10 · VerificationReport 统一 schema：让 auto-fix 消费结构化 report。
4. 11 · 共享 UI anchor contract：`data-*` / view id 单一真源。

## Suggested skills

- `/grill-with-docs`：下一个候选走同样有 codebase 的决策流程
- `/to-spec` + `/to-tickets`：multi-session 时拆 tracer-bullet tickets
- `/code-review`：每个候选收尾双轴审查
