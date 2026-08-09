# 10 — S10-1: API hot-swap (Store + Rust client handle instant update)

**What to build:** 一键热切当前生效 API 节点，Store 与 Rust Client 句柄即时更新，无需重启。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Rust `set_active_provider(id)` 命令（更新 is_active 优先 + 全局 active 句柄）
- [ ] System Provider 卡 `[⚡ 设为当前 API]`（`data-provider-set-active`）→ 即时热切
- [ ] Zustand Store 同步 activeProvider；AI Studio 发送走新节点（无需重启）
- [ ] 热切失败回退旧节点（原子切换）
- [ ] verify lane：热切 → 新节点生效 → AI Studio 使用新 provider

**Definition of Done:** 热切即时生效，无需重启。AC-4.1。
