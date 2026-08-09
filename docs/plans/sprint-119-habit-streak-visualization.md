# Sprint 119 计划：习惯连续天数与 14 天热力条

目标：把 Habits 卡片的连续天数从静态种子升级为真实打卡日志驱动：Rust 与浏览器 fallback 统一从 `habit_logs` 计算当前连续天数，每个习惯展示最近 14 天打卡热力条与本周目标进度。

## Sprint 119 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 日志驱动连续天数 | Rust `list_habits` / 浏览器 `listHabits` 根据 `habit_logs` 计算 `currentStreak`（今天未打卡则从昨天向前计数，今天已打卡则包含今天），并返回最近 14 天 `recentLogs` |
| R2 | 打卡落库 | `toggle_habit` 写入 / 删除当天 `habit_logs`，Tauri 与 localStorage 两侧持久化，重新加载后状态与连续天数一致 |
| R3 | 14 天热力条 | Habits 卡片每个习惯新增 `data-habit-recent-days`：14 个 `data-habit-day` 单元格带 `data-habit-day-checked`，打卡日按习惯色高亮 |
| R4 | 周目标进度 | 每个习惯展示 `data-habit-week`（最近 7 天打卡数 / 周目标），与热力条、连续天数联动 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 扩展 habit lane：断言种子 3/2/5 连续天数、14 天热力条、打卡后连续天数 +1、今天单元格点亮与 reload 持久化 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Habits 连续天数由真实打卡日志计算，不再依赖静态种子。
- [x] 每个习惯展示最近 14 天热力条与本周目标进度。
- [x] 打卡后连续天数、今日单元格与周进度联动，reload 后保持。
- [x] `habitStreak` 断言双端覆盖种子、打卡、持久化。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
