# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop (Tauri 2 shell, web frontend)

## Users

A solo developer-creator (ENTP cognitive style), working late-night in deep-flow sessions. Thinks by building: starts with intuition, refines through iteration, learns by doing. State-driven — output and inspiration fluctuate with energy. Uses AI tools daily (Codex CLI, cloud APIs, local Ollama) but tools are fragmented across terminals, browsers, and chat windows.

## Product Purpose

AI Workbench is a local desktop orchestration layer that unifies every AI capability the user owns into one dark, high-density dashboard. One entry point for chat, coding, learning, automation, monetization, and context. All data stays local. The workbench does not replace AI engines — it routes, schedules, and connects them.

## Positioning

The only AI desktop workbench built for the "万物为我所用" philosophy: the user controls every capability from one surface, on their own machine, with no cloud dependency for data. Neither a chat wrapper nor a code editor — an orchestration hub where modules talk to each other (automation alerts route to chat, chat insights save to knowledge, vibe projects feed monetization). A neighboring product could copy one module; it could not copy the cross-module signal mesh.

## Operating Context

- Primary usage window: midnight to early morning, deep-focus sessions
- Physical environment: laptop (RTX 3050 Ti, ~4GB VRAM), often running multiple AI processes
- Workflow: idea → build → iterate, with bursts of high-intensity coding
- Emotional context: sensitive to friction — stuck points lead to abandonment; smooth progress sustains engagement
- The workbench runs always-on in the background; low memory footprint is critical (Tauri over Electron)

## Capabilities and Constraints

**Six modules:**
- Chat Hub: multi-model routing (Cloud API / Codex / Ollama / Auto), thread management, budget tracking
- Vibe Coding Factory: idea capture → clarify → implement → run → accept, with Codex CLI backend
- Knowledge Hub: bidirectional Obsidian vault integration, three-column browse with tag/project filtering, AI tag inference
- Automation Workbench: natural-language task creation, RSS/API/web monitoring, scheduled execution, alert routing
- Monetization Workbench: downstream for Vibe Coding output, template checklists, manual revenue tracking
- Connection Layer: cross-module event bus, urgency routing, bell notifications, unified timeline, cooling recall, session breadcrumbs

**Constraints:**
- Deep theme mandatory, high information density, keyboard-first with full shortcut coverage
- Authorization model: Read auto, Write/Run one-time confirm, Delete/Send/Spend explicit approval
- Secrets stored in Windows Credential Manager via Rust keyring — never plaintext on disk
- Local model limit: 3-4B via Ollama (GPU constraint)
- Hybrid routing: local models for privacy/light tasks, cloud API for complex reasoning, auto-fallback on budget exceeded
- No external dependencies for data: everything defaults to local

**Undecided:** SQLite persistence for chat history (deferred post-MVP)

## Brand Commitments

- Product name: AI Workbench
- Visual identity constraint: deep theme (dark background),精致丰富 + 机能实用 (refined richness + functional utility)
- User profile explicitly rejects pure-decorative design and "好看但没用"
- No logo or wordmark established
- Voice: efficient, high-information-density, Chinese-primary with English technical terms

## Evidence on Hand

- User profile: [docs/user-profile.md](docs/user-profile.md)
- Design document: [docs/ai-workbench-design.md](docs/ai-workbench-design.md)
- Domain context: [CONTEXT.md](CONTEXT.md)
- Five module specs under .scratch/: ai-workbench-mvp, automation-workbench, knowledge-hub, connection-layer, monetization-workbench
- 20 completed implementation tickets across all modules
- Working build: npm run build passes, frontend verified via Vite dev server
- Absent: real user analytics, load-testing data, accessibility audit

## Product Principles

1. **Local-first, cloud-optional.** Data never leaves the machine by default. Cloud APIs are tools the user invokes, not dependencies.
2. **Orchestrate, don't recreate.** The workbench routes to existing engines (Codex, Ollama, OpenAI) — it never reinvents AI inference.
3. **Friction kills flow.** Common actions are one keystroke away (Ctrl+K, Enter to send). Stuck points get decomposed into minimal next steps.
4. **Modules talk to each other.** The connection layer is the nervous system. Automation alerts become chat threads. Chat insights become knowledge notes. Vibe projects become monetization cards.
5. **Refined, not decorative.** Every visual element earns its place through function. Beauty comes from precision, density, and responsiveness — never from chrome.

## Accessibility & Inclusion

- Desktop-only (Windows), no mobile or web deployment
- Keyboard-first interaction model with full shortcut discoverability via Command Palette
- Dark theme mandatory (user preference + late-night context)
