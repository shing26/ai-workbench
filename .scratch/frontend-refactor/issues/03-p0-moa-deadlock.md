# 03 — P0-3: MOA browser-mode deadlock fix

**What to build:** 修复浏览器 fallback 下 MOA 无真实 Provider 时永久卡死、回复不落库。

**Blocked by:** None — can start immediately.

**Status:** completed

**Root cause:** `src/lib/db.ts:6745` MOA 分支要求 `realProviders.length > 0`，无 Provider 时 fallback 只对父 runId 发 chunk，而前端监听子 runId（`{runId}-p0`…），全部丢弃 → busy 恒 true。

- [ ] fallback MOA 分支在 `realProviders.length === 0` 时按子 runId 发 mock chunk（与 Tauri 语义对齐）
- [ ] 前端加 busy 看门狗（如 15s 无终态自动置 idle + 错误态）
- [ ] 移除/软化 `newChat` / `selectSession` 的 `if (busy) return` 锁死
- [ ] verify lane：无 Provider 启动 MOA → 正常结束 + assistant 消息落库

**Definition of Done:** 浏览器模式 MOA 永不卡死；取消/结束均落库；可发新消息。
