# AI Workbench — Visual Redesign Handoff

**Date:** 2026-08-01
**Status:** Design system applied, all 6 views rewritten, TypeScript zero errors, dev server running

---

## What We Built

Complete visual redesign of the AI Workbench (Tauri 2 + React 19 + TypeScript desktop app) across 6 views. The redesign was driven by a 20-question grilling interview covering every design axis.

### Color Palette
| Token | Value | Role |
|---|---|---|
| `--color-bg-primary` | `#121214` | Deepest background (main content, sidebar) |
| `--color-bg-secondary` | `#1A1A1E` | Cards, sidebar bg |
| `--color-bg-tertiary` | `#242429` | Floating layers, input backgrounds |
| `--color-surface` | `#161618` | Mid-panel background |
| `--color-surface-hover` | `#242429` | Hover state |
| `--color-border` | `#2D2D35` | Panel borders |
| `--color-accent` | `#10B981` | Emerald green |
| `--color-accent-muted` | `rgba(16,185,129,0.12)` | Subtle accent background |

### Layout Architecture
- **Sidebar:** 60px icon nav (Sparkles logo with notification pulse dot, hover expands to 180px with labels, GSAP spring)
- **Mid panel:** 260-320px per-view navigation/filter column
- **Right panel:** Flex-1 content area with local top bar (breadcrumbs)
- **No global TopBar** — removed; notification bell merged into sidebar logo

### Views (all rewritten)
| View | Mid Panel | Right Panel |
|---|---|---|
| Chat | Model cards + thread list + budget bar (gradient, 75% threshold) | Breadcrumbs + message bubbles (16px radius, emerald tint) + big-card input |
| Vibe Coding | 5-phase process timeline (pulse dots + connector lines) | Idea input / clarification / code preview (phase-conditional) |
| Knowledge | Search + folder tree + inline note titles | Markdown preview + tags + date |
| Automation | Task list grouped by type with status indicators | Config panel (pause/resume/delete, schedule, alert rules) |
| Monetization | Project list (name + revenue + status) | Revenue dashboard (3 metric cards + idea launchpad) |
| Connections | Source/level filters | Event timeline with navigation jump |

---

## Key Files Modified

- `src/index.css` — Complete CSS token rewrite (surfaces, text, accent, fonts, easing, keyframes)
- `src/components/Sidebar.tsx` — Logo + notification integration, GSAP hover expand, 60px width
- `src/components/ViewRouter.tsx` — 300ms directional slide transition
- `src/components/CommandPalette.tsx` — Glass panel with keyboard hint footer
- `src/components/SettingsModal.tsx` — Card-section layout, hover rotate close
- `src/views/ChatView.tsx` — Full three-column rewrite: model cards, thread list, message bubbles, big-card input, terminal code blocks, thinking indicator
- `src/views/VibeCodingView.tsx` — Two-column: process timeline + phase-conditional code preview
- `src/views/KnowledgeView.tsx` — Two-column: folder tree + note preview
- `src/views/AutomationView.tsx` — Two-column: type-grouped task list + config panel
- `src/views/MonetizationView.tsx` — Two-column: project list + revenue dashboard
- `src/views/ConnectionsView.tsx` — Two-column: filters + event timeline
- `src/App.tsx` — Removed TopBar import and rendering
- `src/stores/chatStore.ts` — Added `removeThread` action

### File Removed
- `src/components/TopBar.tsx` — Still exists on disk but no longer imported

---

## Design Decisions Archive

20 grilling decisions documented in the conversation thread. Key outcomes:

1. Accent: emerald `#10B981` over blue `#3B82F6`
2. Sidebar: 60px over 48px
3. Panel depth: outer-deep / mid-bridge / inner-deep (A allocation)
4. Message bubbles: emerald-600/70 right-aligned + card-style left-aligned with AI avatar
5. Bubble radius: 16px (`rounded-2xl`) with direction corners
6. No global TopBar — per-view local breadcrumbs
7. Model area: full card list preserved (not removed)
8. Thread list: pure color blocks, no time grouping
9. Input: big card style (`bg-secondary border rounded-xl focus-within:emerald`)
10. Budget bar: mid-panel bottom
11. Thread selection: emerald left bar + surface hover
12. Code blocks: `#1A1A1E` bg + emerald left border
13. Onboarding: 3-step card preserved, color-adapted
14. Other views: full redesign (C) — each gets mid+right panel structure

---

## Technical Notes

- **GSAP** installed for sidebar hover animation and view entrance effects
- **framer-motion** already present, used for Command Palette and notification dropdown
- **Geist + Geist Mono** fonts remain the typography stack
- **lucide-react** icon library across all components
- **Zustand** stores: chatStore (added `removeThread`), vibeStore (used `startClarifying/selectClarification/startImplementing/accept/reset`), automationStore (`pauseTask/resumeTask`, `schedule` not `intervalMs`), knowledgeStore (`createdAt` not `date`), monetizationStore (`projects/mothlyRevenue/projectRevenue`)
- Scrollbar classes: `scrollbar-sidebar`, `scrollbar-mid`, `scrollbar-content` for panel-adaptive styling

---

## Suggested Skills for Next Session

- `code-review` — Audit the rewritten views for bugs and edge cases
- `design-taste-frontend` — Fine-tune visual details (spacing, radius consistency, hover states)
- `superpowers:finishing-a-development-branch` — If committing this as a feature branch
- `gsap-plugins` or `gsap-core` — If adding more complex animations
- `implement` — For adding missing functionality (delete confirmation, bookmark persistence, attachment upload)