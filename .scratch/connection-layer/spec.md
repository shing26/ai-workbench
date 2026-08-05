# Connection Layer Spec

**Status:** deferred

> Deferred per user request. Not part of the current development endpoint; revisit and flip back to `ready-for-agent` only when this module is picked up again.

## Problem Statement

用户在工作台中产生的事件散落在各个模块——自动化的告警、对话的保存、Vibe Coding 的完成、知识的沉淀——但它们各自独立通知（TopBar 徽标、toast、对话线程创建），没有一个统一的"神经系统"来汇聚、分级、路由这些信号。用户离开工作台后也没有机制帮助续接上下文。

## Solution

新增连接组织层（Connection Layer）——跨模块的事件监听与通知路由层。它不生产内容，只路由信号。核心是 Signal → Rule → Action 模型：各模块发出信号，连接组织层按规则判断档位（urgent / quiet），将 urgent 推送到铃铛徽标 + toast + 统一时间线，quiet 静默写入时间线。

附加两个主动服务：冷却召回（72h 未活跃线程自动提醒）和会话面包屑（退出时保存上下文，下次启动时帮助续接）。

## User Stories

1. As a user, I want to click the bell icon in the top bar to see a dropdown of recent urgent events, so that I can scan alerts without leaving my current view.
2. As a user, I want the bell icon to show a badge count of unread urgent events, so that I know at a glance if something needs attention.
3. As a user, I want to navigate to the Connections view to see a full timeline of all events (urgent + quiet), so that I can review history and find past signals.
4. As a user, I want to filter the timeline by urgency (urgent / quiet / all) and by source module, so that I can focus on what matters.
5. As a user, I want automation errors to appear as urgent events with a toast notification, so that I don't miss critical failures.
6. As a user, I want knowledge save confirmations to appear as quiet events without interrupting me, so that they're logged but not distracting.
7. As a user, I want to be reminded when a chat thread I haven't touched in 3 days has been idle, so that I can decide whether to continue or archive it.
8. As a user, I want my unsent chat draft and active view state to be preserved when I close the app, so that I can pick up where I left off next time.
9. As a user, I want a "welcome back" breadcrumb in the timeline when I reopen the app after a session, so that I can resume my last context with one click.
10. As a user, I want clicking a timeline event to navigate me to the relevant view and context (thread, task, note), so that I can act on signals immediately.
11. As a user, I want to clear all urgent badge counts by opening the bell dropdown, so that the badge doesn't accumulate stale counts.

## Implementation Decisions

- **Event model**: Each signal is a ConnectionEvent with id, source (chat/automation/knowledge/vibe/system), level (urgent/quiet), title, body, timestamp, and optional targetId (for navigation)
- **Connection Store**: New Zustand store `connectionStore` — holds events[], badgeCount, active filters. addEvent() accepts a signal, applies urgency rules, increments badge if urgent, and auto-creates chat threads for automation errors via chatStore
- **Rule engine**: MVP rules are hardcoded in addEvent() — automation error/warning → urgent; anything else → quiet. Configurable rules deferred
- **Bell dropdown**: TopBar bell icon opens an AnimatePresence popover showing last 5 urgent events. Clicking an event navigates to its source view + target. Clicking "View all" opens ConnectionsView. Opening the dropdown clears badge count
- **TopBar refactor**: Remove automationStore alertCount — TopBar now reads connectionStore.badgeCount. Keep the existing budget indicator
- **Existing store migration**: automationStore.removeTask's alertCount recalculation stays; the addLog alert thread creation moves to connectionStore.addEvent()
- **ConnectionsView**: Replaces placeholder. Full timeline list grouped by date, filter bar (urgency + source module dropdowns), search input. Each event row shows icon, timestamp, source badge, title, body excerpt. Click to navigate
- **Cooling recall**: On app mount, connectionStore scans chatStore threads — if any has messages but last message >72h ago and thread is not archived, insert a quiet recall event with targetId pointing to the thread
- **Session breadcrumb**: On beforeunload, serialize { activeView, activeThreadId, chatDraft, vibeState } to localStorage key `ai-workbench:session`. On app mount, if the key exists, insert a quiet resume event, restore chat draft to chatStore, and delete the key
- **Navigation**: Timeline events carry targetId; clicking dispatches appStore.setActiveView(targetView) and if applicable sets the target (setActiveThread, setSelectedTaskId, etc.)
- **Visual**: Consistent dark theme. Bell dropdown uses the same glass-morphism style as CommandPalette. Timeline uses color-coded urgency dots (red=urgent, gray=quiet) and module-specific source icons

## Testing Decisions

- UI verified via manual visual verification in dev server (Vite HMR)
- connectionStore rules tested via console logging during development
- What makes a good test: trigger an automation error → bell badge increments → dropdown shows the event → click navigates to chat → timeline in ConnectionsView shows the same event
- Session breadcrumb tested by closing and reopening the browser tab

## Out of Scope

- OS-level native notifications (Windows notification plugin)
- External bridges (Discord, Slack, email)
- User-configurable rule engine with filtering by keyword/time/module
- Cross-session state persistence beyond localStorage
- Multi-day timeline archival or pagination
- "Idea capture" with AI context reconstruction — MVP does simple state serialization only

## Further Notes

- The connectionStore is the single source of truth for all cross-module notifications. No module should directly call chatStore.createThread() for alerts — they should go through connectionStore.addEvent()
- The existing automationStore.alertCount is superseded by connectionStore.badgeCount but kept internally for the removeTask recalculation
- Bell dropdown should close on click-outside and on Esc, matching CommandPalette behavior
- Session breadcrumb is a browser-level feature (beforeunload); in Tauri production builds this should use the Tauri close event instead
