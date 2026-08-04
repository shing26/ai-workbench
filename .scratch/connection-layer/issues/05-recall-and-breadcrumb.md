# 05 — Cooling Recall + Session Breadcrumb

**What to build:** Two proactive features. **(a) Cooling recall:** On app mount, scan `chatStore` threads — if any thread has messages but its last message timestamp is >72 hours ago, insert a quiet recall event with title "Still working on X?" and targetId pointing to that thread. **(b) Session breadcrumb:** On `beforeunload`, serialize the current session state (activeView, activeThreadId, chat input draft, vibeStore state) to localStorage key `ai-workbench:session`. On app mount, if the key exists, insert a quiet resume event with title "Welcome back — continue where you left off?", restore the chat draft to chatStore if applicable, navigate to the saved activeView, and delete the key.

**Blocked by:** 01-connection-store.md

**Status:** completed

- [ ] Cooling recall: on App mount, scan chatStore threads for last message >72h → insert quiet recall event per inactive thread
- [ ] Session breadcrumb serializer: on beforeunload, write { activeView, activeThreadId, chatDraft?, vibeIdea?, vibePhase? } to localStorage
- [ ] Session breadcrumb restorer: on App mount, if session key exists, insert quiet resume event, restore chat draft via chatStore (set a pending input), navigate to activeView
- [ ] Delete session key after restoration to prevent re-trigger on refresh
- [ ] Each recall/resume event has targetView + targetId for one-click navigation
- [ ] Verify: create a thread but don't message for 72h → recall event in timeline. Type a message draft, close tab, reopen → breadcrumb event + draft restored
