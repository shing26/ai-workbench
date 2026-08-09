# 20 — S3-3: Web Locks single-writer

**What to build:** 浏览器 fallback 单写者锁，防多标签页互踩。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] `db.ts` 新增 `withDbLock(fn)`：`navigator.locks.request('ai-workbench:db', {mode:'exclusive'}, fn)`，不可用时 fallback 内存互斥 + 时间戳版本号 last-write-wins
- [ ] 注入点：~10 个内部写函数（`writeLocal` + 各功能 key 的 `write*Local`），命令层零改动
- [ ] 读端不锁
- [ ] Rust 端不需要（SQLite 单进程单写者）

**Definition of Done:** 多标签页并发写不覆盖；命令层无感；浏览器/桌面语义一致。
