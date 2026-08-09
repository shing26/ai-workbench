# 03 — S7-3: MOA node circuit-breaker (3s timeout + 429 degradation)

**What to build:** MOA 节点故障降级——超时 >3s 或 429 时标记 Disconnected，其余节点继续流式，界面不卡死。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `streamProviderLive` 超时默认 30s → MOA 场景收紧为 3s 首 token 超时（首块前 AbortController 计时）
- [ ] 429/5xx → 节点标记 `Disconnected`（`data-moa-node-status`），跳过重试，其余节点继续
- [ ] 前端 MOA lane 对 Disconnected 节点显示降级徽标（`Disconnected` 而非 Stop/Retry）
- [ ] 其余节点继续打字流输出，busy 不被失败节点阻塞
- [ ] verify lane：mock 一个慢节点（>3s）+ 一个 429 → 断言快节点完成、慢节点 Disconnected、界面不卡

**Definition of Done:** 单节点故障不影响整体流式；自动标记 Disconnected；无界面卡死。AC-2.3。
