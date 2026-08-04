# 01 — Connection Store + Automation Alert Migration

**What to build:** Create a new Zustand `connectionStore` that acts as the central event bus for all cross-module signals. Implement the `addEvent()` function with hardcoded urgency rules (automation error/warning → urgent; everything else → quiet). Migrate `automationStore.addLog` to route its alert notifications through `connectionStore.addEvent()` instead of directly calling `chatStore.createThread()`. The automation alert chat-thread creation still happens, but now orchestrated by connectionStore.

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Create `src/stores/connectionStore.ts` with ConnectionEvent type (id, source, level, title, body, timestamp, targetId?, targetView?)
- [ ] Implement `addEvent()` with rule engine: source=automation + level=error/warning → urgent; else → quiet
- [ ] `addEvent()` auto-creates chat thread for urgent automation events (calling chatStore internally)
- [ ] Store tracks `badgeCount` (incremented on urgent events, cleared via `clearBadge()`)
- [ ] Store tracks `events[]` array for the timeline
- [ ] Export `filteredEvents(filter)` helper for the timeline view
- [ ] Refactor `automationStore.addLog`: remove the chatStore import + direct thread creation; instead call `connectionStore.addEvent()`
- [ ] Verify: trigger an automation error → connectionStore has the event → chat thread is auto-created
