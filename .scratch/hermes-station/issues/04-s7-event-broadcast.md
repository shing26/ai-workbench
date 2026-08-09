# 04 — S7-4: Apply 写入后 Event Bus 广播

**What to build:** 文件成功写入后向 Event Bus 广播变更，Projects Git Diff 计数实时刷新。

**Blocked by:** 02 (S7-2 Code Apply)

**Status:** ready-for-agent

- [ ] Rust `write_file_with_backup` 成功后 emit `file-applied` 事件（{ projectPath, filePath }）
- [ ] 前端 `events.ts` 订阅 `file-applied` → 刷新对应项目 gitCtx（`getProjectGitContext`）
- [ ] Projects 卡片变更文件计数即时 +1 / Git 状态更新（无手动刷新）
- [ ] 浏览器 fallback 用 CustomEvent 同构
- [ ] verify lane：Apply 后 Projects 卡 changed 计数刷新

**Definition of Done:** Apply 写入 → Event Bus → Projects 实时刷新。AC-2.1 联动。
