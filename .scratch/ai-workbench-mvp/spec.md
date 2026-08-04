# AI Workbench MVP Spec

**Status:** ready-for-agent

## Problem Statement

用户拥有多个 AI 工具（Codex CLI、各家模型 API、本地 Ollama），但工具分散、上下文割裂。需要一个本地桌面工作台统一调度这些能力，同时保持数据完全本地可控、不依赖云端。

## Solution

AI Workbench — 基于 Tauri 2 的本地桌面应用，作为 AI 能力的编排层。深色高密度仪表盘，一个入口完成对话、写码、学习、自动化与创收。MVP 只做对话中枢 + Vibe coding 工场两块核心。

## User Stories

1. As a user, I want to launch a desktop app with a dark-themed dashboard, so that I can access all AI tools from one place.
2. As a user, I want a sidebar with six module icons for navigation, so that I can quickly switch between work contexts.
3. As a user, I want to press Ctrl+K to open a command palette, so that I can navigate views and trigger actions without the mouse.
4. As a user, I want to create conversation threads with different AI models, so that I can chat with the right model for each task.
5. As a user, I want to select between cloud API, Codex, local Ollama, and auto-routing, so that I can balance capability, privacy, and cost.
6. As a user, I want to see my monthly API budget status in the top bar, so that I can manage spending at a glance.
7. As a user, I want to capture a coding idea as a one-liner, so that I can start vibe coding without friction.
8. As a user, I want the AI to ask 1-3 clarifying questions before implementing, so that I can confirm boundaries before work begins.
9. As a user, I want to see the implementation progress in real time, so that I can follow along as Codex CLI works.
10. As a user, I want to run and test the generated code, see errors, and have them auto-fixed, so that the output is actually runnable.
11. As a user, I want to store API keys securely in Windows Credential Manager, so that no secrets live in plaintext files.
12. As a user, I want view transitions to feel smooth with animated page switches, so that the app feels polished and responsive.

## Implementation Decisions

- **Desktop shell**: Tauri 2 (Rust) — low memory footprint for always-on usage
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 — mature ecosystem for high-density dashboards
- **Animations**: Framer Motion for view transitions and micro-interactions
- **Drag & drop**: dnd-kit for future interactive panels
- **State management**: Zustand for lightweight global state (active view, model routing, budget)
- **Icons**: Lucide React — consistent icon set
- **Model routing**: Hybrid — local Ollama (3-4B) for privacy-sensitive/light tasks; cloud API for complex reasoning; auto-fallback on budget exceeded
- **Secrets**: Rust `keyring` crate → Windows Credential Manager via Tauri commands (`set_secret`, `get_secret`, `delete_secret`)
- **Persistence** (post-MVP): SQLite for chat history and behavior memory
- **Authorization model**: Read = auto; Write/Run = one-time confirm; Delete/Send/Spend = explicit approval
- **Visual**: Deep theme, high information density, functional aesthetic — no decorative elements
- **Window**: 1440×900, title "AI Workbench"
- **identifier**: `com.aiworkbench.desktop`

## Testing Decisions

- UI components verified via manual visual verification in dev server (Tauri + Vite HMR)
- Tauri commands tested via `invoke()` in frontend or direct Rust tests
- What makes a good test: verify external behavior (navigation works, palette opens on Ctrl+K, threads persist across view switches), not implementation details

## Out of Scope

- Knowledge hub, automation workbench, monetization workbench modules (placeholder views only)
- SQLite persistence for chat history
- Behavior memory accumulation and audit UI
- Multi-project context isolation
- Mobile companion or remote access
- OKX/Meme trading integrations

## Further Notes

- The `user-profile.md` is the highest-priority rule file; the app must never auto-rewrite it
- All keyboard shortcuts must be discoverable via the command palette
- Task progress should be visible in real time (status indicators, progress bars where applicable)
