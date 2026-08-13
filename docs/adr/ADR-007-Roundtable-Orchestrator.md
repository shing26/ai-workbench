# ADR-007: Roundtable Orchestrator（两轮论证编排器）

- 状态：Accepted（2026-08-13）
- 决策者：架构改进 session（经 `/grill-with-docs` 有 codebase 决策）

## 背景

Studio 的两轮论证此前直接写在 `AIStudioView` 中：并行 seat runs、stream refs、轮次完成计数、共识收敛与持久化逻辑由多个可变 refs 同步。界面有 946 行，纯函数调用时序无法脱离 React 测试，且同一“论证会话”状态分散在 view state 与 refs 之间。

## 决策

### 1. 论证会话收敛为一个 deep module

新增前端 `roundtable` module，以 `RoundtableOrchestrator` 作为唯一 interface。它负责：

- 校验在席团队（至少 2 席，最多 5 席）
- 生成用户消息与占位 assistant 消息
- 为每席构造独立 API 上下文并并行派发流
- 按 run id 路由流块、更新消息、判定完成/失败/取消
- 汇总各席输出，调用共识 adapter 生成第二轮草案
- 通过 adapter 持久化用户消息、各席最终消息与共识草案

View 只订阅 `RoundtableSnapshot` 并渲染，不再持有 run/seat/pending refs。

### 2. 使用注入式 adapters

`RoundtableOrchestrator` 接受 `sendStream`、`listenChunks`、`buildConsensus`、`saveMessage` 四个 adapter。真实 UI 注入 `db.sendAiMessageStream` / `db.listenStreamChunks` / `db.buildMoaConsensus` / `db.saveChatMessage`；测试注入同步 fake，即可无 React 依赖覆盖两轮论证时序。

### 3. Rust 侧不改编排职责

Rust 继续负责 Provider 流式请求、`build_moa_consensus` 与消息持久化；两轮论证的时序只存在于前端 `roundtable` module。浏览器 fallback 与 Tauri UI 共用同一 TS 编排器，避免双端再维护一套状态机。

### 4. UI 验证契约不变

`data-roundtable-output`、`data-studio-*`、`data-ai-message-role` 等锚点保持原语义；本次改动不新增、不删除验证锚点。

## Considered Options

- **继续放在 AIStudioView**：改动最小，但论证规则与 React 渲染耦合，refs 时序无法单测，后续每次流式改动都会扩散到 946 行视图。
- **用 Zustand store 作单一 owner**：能集中状态，但会引入全局 store 生命周期；当前只有 Studio 使用该编排，尚未出现第二个 adapter 或跨视图需求。
- **纯函数 reducer**：容易测试，但无法独立管理 stream listener 生命周期与异步完成/失败收口，仍需要 view 负责副作用。

## 后果

- 正面：论证规则有单一 locality；`RoundtableOrchestrator` 成为公共测试 seam；视图显著变薄；未来支持取消、重试或持久化论证会话时有明确归属。
- 代价：新增一个前端 module 与 adapter 包装；首次重构需要把现有 refs 行为完整迁移，避免流状态回归。
- 风险：若 stream listener 与 Promise 完成顺序在 Tauri 与浏览器 fallback 上不同，需要在 `roundtable` 内统一收口；测试用同步 fake 覆盖该顺序，并在完整质量门中回归。
