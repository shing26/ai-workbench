# 12 — S2-1: Three-tier IA + Live Event Stream Stage

**What to build:** SystemView 改造为三层层级（Stage/Rail/Fold），Stage = Agent Live Event Stream。

**Blocked by:** S1-4（events.ts Ring Buffer）

**Status:** open

- [ ] `BentoCard` 新增 `tier: 'stage' | 'rail' | 'fold' | 'grid'` prop，三种视觉权重
- [ ] `SystemStage`（Live Event Stream）：高密度滚动列表，事件行按 level 着色（蓝=info/绿=success/琥珀=HITL/玫红=error），自动滚动锁定 + 手动暂停 + 按 agent/level 过滤
- [ ] HITL 事件行内联确认按钮（Approve/Reject/Edit Payload），走 `usePermissionGuard`（S2-5）
- [ ] 新事件入场动效：opacity 0→1 + translateY(4px→0)，120ms，reduced-motion 即时插入
- [ ] 原"静态驾驶舱"内容分流：FSM 拓扑→Drawer、token 总量/TPM 压力→Rail、HITL 独立队列移除（已融入事件流）

**Definition of Done:** SystemView 首屏 = Stage(60%) + Rail(40%)；时序而非快照；每一像素有信息。
