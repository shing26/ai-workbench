# 03 — Task Execution: scheduling + fetching + logging
**What to build:** Execution engine that runs tasks on schedule, fetches RSS/URL/API data via Rust backend, logs results, and updates task state. Support silent vs live-log modes.
**Blocked by:** 01-store-and-parser.md
**Status:** completed
- [ ] Rust: add `fetch_url` Tauri command (HTTP GET, returns body text)
- [ ] Rust: add `fetch_rss` Tauri command (GET + parse XML, return formatted items)
- [ ] Frontend: execution loop per task using setInterval with task.schedule ms
- [ ] On each tick: call appropriate fetch command, parse result, append log entry
- [ ] Live mode: update logs in real-time in store; Silent mode: only log on error/completion
- [ ] Status updates: running → ok (green) on success, failed (red) on error
- [ ] Last-run timestamp and next-run countdown on task card
- [ ] Verify: create RSS task → wait for interval → log shows fetched items → status green
**Blocked by:** 01-store-and-parser.md
