# 01 — P0-1: Task delete & rename (双端同构)

**What to build:** 为 Task 增加删除与改名能力，Rust 与浏览器 fallback 同构。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Rust 新增 `delete_task(id)` Tauri 命令（缺失 id 返回 `QueryReturnedNoRows`）
- [ ] Rust 新增 `update_task_title(id, title)` Tauri 命令
- [ ] `src/lib/db.ts` 新增同构 `deleteTask` / `updateTaskTitle`，localStorage fallback 同步写回
- [ ] `workbenchStore` 新增 action，保存后刷新 `tasks`
- [ ] Actions 视图任务行补删除（二次确认）与改名（内联编辑）
- [ ] `verify:ui` / `verify:preview` 新增 lane：创建 → 改名 → 删除 → reload 持久化 → 取消不删
- [ ] `cargo test --lib` 增补对应单测

**Definition of Done:** 任务可删除/改名，reload 后保持结果，双端行为一致。
