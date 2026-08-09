# 21 — S3-4: MOCK_ALL_AGENTS switch

**What to build:** 开发/调试开关，只 Mock 外部 I/O 5 类，离线跑通 FSM 全流程。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] `lib/mockAgents.ts`：fixture 集中管理（LLM 确定性返回带 stream-chunk 分块、webhook 只写日志、health mock 快照、model discovery mock、Codex 预设结果）
- [ ] 启用：`MOCK_ALL_AGENTS` env + `localStorage('ai-workbench:mock-agents:v1')` 双通道，**默认关**
- [ ] 拦截点：`streamProviderLive` / webhook 投递 / health / model discovery / Codex 执行——存储命令保持真实（FSM 可真实流转）
- [ ] 开启时 UI 顶部显示 "Mock mode" 徽标
- [ ] 与 S2-4 FSMPipeline Mock 驱动联动；真实后端就绪后事件源切换（S2-4 收尾）

**Definition of Done:** `MOCK_ALL_AGENTS=1` 无真实 key/网络跑通 FSM 全流程；生产默认关 + Mock 徽标。
