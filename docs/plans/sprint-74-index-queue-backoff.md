# Sprint 74 计划：索引队列指数退避

目标：把索引队列固定 800ms 重试间隔升级为按 `attempts` 指数退避，避免连续失败时对磁盘与 Provider 造成固定频率热循环；同时在 Knowledge 队列行展示“重试次数 + 下次等待毫秒”，让退避策略可见、可验证。

## Sprint 74 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 退避策略 | 新增 `vault_index_retry_delay_ms(attempts)`：500ms 基数、2 倍增长、4000ms 封顶；worker 按 `retry.attempts` 计算并 sleep |
| A2 | 队列快照携带退避 | `VaultIndexQueueEntry` 新增 `retry_delay_ms`，active / queued 均按 attempts 计算 |
| A3 | TS fallback | `indexRetryDelayMs` 与 Rust 同一公式，`retryDelayMs` 进入 fallback 队列状态，重试调度按退避等待 |
| A4 | Knowledge UI | active / queued 行在重试时显示 `retry N · NNNms`，并暴露 `retry-delay` 数据属性 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `indexQueueBackoff` lane：attempts 1/2 可见且 retryDelayMs 递增（500 → 1000） |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] TS fallback 与 Knowledge UI 覆盖退避等待与展示。
- [x] `verify:ui` / `verify:preview` 的 `indexQueueBackoff` 为 true，`indexQueueRetry` 仍为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.74.0-alpha`。

## 范围外（Backlog）

- 不新增按 path / Provider 分组的自定义退避参数，也不改变最多 3 次尝试上限。
- 退避只影响调度等待，不引入指数退避的随机抖动（jitter）。
