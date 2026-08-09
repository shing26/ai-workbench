# Sprint 3 计划：Actions 深度 + Knowledge Markdown

目标：在 5 大主视图范围内继续深度开发，优先补足日常生活的 Actions 与 Knowledge 两个视图，保持 SQLite local-first 与 150ms 动效约束，并把 UI 动态效果继续纳入开发生命周期验收。

## Sprint 3 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| A1 | SQLite 迁移：habits、habit_logs、schedule_events | 启动自动建表，空表自动写入示例习惯与日程 |
| A2 | Rust CRUD：习惯与日程命令 | `list_habits`、`create_habit`、`toggle_habit`、`list_schedule_events`、`create_schedule_event`、`toggle_event_done` 可用且有单测 |
| A3 | Actions 视图：习惯打卡 | 习惯卡片显示名称、本周目标、连续天数；点击打卡后状态刷新并持久化 |
| A4 | Actions 视图：日程时间线 | 时间线按时间排序，可快速新建与勾选完成 |
| A5 | Knowledge Markdown 预览 | 选中 thought 后右侧以 Markdown 渲染，代码块/标题/列表可读 |
| A6 | UI 动态效果延续 | 参考 octopus-kaogong-workbench 的动效语言，习惯/日程卡片带 pointer tilt、check-pop、进度条 scaleX，全部 <=150ms 且尊重 reduced-motion |
| A7 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib` 全绿 |

## 范围外（进入 Backlog）

- RAG 向量索引真实执行
- Webhook、云同步、移动端
- AI Studio 真流式输出
- 剪贴板/日志真实监听

## DoD 检查单

- [ ] 习惯与日程数据刷新后仍存在。
- [ ] Actions 四个区块在同一视图中无重叠、无横向溢出。
- [ ] Knowledge Markdown 预览不注入 HTML，长内容可滚动。
- [ ] 动效仍遵守 150ms 与 reduced-motion。
- [ ] PR 已合并到 develop，复盘已更新。
