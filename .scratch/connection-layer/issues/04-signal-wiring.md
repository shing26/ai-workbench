# 04 — Cross-Module Signal Wiring

**What to build:** Wire the remaining modules (Chat, Knowledge, Vibe Coding) to emit quiet signals through `connectionStore.addEvent()`. When a user saves a chat message to knowledge, a "Saved to Obsidian" quiet event is logged. When a user creates a new note in Knowledge Hub, a "Note created" quiet event is logged. When Vibe Coding reaches the "done" phase, a "Implementation complete" quiet event is logged. These are addition-only — no existing behavior changes.

**Blocked by:** 01-connection-store.md

**Status:** completed

- [ ] ChatView: after successful `writeNoteToVault`, call `connectionStore.addEvent({ source: "chat", level: "quiet", title: "Saved to Knowledge", ... })`
- [ ] KnowledgeView: after successful `writeNoteToVault` in handleManualSave, call `connectionStore.addEvent({ source: "knowledge", level: "quiet", title: "Note created", ... })`
- [ ] VibeCodingView: when phase transitions to "done", call `connectionStore.addEvent({ source: "vibe", level: "quiet", title: "Implementation complete", ... })`
- [ ] Each signal includes `targetView` and `targetId` for navigation (chat thread ID, note ID)
- [ ] Verify: save a note from chat → navigate to Connections → see quiet event with "Saved to Knowledge" title
