# 01 — Knowledge Store + Vault Config + Rust writer
**What to build:** Zustand stores for knowledge (notes, projects, tags) and settings (vault path). Settings modal for configuring the Obsidian Vault path. Rust `write_note` Tauri command that writes a Markdown file to disk.
**Blocked by:** None — can start immediately.
**Status:** completed
- [ ] Create `settingsStore.ts`: vaultPath, setVaultPath, isConfigured
- [ ] Create `knowledgeStore.ts`: Note type (id, title, content, project, tags[], createdAt), notes[], projects[], tags[], addNote, removeNote
- [ ] Rust: add `write_note(path: String, content: String) -> Result<String, String>` — creates file + parent dirs if needed
- [ ] Register `write_note` in invoke_handler
- [ ] Settings modal component: file-path input, "Browse" button (uses Tauri dialog or manual input), save button
- [ ] On submit: validate path exists, store in settingsStore
- [ ] If vaultPath is empty, knowledge features show "Configure Vault path" CTA
- [ ] Verify: set vault path → store persists → write_note creates file at path
**Blocked by:** None — can start immediately.
