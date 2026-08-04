# 04 — Alert Integration: chat threads + notifications
**What to build:** Wire automation alerts to the Chat Center — threshold breaches and task errors auto-create chat threads with context; routine summaries quietly archive to task history.
**Blocked by:** 03-task-execution.md (needs real execution results to route) + 02-dashboard-ui.md
**Status:** completed
- [ ] Define alert severity levels: info (summary), warning (threshold), error (failure)
- [ ] On error/warning: call chatStore.createThread() with auto-title "Automation: {taskName} — {alertType}"
- [ ] Pre-populate thread with task name, error/summary details, timestamp
- [ ] On info: append summary to task history tab (no thread creation)
- [ ] TopBar notification badge: count of unread alert threads, click to jump to Chat Center
- [ ] Task card: visual indicator for pending alerts
- [ ] Verify: create price alert task → price crosses threshold → new chat thread appears → notification badge shows
**Blocked by:** 03-task-execution.md + 02-dashboard-ui.md
