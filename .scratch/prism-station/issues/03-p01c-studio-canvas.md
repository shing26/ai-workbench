# 03 — P0-1c: Studio 大容量画布 + Agent 席位选择 + ⌘Enter

**What to build:** AI Studio 升级为大容量画布（min-h-640 / 消息 h-520），多行 textarea ⌘Enter 发送，顶部 Agent 席位多选勾选。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] 画布容器 `min-h-[640px]`，消息区 `h-[520px]` 滚动
- [ ] 多行自适应 `<textarea>`（Shift+Enter 换行，⌘Enter 发送）
- [ ] 顶部席位多选：勾选在席高管（来自 `list_agent_specs`），`data-agent-seat` 锚点
- [ ] 发送时若勾选 ≥2 席位 → 走 `run_roundtable`；1 席 → 单 Agent 流；0 → 普通单模型
- [ ] verify lane：席位勾选 → 发送 → 多路流渲染

**Definition of Done:** 大容量画布稳定 + 多行 ⌘Enter + 席位勾选触发辩论。Sprint 2 DoD-2。
