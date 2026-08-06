# Sprint 116 计划：Focus 周视图与完成归档

目标：把 Actions 的 “Today Focus” 从单日 3 件事升级为可规划的一周视图：7 天条带展示每日任务数与完成状态，点击某天查看当日焦点；任务完成时记录 `completedAt`，提供本周完成归档与一键恢复。

## Sprint 116 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 数据模型 | `tasks` 表新增 `completed_at`（旧库幂等迁移）；Rust `Task` / 浏览器 `Task` 同构新增 `completedAt: number \| null` |
| R2 | Rust 命令 | 新增 `set_task_due_date(id, due_date)` 与 `update_task_status` 完成时写 `completed_at`；新库 SCHEMA、旧库迁移、单测覆盖 |
| R3 | 浏览器同构 | `setTaskDueDate` / `updateTaskStatus` 完成时写 `completedAt`，localStorage 与 Rust 字段一致，不新增 key |
| R4 | Actions UI | Today Focus 卡片新增 7 天条带 `data-focus-week-day`（含每日计数/完成态）与周进度；新增完成归档 `data-focus-archive`（含恢复按钮），点击天切换当日焦点 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `focusWeekArchive` lane：创建任务、指派明天、标记完成、归档可见、恢复、切换回今天、reload 后状态保持 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持 `completedAt` / `dueDate`，旧库迁移幂等。
- [x] Actions Today Focus 提供 7 天条带、周进度与完成归档。
- [x] `focusWeekArchive` lane 双端覆盖指派、完成、归档、恢复与持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
