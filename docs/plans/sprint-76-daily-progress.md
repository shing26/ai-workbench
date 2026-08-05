# Sprint 76 计划：Actions 今日进度总览

目标：把 Actions 的今日 Focus、Habits、Schedule 三类数据汇成一张“一眼可读”的进度卡，显示完成数、总进度条与下一个未完成日程，消除长列表焦虑，不新增 Dock 视图。

## Sprint 76 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 进度计算 | ActionsView 聚合 today focus / habit done / event done / next event / overall progress |
| A2 | Today progress 卡片 | 12 列宽卡片置顶：Focus / Habits / Schedule 三个统计 + 总进度条 + Next 日程 |
| A3 | 数据属性 | `data-daily-progress` / `data-daily-focus` / `data-daily-habits` / `data-daily-schedule` / `data-daily-progress-bar` / `data-daily-next-event` |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `dailyProgress` lane：seed 态下 Focus 0/3、Habits 0/3、Schedule 0/2、Next 含“每日复盘” |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] Actions Today progress 卡片聚合三类进度并保持 5 大主视图不变。
- [x] `verify:ui` / `verify:preview` 的 `dailyProgress` 为 true。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.76.0-alpha`。

## 范围外（Backlog）

- 不做历史趋势与周报导出；今日进度只读展示，不新增落库字段。
- 不自动生成复盘文案；AI 生成式复盘进入下一阶段候选池。
