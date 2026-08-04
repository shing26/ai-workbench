# 02 — Dashboard UI: card grid + tabs + AutomationView
**What to build:** Replace the placeholder AutomationView with the full dashboard: task card grid, top tabs (Active/History/Templates), NL input bar at top, card detail panel with real-time logs.
**Blocked by:** 01-store-and-parser.md
**Status:** completed
- [ ] Replace AutomationView.tsx with full dashboard layout
- [ ] Top bar: "New automation..." input + create button, calls parser → store.addTask
- [ ] Tab bar: Active | History | Templates with active highlight
- [ ] Card grid (2-3 cols responsive): each card shows name, status dot (green/yellow/red/blue), next-run time, source type icon
- [ ] Click card → expands detail panel with log timeline (scrollable, timestamped, color-coded)
- [ ] Card actions: Pause/Resume/Delete buttons
- [ ] Active tab: running + paused tasks. History tab: completed/error runs. Templates tab: preset configs
- [ ] Empty state: "No automations yet — type above to create one"
- [ ] Verify: create task via input → appears in card grid → click to see empty log → pause → status changes
**Blocked by:** 01-store-and-parser.md
