# ADR-008: Delivery Orchestrator（交付终端单一状态 owner）

状态：Accepted，2026-08-13
决策者：架构改进 session（经 `/grill-with-docs` 有 codebase 决策）

## 背景

交付终端当前把 gate result、fix round、CLI run 生命周期分散在 `ActionsView` 本地 state、`CliModal` 本地 state 与 `workbenchStore.qualityGate` 死 state 中。CLI 记录只存在于浏览器 `localStorage`，Rust/Tauri 没有持久化；自动修复轮数重载即失。

## 决策

### 1. 交付记录跨重启持久化

新增统一 `DeliveryRun` 模型，字段包括 `runId`、`projectPath`、`command`、`exitCode`（允许为 null）、`startedAt`、`finishedAt`、`gateResult`、`fixRound`。

- Rust/Tauri：新增 `delivery_runs` SQLite 表，并通过 Tauri command 读写。
- Browser fallback：使用同构 `localStorage` 存储同一模型，保持 `db.ts` 双端契约一致。

### 2. `DeliveryOrchestrator` 作为 app 级 deep module

新增 `src/lib/delivery.ts`，以 `DeliveryOrchestrator` 作为唯一状态 owner，提供 `snapshot / subscribe` 与可注入 adapter。它在应用启动时 mount 一次，`ActionsView` 与 `CliModal` 只消费快照和命令；Rust/browser fallback 差异收在 db adapter。

### 3. 一次 delivery attempt 一条记录

点 `v` 创建或更新当前 attempt；自动修复复用同一条记录并推进 `fixRound`；CLI exit 回写同一条记录。手动 CLI 派发单独生成一条 CLI run。

### 4. CLI 生命周期由 orchestrator 统一订阅

`DeliveryOrchestrator` 在 mount 时订阅 `listenCliLog` / `listenCliExit`，负责 active run、logs、running、exitCode 与退出后的持久化回流。组件不再直接调用 `recordCliRun`，`ActionsView` 移除 8 秒轮询。

### 5. 删除 `workbenchStore.qualityGate`

删除 `qualityGate`、`refreshQualityGate`、`clearQualityGate`；`useTauriEvents` 的 `FILE_UPDATED` 改调 `DeliveryOrchestrator.refreshGate()`，让 Tauri 事件与 Actions 按钮走同一个 action。

## Considered Options

- **继续分散在视图/组件**：改动最小，但 gate、fix、CLI 三类状态仍多 owner，事件刷新不可见且无法单测时序。
- **直接使用 Zustand deliveryStore**：接线更少，但业务时序与 store 生命周期耦合，后续拆 `workbenchStore` 时仍需迁移状态。
- **CLI 记录不跨重启**：实现最简，但交付轨迹和修复轮数无法恢复，不符合产品旅程的阶段证据定位。
- **每条 CLI 调用一条记录、gate 单独存**：保留历史但重新拆成两套记录，违背单一 owner 目标。

## 后果

- 正面：验证与派发状态有单一 locality；gate + fix 生命周期跨重启恢复；orchestrator 成为可注入 adapter 的公共测试 seam；`ActionsView` 与 `CliModal` 显著变薄。
- 代价：新增前端 module、db 持久化模型与 Rust `delivery_runs` 表；首次重构需要完整迁移现有 CLI 记录消费方。
- 风险：若 CLI 事件在 Tauri 与 browser fallback 上顺序不同，需要在 orchestrator 统一收口；测试用同步 fake 覆盖该顺序，并在完整质量门回归。
