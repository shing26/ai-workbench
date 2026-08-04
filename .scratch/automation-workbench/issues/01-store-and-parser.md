# 01 — Automation Store + NL Parser
**What to build:** Zustand store for automation tasks (types, CRUD, scheduling state) + keyword-based NL parser that converts natural language input into task configs.
**Blocked by:** None — can start immediately.
**Status:** completed
- [ ] Define TaskConfig type (id, name, sourceType, sourceUrl, schedule, alertRules, mode)
- [ ] Define TaskLog type (id, taskId, timestamp, level, message)
- [ ] Create automationStore with tasks[], logs[], activeTab, selectedTaskId
- [ ] Implement addTask(name, config), removeTask(id), pauseTask(id), resumeTask(id)
- [ ] Implement keyword parser: "RSS"/"feed" → RSS task, "price"/"BTC"/"ETH" → price alert, "every"/"hour"/"day" → schedule
- [ ] Parser extracts source URL, interval, threshold from NL input
- [ ] Unit test: "check BTC price every 5 min" → { sourceType: "api-price", schedule: 300000 }
- [ ] Unit test: "monitor TechCrunch RSS daily" → { sourceType: "rss", schedule: 86400000 }
**Blocked by:** None — can start immediately.
