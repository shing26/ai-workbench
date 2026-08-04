# 03 — ConnectionsView Full Timeline

**What to build:** Replace the placeholder ConnectionsView with a full timeline view. The timeline displays all connectionStore events grouped by date (Today / Yesterday / Older). A filter bar at the top has two dropdowns: urgency (All / Urgent / Quiet) and source module (All / Chat / Automation / Knowledge / Vibe / System). A search input filters events by title and body text. Each event row shows urgency color dot, source module icon badge, timestamp, title, and body excerpt. Clicking a row navigates to the relevant view and target context.

**Blocked by:** 01-connection-store.md

**Status:** completed

- [ ] Replace ConnectionsView placeholder with full timeline layout
- [ ] Header: Link2 icon + "连接组织" title
- [ ] Filter bar: urgency dropdown (All/Urgent/Quiet) + source dropdown (All/模块列表) + search input
- [ ] Timeline list: events grouped by date (Today / Yesterday / MM-DD)
- [ ] Event row: urgency color dot (red/gray) + source icon badge + HH:MM timestamp + title + first line of body
- [ ] Click event row → navigate to target view and target context (same navigation logic as bell dropdown)
- [ ] Empty state: "暂无事件 — 各模块的信号将汇聚于此"
- [ ] Search filters events in real-time by title and body text
- [ ] Verify: navigate to Connections → see all events grouped by date → filter by urgency → click event → navigates to source view
