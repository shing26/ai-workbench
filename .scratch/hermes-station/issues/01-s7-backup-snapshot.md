# 01 — T-701: Rust 阴影快照引擎 (.hermes/backups) 与原子文件写盘

**What to build:** 文件被修改前的 1ms 内静默完成原文件备份，并采用临时文件重命名（Rename）原子写技术，防止写盘中断导致损坏。

**Blocked by:** None — can start immediately.

**Status:** completed

## 流程机制

```
[触发 Apply]
  ▼
1. 校验目标文件是否存在
   ├─ 存在 ──► 2. 读取原内容 ──► 3. 写入 .hermes/backups/<ts>_<sha8>_<name>.bak
   └─ 不存在 ─► 标记为 NEW_FILE 快照
  ▼
4. 写入临时文件 target.tmp (Flush 刷盘)
  ▼
5. fs::rename(tmp, target) 原子替换
```

## 备份命名规范

- `.hermes/backups/<YYYYMMDD_HHMMSS>_<SHA256_HASH_8>_<FILENAME>.bak`
- 索引文件：`.hermes/backups/manifest.json`（backup_id → target_path 映射，精度恢复）

## 任务清单（已实现）

- [x] `src-tauri/src/file_ops.rs`：`create_shadow_snapshot`（时间戳+sha8 命名 + manifest 登记）
- [x] `atomic_write`：tmp 写入 + `fs::rename` 原子替换
- [x] `resolve_project_relative`：路径穿越防护 + 缺失父目录自动创建（canonicalize 祖先）
- [x] `manifest.json` 读写（FileBackupEntry 序列化）
- [x] `prune_snapshots(project_path, keep)` 保留最近 N 个快照

## DoD 验收（已过）

- [x] Rust 单测 6/6：apply_creates_backup / rollback_restores_original / path_traversal_rejected / missing_parent_dirs_created / repeated_apply_keeps_unique_backups / prune_removes_oldest
- [x] 修改任何本地文件，`.hermes/backups/` 毫秒级生成 `.bak` 备份
- [x] 原子 Rename 保证写盘中断不产生空文件/损坏文件（AC-2.1 基础）
