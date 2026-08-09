# 02 — S7-2: AI Studio code block [⚡ Apply] button

**What to build:** AI 生成代码块上的一键写入按钮，点击触发原子写入 + 快照备份。

**Blocked by:** 01 (S7-1 backup snapshot)

**Status:** ready-for-agent

- [ ] AI Studio 消息内容中识别代码块（``` 围栏）→ 渲染 `[⚡ Apply]` 按钮（`data-code-apply`）
- [ ] 点击 → 提取代码 + 目标文件路径（从回复中解析或用户选择）→ 调 `write_file_with_backup`
- [ ] 成功后按钮变 `[✓ 已写入本地]`（`data-code-apply-result`），失败显示错误
- [ ] ⌘Z 撤销入口（`data-code-rollback`）→ 调 `rollback_last(file_path)`
- [ ] 写入成功 → Event Bus 广播 `file-applied` → Projects Git Diff 计数刷新（Sprint 8 联动点预留）

**Definition of Done:** 代码块一键 Apply 到本地；带快照；按钮状态反馈；⌘Z 可撤销。AC-2.1。
