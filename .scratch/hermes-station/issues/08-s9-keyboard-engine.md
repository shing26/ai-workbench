# 08 — S9-1: Linear full-keyboard engine (j/k/x/p/a)

**What to build:** Actions 视图 Linear 级全键盘快捷键引擎：j/k 游走、n 新建、x 完成、p 置顶、a AI 拆解。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] 扩展现有键盘系统：j/k 上下光标游走任务列表（`data-task-cursor` 高亮），响应 <5ms
- [ ] n 聚焦新建输入（已有）、x 标记完成（toggle status）、p 置顶到 Today's Focus（setTaskToday true）
- [ ] a 呼出 AI 3 步拆解弹窗（`data-ai-breakdown`，联动 Sprint 9 S9-2）
- [ ] 快捷键仅 Actions 视图生效（activeView 判断），输入框内不拦截
- [ ] verify lane：j/k 游走切换、x 完成、p 置顶、a 呼出

**Definition of Done:** 全键盘流顺畅，响应 <5ms。AC-3.1。
