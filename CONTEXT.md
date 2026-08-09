# AI Workbench — Context

## 当前开发范围（Sprint 101 起）

Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）两块未启动大模块已按用户要求搁置，后续有需要再开发，不纳入当前开发终点。下方模块描述仅作为产品愿景存档。

## 连接组织层 (Connection Layer)

The workbench's nervous system. A cross-module event-listening and notification-routing layer. It subscribes to state changes from Chat Hub, Automation Workbench, Knowledge Hub, and Vibe Coding, then decides what to surface, in what form, and when. It does not produce content — it routes signal.

### Signal → Rule → Action

Every module emits signals. The Connection Layer applies rules to each signal and produces exactly one action.

**MVP urgency tiers:**
- **urgent** → badge + toast + timeline entry (automation errors, critical completions)
- **quiet** → timeline entry only (daily summaries, save confirmations, progress updates)

### Delivery channels (MVP)
- **Bell dropdown** (TopBar): last ~5 urgent items, one-click scan without leaving current view
- **ConnectionsView**: full timeline with filtering by urgency, module, and search

### Cooling Recall

Periodic scan of active threads for inactivity. If a chat thread has no new messages in 72 hours and isn't archived, the Connection Layer inserts a quiet recall event into the timeline ("You were discussing X 3 days ago — continue?"). Clicking the event jumps back to that thread. No separate project tracker needed — it piggybacks on existing chatStore data.

### Session Breadcrumb

A lightweight "where was I" trail. On app exit, serialize key state (active view, active thread ID, unsent chat draft, Vibe Coding idea + phase) to localStorage. On next launch, insert a quiet timeline event with a clickable link to resume. No AI inference, no server dependency — purely a client-side breadcrumb.


## 创收工作台 (Monetization Workbench)

The downstream landing zone for Vibe Coding output. When a project passes acceptance in Vibe Coding, it becomes a trackable monetization asset. Three pillars: project assetization (cards with status + checklist), monetization templates (landing page, Chrome extension, Telegram bot, paid content), and revenue tracking (manual entry log + monthly/all-time stats). No payment integration, no auto-deploy, no exchange connectivity.

### Monetization Templates (MVP)

Three lightweight checklist templates, each a static set of steps the user checks off manually:

- **Landing Page**: buy domain → deploy to Vercel/Netlify → configure DNS → add analytics
- **Chrome Extension**: bundle crx → submit to Chrome Web Store → write description + screenshots
- **Paid Content**: organize as doc/course → pick platform (Gumroad) → set price → publish

### Revenue Tracking

Manual entry: amount + source label. Summary shows current month and all-time totals. No real-time API integration.

### Vibe Coding Bridge

When a Vibe Coding project passes acceptance, a monetization project card is auto-created with status "pending". User then visits Monetization Workbench to select a template and start tracking revenue.
