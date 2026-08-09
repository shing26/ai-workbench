# 01 — S7-1: .hermes/backups shadow snapshot (Rust atomic write + backup)

**What to build:** 原子写入前的阴影快照机制——覆盖本地文件前 1ms 内把原文件压入 `.hermes/backups`。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Rust 新增 `write_file_with_backup(path, content)` 命令：
  - 读原文件内容 → 生成 `.hermes/backups/<relative-path>/<ts>-<basename>.bak`（时间戳快照）
  - 原子写入目标文件（temp file + rename，避免半写损坏）
- [ ] `.hermes/backups` 快照登记表（SQLite `file_backups`：id, project_path, file_path, backup_path, applied_at）
- [ ] `list_file_backups(project_path)` / `restore_file_backup(backup_id)` / `rollback_last(file_path)` 命令
- [ ] Rust 单测：快照生成、原子写、回滚恢复、无损坏
- [ ] 浏览器 fallback 同构（localStorage `fileBackups` + 文件系统不可用则用内存回滚栈）

**Definition of Done:** 覆盖写入前自动快照；⌘Z 一键回滚原内容；无语法损坏或文件锁死。AC-2.1/2.2 基础。
