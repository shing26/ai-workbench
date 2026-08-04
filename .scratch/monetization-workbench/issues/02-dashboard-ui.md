# 02 — MonetizationView Dashboard

**What to build:** Replace the placeholder MonetizationView with a full dashboard. Summary bar at top showing this month and all-time revenue. Project card grid (2-3 cols), each card showing name, template badge, status dot, and revenue. Click card → expand detail panel with: template checklist (checkboxes), revenue log (amount + source + timestamp), generated code preview.

**Blocked by:** 01-store-and-bridge.md

**Status:** completed

- [ ] Replace MonetizationView placeholder with full dashboard layout
- [ ] Summary bar: "This month: $X" / "All-time: $Y" in green text, fixed at top
- [ ] Project card grid (2-3 cols): each card shows name, template name badge, status dot (yellow=pending, green=active, gray=archived), total revenue for that project
- [ ] Click card → expands inline detail panel below the grid (or side panel)
- [ ] Detail panel: template selector dropdown (if no template selected, shows "Select template...")
- [ ] Detail panel: checklist with checkboxes, toggle on click
- [ ] Detail panel: revenue input (amount + source) + "Add" button, log entries listed below
- [ ] Detail panel: generated code shown in syntax-highlighted pre block, collapsible
- [ ] Detail panel: archive button for active projects
- [ ] Edit project name inline (click to edit)
- [ ] Empty state: "No monetization projects yet. Accept a Vibe Coding project to get started."
- [ ] Verify: see auto-created project card → select template → check off steps → add revenue → see totals update
