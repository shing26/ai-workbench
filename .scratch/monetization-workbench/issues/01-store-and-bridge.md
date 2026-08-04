# 01 — Monetization Store + Vibe Bridge

**What to build:** Create `monetizationStore` with project CRUD, three static templates with checklist steps, manual revenue logging, and monthly/all-time revenue summary. Wire `vibeStore.accept()` to auto-create a monetization project card when a Vibe Coding project passes acceptance.

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Create `src/stores/monetizationStore.ts` with MonetizationProject type (id, name, template, templateSteps[], revenueLog[], generatedCode, status, createdAt)
- [ ] Three static templates: Landing Page (4 steps), Chrome Extension (4 steps), Paid Content (4 steps). Each step: { label, done }
- [ ] `addProject(name, generatedCode)` — creates card with status "pending", no template selected
- [ ] `selectTemplate(id, templateName)` — populates templateSteps from the selected template
- [ ] `toggleStep(id, stepIndex)` — toggles a step's done flag
- [ ] `addRevenue(id, amount, source)` — appends revenue log entry
- [ ] `updateProject(id, partial)` — edit name/template
- [ ] `archiveProject(id)` — set status to "archived"
- [ ] Getters: `monthlyRevenue()` and `allTimeRevenue()` computed from all projects' revenue logs
- [ ] Wire `vibeStore.accept()`: after setting phase to "accepted", call `monetizationStore.addProject(idea, generatedCode)`
- [ ] Verify: accept a vibe project → monetizationStore has a new project card with the idea name and generated code
