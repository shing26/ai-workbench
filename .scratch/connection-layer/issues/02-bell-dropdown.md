# 02 — TopBar Bell Dropdown

**What to build:** Replace the TopBar's existing `automationStore.alertCount` badge with a new bell icon that reads `connectionStore.badgeCount`. Clicking the bell opens a glass-morphism dropdown popover (same style as CommandPalette) showing the last 5 urgent events. Each event row shows source icon, title, and relative timestamp. Clicking an event navigates to the relevant view and target. "View all" link at the bottom opens ConnectionsView. Opening the dropdown calls `clearBadge()` to reset the count.

**Blocked by:** 01-connection-store.md

**Status:** completed

- [ ] Replace `automationStore.alertCount` import in TopBar with `connectionStore.badgeCount`
- [ ] Replace the existing alertCount badge button with a Bell icon button showing badge count overlay
- [ ] Bell dropdown popover: AnimatePresence overlay with glass-morphism panel, positioned below the bell
- [ ] Dropdown shows last 5 urgent events from connectionStore (source icon + title + relative time)
- [ ] Click event row → `appStore.setActiveView(event.targetView)` + set target context (activeThread, selectedTaskId, etc.)
- [ ] "View all" link at bottom → navigates to ConnectionsView
- [ ] Opening dropdown calls `connectionStore.clearBadge()`; closing via Esc or click-outside dismisses
- [ ] Remove the now-dead `automationStore.alertCount` subscription from TopBar
- [ ] Verify: have urgent events in store → bell shows badge number → click bell → dropdown shows events → click event → navigates correctly
