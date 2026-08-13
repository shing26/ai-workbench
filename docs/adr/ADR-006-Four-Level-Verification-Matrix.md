# ADR-006: Four-Level Verification Matrix（四级验证矩阵）

交付终端采用四级验证门禁：L1 静态编译与类型（tsc / cargo check / clippy / eslint）→ L2 单元与契约测试（cargo test / vitest）→ L3 CDP 无头浏览器 UI/E2E 与视觉比对 → L4 AI DoD 语义对齐与安全审计（来自 The Agency 的 QA / CISO 角色）。任一级失败即阻断；失败时把错误日志组装成下一轮 CLI 修复指令，经 CPO 确认后重派，默认最多 2 轮。本决策取代现有只跑 `tsc --noEmit + cargo check --quiet` 的简化 `run_quality_gate`。

**Considered Options**: 保留现有简化质量门（覆盖不足、无法发现 UI 与 DoD 偏差）；无限自动修复（token 消耗不可控）；纯人工检查（效率低、个人工作台不现实）。

**落地形态（2026-08-13）**: 四级门禁由仓库根 `verify.matrix.json` 单一 manifest 驱动：Node CLI（`scripts/verify-matrix.mjs`）与 Tauri command（`run_quality_gate`）双端消费同一命令集与 L4 security rules；fail-fast 采用“级内收集全部错误、级间阻断”；L4 AI DoD 审计只在 app 内执行，CLI 侧显式标记 SKIPPED；`desktop-smoke` 降为环境预检，不再重复执行 cargo test。
