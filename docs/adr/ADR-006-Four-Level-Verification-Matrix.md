# ADR-006: Four-Level Verification Matrix（四级验证矩阵）

交付终端采用四级验证门禁：L1 静态编译与类型（tsc / cargo check / clippy / eslint）→ L2 单元与契约测试（cargo test / vitest）→ L3 CDP 无头浏览器 UI/E2E 与视觉比对 → L4 AI DoD 语义对齐与安全审计（来自 The Agency 的 QA / CISO 角色）。任一级失败即阻断；失败时把错误日志组装成下一轮 CLI 修复指令，经 CPO 确认后重派，默认最多 2 轮。本决策取代现有只跑 `tsc --noEmit + cargo check --quiet` 的简化 `run_quality_gate`。

**Considered Options**: 保留现有简化质量门（覆盖不足、无法发现 UI 与 DoD 偏差）；无限自动修复（token 消耗不可控）；纯人工检查（效率低、个人工作台不现实）。

**落地形态（2026-08-13）**: 四级门禁由仓库根 `verify.matrix.json` 单一 manifest 驱动：Node CLI（`scripts/verify-matrix.mjs`）与 Tauri command（`run_quality_gate`）双端消费同一命令集与 L4 security rules；fail-fast 采用“级内收集全部错误、级间阻断”；`desktop-smoke` 降为环境预检，不再重复执行 cargo test。

**残余风险收敛（2026-08-13）**: L4 不再依赖 app 内人工触发。`verify.matrix.json` 的 `aiAudit.mode` 为 `cli`，Node CLI 与 Rust `run_quality_gate` 都会执行 `scripts/verify-l4-semantic.mjs` / `verify_matrix::run_semantic_audit`：读取旅程文档（DoD）任务清单，结合 git diff 文件类型判断是否存在代码实现证据。无 diff 返回 `NO_CHANGES`，有 diff 但缺 DoD、或 DoD 有待办任务但只有文档变更时返回 `FAIL`，其余返回 `PASS`；安全扫描规则保持不变。app 内 AI 共识摘要仍保留为可选增强，不再作为唯一执行路径。
