# 2026-08-06 Sync E2E 加密评审

## 结论

- Rust 侧用 `ring` 实现 PBKDF2-HMAC-SHA256（100k 次）+ AES-256-GCM：16 字节 salt、12 字节 nonce，JSON envelope 固定为 `{v:1, alg:"AES-256-GCM", salt, iv, ciphertext}`，错误口令解密返回错误。
- 新增 4 个 Tauri 命令：`encrypt_sync_payload_command` / `decrypt_sync_payload_command` / `export_encrypted_sync_snapshot` / `import_encrypted_sync_snapshot`；`push_sync_snapshot` / `pull_sync_snapshot` 增加可选 `passphrase`，加密时走 `push_sync_payload_http` / `pull_sync_payload_http`。
- 浏览器 fallback 用 Web Crypto 镜像同一算法与 envelope；`db.ts` 新增 `SyncEnvelope`、`encryptSyncPayload` / `decryptSyncPayload`、`exportEncryptedSyncSnapshot` / `importEncryptedSyncSnapshot`，localStorage key 为 `ai-workbench:sync-encrypted:v1`。
- System Sync card 新增 E2E 开关、口令输入与状态徽标；export / import / push / pull / auto sync 全部支持口令加密，导入失败会显示 rose 错误消息。
- `verify:ui` / `verify:preview` 新增 `syncE2e` lane：导出加密快照、envelope 存在且无明文、加密导入、错误口令失败、加密 push 成功提示，全链路通过。

## 风险与后续

- Chromium 的 AES-GCM 解密失败抛出的 DOMException `message` 为空字符串，`err instanceof Error` 为 true；已增加 `syncErrorMessage` 兜底，显示 `Operation failed (OperationError)`，避免错误消息被吞掉。
- 口令不落盘、不提供找回机制，丢失口令即无法解密历史快照；后续可在 Backlog 增加口令强度检查与导出前确认。
- 多设备口令交换、密钥轮换、salt 入库继续留在 Backlog。
