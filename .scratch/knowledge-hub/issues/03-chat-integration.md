# 03 — Chat Integration: save button + auto-recommend
**What to build:** Add "Save to Knowledge" button to chat messages. AI auto-recommends insightful messages with a subtle indicator. Clicking save calls write_note with AI-inferred title+tags.
**Blocked by:** 01-store-and-vault.md
**Status:** completed
- [ ] Add "Save" icon button (Bookmark or BookOpen) to each chat message bubble, shown on hover
- [ ] On click: infer title from first sentence, infer tags via heuristic, call write_note via invoke
- [ ] Show brief toast/confirmation: "Saved to Obsidian"
- [ ] Auto-recommend: messages with 200+ chars AND code blocks OR bullet lists get a subtle star/save indicator
- [ ] Dashboard: when note is created via chat, knowledgeStore reflects it immediately (shared store)
- [ ] Handle edge case: vault not configured → show "Configure Vault" tooltip on save button
- [ ] Verify: send a message with code → save button appears → click → file appears in Vault → note in Knowledge Hub
**Blocked by:** 01-store-and-vault.md
