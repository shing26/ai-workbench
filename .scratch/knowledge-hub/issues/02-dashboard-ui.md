# 02 — Knowledge Dashboard UI: three-column layout + search + preview
**What to build:** Replace placeholder KnowledgeView with full three-column layout: left sidebar (projects list + tag cloud), center card grid, right Markdown preview panel. Global search bar. AI tag inference when creating notes.
**Blocked by:** 01-store-and-vault.md
**Status:** completed
- [ ] Replace KnowledgeView.tsx with three-column dashboard layout
- [ ] Left sidebar: projects list (click to filter), tag cloud (click to filter), "All" reset
- [ ] Center: responsive card grid (2-3 cols), each card shows title, first 2 lines, tags as colored chips, date
- [ ] Click card → right panel shows full Markdown content (raw render, no MDX)
- [ ] Right panel: scrollable Markdown preview, note metadata header
- [ ] Global search bar at top: real-time filter across title + tags + content
- [ ] Tag inference: extract tech terms, concepts, proper nouns from content as tag suggestions
- [ ] Add note manually: "New Note" button opens inline editor (title, content, project, tags) → saves via write_note
- [ ] Empty state: "No notes yet. Save messages from Chat or create one here."
- [ ] Verify: browse by project → card grid updates → click card → preview shows → search filters → clear
**Blocked by:** 01-store-and-vault.md
