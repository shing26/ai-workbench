# 02 — P0-1b: 多 Agent 圆桌辩论调度器（Rust 串并行混合）

**What to build:** Rust 端串并行混合调度器：多个在席高管各自独立思考（并行），再交叉质疑辩论（串行轮次），最终输出共识/分歧。

**Blocked by:** 01 (P0-1a agent specs)

**Status:** completed

- [ ] Rust `run_roundtable(spec_ids, topic)`：
  - 阶段 1 独立思考：并行 `stream_ai_message`（每 Agent 用其 system prompt + topic）
  - 阶段 2 交叉质疑：串行 N 轮，Agent i 看到前序方案并补充/质疑
- [ ] `RoundtableResult`：各 Agent 观点 + 共识摘要 + 分歧点 + Trade-off（pros/cons/security）
- [ ] Tauri 命令 `run_roundtable` + 浏览器 fallback（mock 多路流）
- [ ] 事件流：`roundtable-tick`（每 Agent 完成 emit 一段）
- [ ] Rust 单测：并行度、轮次顺序、观点收集

**Definition of Done:** 勾选 Agent 席位可展现独立思辨 + 辩论交互。Sprint 2 DoD-1。
