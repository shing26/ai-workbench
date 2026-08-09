# 06 — S8-2: Quality Gate top bar (tsc/lint/prettier silent checks)

**What to build:** 顶栏 Quality Gate 状态——静默跑 tsc/lint/prettier，ALL GREEN ↔ CHECK FAILED。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Rust `run_quality_gate(project_path)`：spawn `tsc --noEmit` / `eslint` / `prettier --check`（带 timeout + 解析错误摘要）
- [ ] 浏览器 fallback mock（无真实命令时返回 deterministic 结果）
- [ ] AppHeader 顶栏 Quality Gate 徽标（`data-quality-gate`）：ALL GREEN ✅ / CHECK FAILED ❌ + 错误计数
- [ ] 项目聚焦/变更时自动触发；手动 Refresh
- [ ] verify lane：mock 失败 → 徽标切换 CHECK FAILED

**Definition of Done:** 顶栏实时反映项目代码健康；静默校验不阻塞操作。AC-1.3。
