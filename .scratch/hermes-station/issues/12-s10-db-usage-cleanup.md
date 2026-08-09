# 12 — S10-3: workbench.db usage monitor + snapshot cleanup

**What to build:** 监控 workbench.db 本地占用，提供一键清理快照按钮。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Rust `get_db_usage()` 命令（文件大小 + 各表行数估算）
- [ ] System 新增 DB usage 卡：占用大小、`.hermes/backups` 快照数量与体积
- [ ] `[🧹 清理快照]`（`data-cleanup-backups`）→ 精简历史文件阴影快照（保留最近 N 或按时间），二次确认
- [ ] 清理前统计、清理后反馈（释放空间）
- [ ] verify lane：mock 快照 → 清理 → 数量减少

**Definition of Done:** 资源占用可见，一键安全清理快照。
