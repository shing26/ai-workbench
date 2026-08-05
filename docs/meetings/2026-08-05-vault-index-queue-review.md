# 2026-08-05 Vault Index 串行任务队列评审

## 结论

- `VaultIndexState` 升级为 `active + VecDeque 队列 + cancelled 集合`，`claim_next` / `finish_active` 保证同一时间只有一个 worker。
- `start_vault_index` 先入队并发出 `queued` / `running` 进度，任务结束后自动启动下一个；新增 `get_vault_index_queue_status` 与 `vault-index-queue` 事件。
- `cancel_vault_index` 对排队任务直接出队并发出 cancelled 进度，随后继续调度。
- TS fallback 镜像同一队列语义，Knowledge 新增 active + queued 队列条，排队任务也可取消。
- 验证覆盖：`cargo test --lib` 66/66，fmt、clippy、build 全绿；两条 lane 的 `indexQueue.sawQueue` / `drained` 均为 true。

## 风险与后续

- worker 在扫描期间持有数据库连接锁，后续任务会阻塞到前一个完成；队列层已保证不会并发启动第二个 worker。
- 排队任务取消时进度事件携带原路径，UI 与后端状态保持一致。
- 后续可做队列持久化、watch 触发任务的优先级以及任务重启恢复。
