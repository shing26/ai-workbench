# Sprint 122 计划：Actions 习惯删除与周目标编辑

目标：在 Actions Habits 卡片为每个习惯提供周目标编辑与删除入口，支持内联数字输入、二次确认删除，删除时级联清理 `habit_logs`，保存后同步刷新今日进度、热力条与周目标进度，并持久化到 Tauri SQLite 与浏览器 fallback。

## Sprint 122 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 后端更新命令 | Rust 新增 `update_habit_week_goal(id, week_goal)` 与 `delete_habit(id)`：周目标钳制到 1~31，删除级联清理 `habit_logs`；Tauri 命令注册 |
| R2 | 浏览器同构 | `db.ts` 新增 `updateHabitWeekGoal` / `deleteHabit`，localStorage fallback 同步更新 `habits` / `habitLogs` 并做同样钳制 |
| R3 | 习惯行编辑区 | Habits 卡片每行新增 `data-habit-week-edit` / `data-habit-week-input` / `data-habit-week-save` / `data-habit-delete` / `data-habit-delete-confirm` / `data-habit-edit-result` |
| R4 | 联动刷新 | 周目标保存后行内周进度、今日进度汇总与热力条同步；删除后习惯行消失且今日进度汇总减少 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `habitManage` / `habitManagePersisted` / `habitManageRestored`：编辑周目标 → reload 持久化 → 恢复；删除测试习惯后确认消失 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Rust 与浏览器同构支持周目标更新与习惯删除。
- [x] Habits 卡片提供周目标编辑与二次确认删除控件。
- [x] 周目标与删除结果 reload 后保持。
- [x] `habitManage` 双端覆盖编辑、持久化与删除恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
