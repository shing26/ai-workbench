# 05 — S8-1: Task project binding + DoD two-way sync

**What to build:** Task 增加 `project_id` 绑定，Actions 勾选完成时 Projects 卡片 DoD 计数实时削减。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `tasks` 表新增 `project_id TEXT`（迁移幂等）；`Task` 类型 + `create_task` 支持 project_id
- [ ] Actions 任务支持 `#project_id` 标签自动绑定（解析 title 中 `#proj-xxx` 或显式关联）
- [ ] `data-task-project` 展示绑定项目；完成/取消完成时更新计数
- [ ] Projects 卡片新增 `🎯 待攻坚 DoD` 计数（该 project 下 status != done 的任务数），实时派生
- [ ] verify lane：Actions 建带 project 任务 → Projects 卡片 DoD +1 → 完成 → -1（双向闭环）

**Definition of Done:** DoD 双向状态同步，无需刷新。AC-3.2。
