# 15 — S2-4: FSMPipeline contract-first + Mock-driven

**What to build:** FSM 可视化组件，前端契约先行，Mock 驱动开发（后端 fsm_nodes 尚未实现）。

**Blocked by:** S1-4（events.ts 事件源）

**Status:** open

- [ ] `lib/fsm.ts`：定义 `fsm://node/updated` 事件 schema + fsm_nodes 结构 TS 类型（nodeId/status/agent/context/traceId/ts/payload，对齐 ADR §6）
- [ ] `stores/fsmStore.ts`：订阅 fsm 事件，派生 pipeline 视图
- [ ] `components/orchestration/FSMPipeline.tsx`：点击 Live Event Stream 某 run 展开节点拓扑（pending/running/paused/blocked-on-human/complete/aborted）
- [ ] `lib/mockAgents.ts`：Mock 事件序列 fixture（idle→running→blocked-on-human→complete + HITL + error），由 `MOCK_ALL_AGENTS` 注入（S3-4）
- [ ] verify 双级：`fsmPipelineMock`（Mock 渲染）+ 后端就绪后 `fsmPipelineReal`

**Definition of Done:** 不依赖真实后端可开发/验证；后端就绪后事件源无感切换（S3-4 对接）。
