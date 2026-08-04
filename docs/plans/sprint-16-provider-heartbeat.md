# Sprint 16 计划：Provider 周期心跳与状态告警

目标：为 System 视图的 Provider 增加周期心跳与连续失败告警：Rust 后台维护心跳状态并周期性检查，前端展示最近检查时间、延迟、连续失败次数与告警条。

## Sprint 16 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| H1 | Rust 心跳状态 | `ProviderHeartbeat` 记录最近结果与连续失败次数，失败 >=2 次进入 alert；有单测 |
| H2 | 心跳命令与事件 | `run_provider_heartbeat` 返回快照并 emit `provider-heartbeat`；setup 启动 10s 周期后台检查 |
| H3 | 前端心跳展示 | System Provider 卡片显示 heartbeat 状态/延迟/连续失败；顶部告警条列出 alert Provider |
| H4 | 浏览器 fallback | `runProviderHeartbeat` / `listenProviderHeartbeat` 可模拟健康与告警快照 |
| H5 | 自动化验收 | `verify:ui` 新增心跳快照与告警断言；完整验证套件通过 |

## 范围外（进入 Backlog）

- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 消息分叉与版本历史
- 剪贴板/日志跨设备同步

## DoD 检查单

- [x] Rust 单测覆盖连续失败告警与恢复清空
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
