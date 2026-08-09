# 09 — S9-2: AI 3-step breakdown popover + one-click dispatch

**What to build:** `a` 键呼出针对当前 Task 的 3 步代码落地建议弹窗，支持一键投递 AI Studio 执行。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 弹窗组件（`data-ai-breakdown`）：展示 3 步建议（识别 → 拆解 → 落地），来源 = task title + actionContext
- [ ] 3 步建议由本地规则生成或调用 AI（MOA/单流）生成
- [ ] `[一键投递]` → 挂载 actionContext + 预填 AI Studio 提示词（复用现有 pipeline）
- [ ] 弹窗键盘可达（Esc 关、Enter 投递），reduced-motion
- [ ] verify lane：a 呼出 → 3 步可见 → 投递切 AI Studio

**Definition of Done:** AI 拆解弹窗 3 步建议 + 一键投递。AC-3.3。
