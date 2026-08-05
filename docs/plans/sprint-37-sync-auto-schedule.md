# Sprint 37 计划：同步快照定时自动同步

目标：把 Sync snapshot 从“手动 Push / Pull”升级为“配置后定时自动同步”：启用时立即执行一次双向同步（pull 合并 → push），随后按可配置间隔自动续跑；配置持久化到 localStorage，Token 仅保存在当前会话输入。

## Sprint 37 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 配置存储 | `getSyncAutoConfig` / `setSyncAutoConfig` 读写 `{ enabled, intervalMs, remoteUrl }`，Token 不落盘 |
| A2 | System UI | Sync card 新增 Auto sync 开关与 10s / 30s / 60s / 5m 间隔选择；启用时立即同步并回显状态 |
| A3 | 定时任务 | 启用后按间隔执行 pull → push 双向同步，刷新剪贴板与 last sync；卸载或关闭时清理 |
| A4 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Auto sync 开关、立即同步结果与关闭状态 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] 浏览器 fallback 下 Auto sync 启用/关闭、立即同步结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.37.0-alpha`。

## 范围外（Backlog）

- 冲突 UI 与三方合并策略可视化。
- Vault 索引并发数可配置。
- watch 状态 ignore 列表持久化。
