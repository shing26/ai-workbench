# Automation Workbench Spec
**Status:** ready-for-agent
## Problem Statement
用户需要定期关注多个信息源（RSS、网页、API 数据），但手工检查耗时且容易遗漏。需要一个 AI 驱动的自动化执行台，用自然语言描述就能创建定时任务，运行时能看实时日志或静默后台运行，产出自动对接对话中枢。
## Solution
在 AI Workbench 中新增自动化执行台模块，支持自然语言创建定时监控任务（RSS/网页/API 轮询），仪表盘以卡片网格展示任务状态，点击展开实时日志时间线。告警级产出自动创建对话线程并推送通知，普通产出静默归档。
## User Stories
1. As a user, I want to type "每天早上8点检查 TechCrunch RSS 的新文章" and have a task created, so that I can set up monitoring without writing code.
2. As a user, I want to see all my automation tasks as cards showing name, status, last run, and next trigger time, so that I can scan the dashboard at a glance.
3. As a user, I want to click a task card to see its real-time execution log, so that I can follow what the agent is doing.
4. As a user, I want to toggle a task between "silent" and "live log" mode, so that noisy tasks stay out of sight.
5. As a user, I want to set up API polling (e.g., BTC price every 5 minutes) with threshold alerts, so that I get notified when conditions are met.
6. As a user, I want urgent alerts (threshold triggered, task error) to auto-create a chat thread and push a notification, so that I can investigate immediately.
7. As a user, I want routine summaries (daily RSS digest) to be quietly archived in a timeline, so that they don't clutter notifications.
8. As a user, I want to filter tasks by status (active/history/templates) via top tabs in the dashboard.
9. As a user, I want to pause, resume, or delete a task from its card, so that I have full lifecycle control.
## Implementation Decisions
- **Task creation**: Natural language input box → AI parses intent → generates task config (source, schedule, alert rules)
- **Scheduling**: Use `setInterval` / `setTimeout` with persisted state in Zustand; no external cron daemon needed for MVP
- **Execution**: Tauri Rust command `execute_automation_task` that fetches URL/RSS/API, returns result; frontend handles scheduling loop
- **Task state**: Stored in Zustand `automationStore` — tasks[], activeTab, selectedTaskId, logs[]
- **Alert routing**: Errors and threshold breaches trigger `chatStore.createThread()` with auto-generated title + content; routine summaries go to task history
- **Card grid**: Responsive CSS grid, 2-3 columns wide, each card shows icon/name/status-badge/schedule
- **Log timeline**: Scrollable panel alongside or below card, shows timestamped entries with color-coded severity
- **Tab navigation**: "Active" = running/paused tasks; "History" = completed task runs; "Templates" = preset task configs (RSS monitor, Price alert, Web scraper, etc.)
- **Visual**: Consistent with dark theme; task cards use color-coded status dots (green=ok, yellow=paused, red=failed, blue=running)
## Testing Decisions
- UI verified via manual visual verification in dev server (Vite HMR)
- Task parsing logic tested via console logging during development
- What makes a good test: create a task via NL input → verify it appears in active tab → verify it runs on schedule → verify alert creates chat thread
## Out of Scope
- Autonomous write/run/delete actions (MVP read-only)
- External cron/background process (uses browser timers, pauses when app is backgrounded)
- Complex NL parsing with LLM (MVP uses keyword-based intent detection)
- Multi-user or remote task management
## Further Notes
- Tasks survive page refresh via Zustand + localStorage persistence (add later if needed)
- NL parsing MVP: detect keywords like "RSS", "check", "price", "every", "hour", "day" to infer task type and schedule
- Template system can seed the prompt input for faster creation
