# ADR-006: Four-Level Verification Matrix（四级验证矩阵）

交付终端采用四级验证门禁：L1 静态编译与类型（tsc / cargo check / clippy / eslint）→ L2 单元与契约测试（cargo test / vitest）→ L3 CDP 无头浏览器 UI/E2E 与视觉比对 → L4 AI DoD 语义对齐与安全审计（来自 The Agency 的 QA / CISO 角色）。任一级失败即阻断；失败时把错误日志组装成下一轮 CLI 修复指令，经 CPO 确认后重派，默认最多 2 轮。本决策取代现有只跑 `tsc --noEmit + cargo check --quiet` 的简化 `run_quality_gate`。

**Considered Options**: 保留现有简化质量门（覆盖不足、无法发现 UI 与 DoD 偏差）；无限自动修复（token 消耗不可控）；纯人工检查（效率低、个人工作台不现实）。
