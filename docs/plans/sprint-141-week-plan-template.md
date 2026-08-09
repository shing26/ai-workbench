# Sprint 141 计划：Actions 周计划模板

目标：把“每周计划”从零散输入收拢成一键动作：内置周计划模板，预览本周 7 天的 Focus 与 Schedule 安排，点击 Apply 后按日期写入任务和日程。

## Sprint 141 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | Schedule 日期字段 | SQLite `schedule_events` 新增 `date TEXT NOT NULL DEFAULT ''`，新库 SCHEMA 直接建列，旧库 `migrate_schedule_event_date` 幂等补列并加入 `init_connection` 迁移链；Rust `ScheduleEvent` / list / create 全程携带 date，列表按 `date, start_time` 排序 |
| L2 | Tauri 命令 | `create_schedule_event` 新增 `date` 参数并写入新列，返回的 `ScheduleEvent` 含 date |
| L3 | TS 同构 | `db.ts` 的 `ScheduleEvent` 新增 `date`；`createScheduleEvent(title, startTime, tag, date)` 的 Tauri 与浏览器 fallback 同构持久化；store 的 `addScheduleEvent` 携带 date |
| L4 | 模板模型 | 新增 `src/lib/weekPlanTemplates.ts`：`WeekPlanTemplate`（id / name / 7 天 focus + events）、默认模板、`loadWeekPlanTemplates`（localStorage 持久化）；store 新增 `applyWeekPlan`，按周一到周日批量创建 Focus 任务（含 dueDate / isToday）与 Schedule 事件（含 date） |
| L5 | Actions UI | ActionsView 新增 Week Plan 卡片：`data-week-plan-template` 模板选择、`data-week-plan-preview` 7 日预览、`data-week-plan-apply` 一键写入、`data-week-plan-result` 汇总；Schedule Timeline 显示日期并支持手动建事件时选择日期 |
| L6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `weekPlanTemplate` / `weekPlanPersisted` lane：断言 7 日预览、Apply 后 Focus / Schedule 数量与日期落库、重载持久化；Rust 单测覆盖迁移、创建携带 date 与排序 |
| L7 | 文档更新 | BACKLOG 移除该项并记入已完成，RETRO / ARCHITECTURE / DATABASE 同步 |

## DoD 检查单

- [x] 内置周计划模板可一键写入本周 Focus 与 Schedule，任务带 dueDate、事件带 date。
- [x] Schedule Timeline 展示日期，手动新建事件可选择日期。
- [x] `verify:ui` / `verify:preview` 的 `weekPlanTemplate` / `weekPlanPersisted` lane 双端通过。
- [x] `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib` 全绿。
- [x] PR 合并到 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
- 不做模板编辑器与多模板自定义 UI；模板列表先由内置默认模板 + localStorage 承载。
