# Monetization Workbench Spec

**Status:** ready-for-agent

## Problem Statement

Vibe Coding 工场产生的项目验收通过后就结束了——没有下游承接。用户缺少一个地方来追踪自己构建的项目是否在变现、赚了多少、处于什么阶段。

## Solution

新增创收工作台，作为 Vibe Coding 的下游承接。验收通过时自动创建"创收项目"卡片。用户可选变现模板（带 checklist），手动录入收入日志，看到本月/总计统计。

## User Stories

1. As a user, I want a monetization project card to be auto-created when I accept a Vibe Coding project, so that I don't have to manually register every output.
2. As a user, I want to see all my monetization projects as cards showing name, template, status, and revenue, so that I can scan my portfolio at a glance.
3. As a user, I want to select a monetization template (Landing Page / Chrome Extension / Paid Content) for a project, so that I have a checklist to follow.
4. As a user, I want to check off template steps as I complete them, so that I can track my progress toward launch.
5. As a user, I want to manually enter a revenue amount with a source label, so that I can log earnings from any channel.
6. As a user, I want to see a summary of this month's revenue and all-time revenue, so that I know how my projects are performing.
7. As a user, I want to edit a project's name and template after creation, so that I can keep information accurate.
8. As a user, I want to archive a project when it's no longer active, so that my dashboard stays clean.
9. As a user, I want to click a project card to expand its detail panel showing checklist progress, revenue log, and generated code preview.

## Implementation Decisions

- **Monetization Store**: New Zustand `monetizationStore` — projects[] with type MonetizationProject (id, name, template, templateSteps[], revenueLog[], generatedCode, status, createdAt)
- **Template data**: Static arrays in the store — each template has a name + steps[]. Steps each have label + done flag
- **Revenue log**: Array of { amount, source, timestamp } per project. Summary computed via getter
- **Auto-create from Vibe**: In vibeStore.accept(), call monetizationStore.addProject(idea, generatedCode) to create a card with status "pending"
- **MonetizationView**: Replaces placeholder. Header + summary bar (this month / all-time) + project card grid (2-3 cols). Click card → detail panel with checklist + revenue log + code preview
- **Template selector**: Dropdown in the detail panel or inline on card. Selecting a template populates the checklist steps
- **Revenue input**: Simple form in detail panel — amount input + source input + "Add" button. Log entries listed below
- **Visual**: Consistent dark theme. Revenue numbers in green. Template steps with checkboxes. Status badges (pending/yellow, active/green, archived/gray)

## Testing Decisions

- UI verified via manual visual verification in dev server (Vite HMR)
- Vibe Coding bridge: accept a project → monetization card auto-created
- What makes a good test: create vibe project → accept → navigate to Monetization → see card → select template → check off steps → add revenue → see totals update

## Out of Scope

- Real payment API integration
- Automated deployment pipelines
- Exchange/crypto revenue tracking
- Revenue charts or advanced analytics
- Multi-currency support
- Export or CSV download

## Further Notes

- Revenue log entries are append-only; editing or deleting entries is out of scope for MVP
- Template steps are stored per project instance, not as shared references — changing a template after creation doesn't affect existing projects
- Projects persist in Zustand only (no localStorage); full persistence comes with SQLite later
