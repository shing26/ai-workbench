# Sprint 92 计划：Sync E2E 加密

目标：给同步快照增加 AES-256-GCM 端到端加密。浏览器侧用 Web Crypto，Tauri 侧用 ring，两侧共享同一 JSON envelope 格式与 PBKDF2 派生参数，保证导出/导入、HTTP push/pull、自动同步都能携带可选口令。

## Sprint 92 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 加密原语 | `encrypt_sync_payload` / `decrypt_sync_payload`：PBKDF2-HMAC-SHA256 100k 次派生 256 位密钥，16 字节 salt，12 字节 nonce，AES-256-GCM，输出 `{v:1, alg:"AES-256-GCM", salt, iv, ciphertext}`；错误口令解密失败返回错误 |
| A2 | Rust Tauri 命令 | `encrypt_sync_payload_command` / `decrypt_sync_payload_command` / `export_encrypted_sync_snapshot` / `import_encrypted_sync_snapshot` 注册到 invoke_handler；push/pull 支持可选 passphrase 走加密 HTTP 载荷 |
| A3 | TS Web Crypto | `db.ts` 新增 `SyncEnvelope` / `encryptSyncPayload` / `decryptSyncPayload` / `exportEncryptedSyncSnapshot` / `importEncryptedSyncSnapshot`；浏览器 fallback 用 PBKDF2 + AES-GCM，localStorage key `ai-workbench:sync-encrypted:v1` |
| A4 | System UI | Sync card 新增 `data-sync-e2e-toggle` 开关、`data-sync-passphrase` 口令输入、`data-sync-e2e-status` 状态；export/import/push/pull/auto sync 全部支持口令加密；导入失败时显示错误 |
| A5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `syncE2e` lane：导出加密快照、envelope 无明文、导入加密快照、错误口令失败、加密 push 成功提示 |

## DoD 检查单

- [x] `cargo fmt`、`cargo clippy --lib -- -Dwarnings`、`cargo test --lib` 全绿（104/104，新增 3 个加密测试）。
- [x] `npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `syncE2e` 均为 true，完整 suite 通过。
- [x] 浏览器 fallback 与 Rust 使用同一 envelope 格式与派生参数，导出文件可跨侧还原。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.92.0-alpha`。

## 范围外（Backlog）

- 不做多设备口令交换 / 口令找回；口令只保存在用户输入与同步载荷派生的密钥中。
- 不做密钥轮换与 salt 入库；每次导出重新生成 salt / nonce。
- 不做口令强度提示与确认框；当前仅提供单一口令输入。
