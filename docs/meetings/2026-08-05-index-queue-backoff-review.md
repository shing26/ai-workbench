# 2026-08-05 索引队列指数退避评审

## 结论

- `vault_index_retry_delay_ms(attempts)` 以 500ms 为基数、2 倍增长、4000ms 封顶；worker 按 `retry.attempts` sleep，替代固定 800ms。
- `VaultIndexQueueEntry` 新增 `retry_delay_ms`，active / queued 快照均携带；Knowledge 队列行显示 `retry N · NNNms` 并暴露 `retry-delay` 数据属性。
- TS fallback 与 Rust 共用同一退避公式；`verify:ui` / `verify:preview` 的 `indexQueueRetry` / `indexQueueBackoff` 均为 true，`cargo test --lib` 82/82。

## 风险与后续

- 当前退避无 jitter，并发失败时仍可能形成周期性的峰；如需更平滑可后续加入随机抖动。
- 最多 3 次尝试上限保持不变；若需要更长容忍窗口，可扩展 `VAULT_INDEX_MAX_ATTEMPTS` 并让退避继续按封顶值增长。
