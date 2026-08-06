# Sprint 152 计划：Sync 口令强度提示与确认框、多设备口令交换、密钥轮换与 salt 入库

目标：把 Sync E2E 加密从“输入口令即可导出”升级为企业级密钥生命周期：口令强度门槛、确认门、多设备配对码交换、密钥轮换与新 salt 落库。

## Sprint 152 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| S1 | SQLite 密钥表 | 新增 `sync_credentials`（单行：device id / encryption_enabled / confirmed / active_key_version / rotated_at）、`sync_key_versions`（device id + version 联合主键：salt / fingerprint / algorithm / iterations / active / created_at / rotated_at）、`sync_paired_devices`（device id / fingerprint / pairing_code / version / paired_at）。 |
| S2 | Rust 命令 | 新增 `sync_passphrase_strength` / `get_sync_key_status` / `list_sync_key_versions` / `register_sync_passphrase` / `confirm_sync_passphrase` / `rotate_sync_passphrase` / `get_sync_pairing_code` / `verify_sync_pairing_code` / `list_sync_paired_devices` / `remove_sync_paired_device`；注册与轮换生成 16 字节随机 salt，PBKDF2-HMAC-SHA256 100k 次派生密钥并写 SHA-256 前 8 字节指纹，口令明文不入库，确认口令不轮换。 |
| S3 | 浏览器 fallback | `ai-workbench:sync-keys:v1` 同构保存 credential / versions / pairedDevices；Web Crypto 镜像强度、指纹、配对码与轮换语义；`deriveBrowserSyncKey` 可导出密钥以计算指纹。 |
| S4 | System UI | Sync card 新增强度条（weak / fair / strong / excellent）、确认按钮与确认门（未确认拦截 export / import / push / pull / auto sync）、配对码生成 / 复制 / 粘贴校验、已配对设备列表、Rotate 轮换与版本历史徽标。 |
| S5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `syncPassphraseSecurity` lane（强度、确认、配对码、轮换、重复确认不轮换），`syncE2e` lane 适配确认门；Rust 单测覆盖强度、salt 持久化、轮换版本、确认不轮换与配对码解析，总数增至 188。 |
| S6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合并 develop。 |

## DoD 检查单

- [x] `sync_credentials` / `sync_key_versions` / `sync_paired_devices` 三表可持久化密钥生命周期，口令明文永不落库。
- [x] 口令强度 < 40 拒绝注册 / 轮换；注册自动 v1，轮换生成新 salt + 新指纹并标记旧版本为非激活。
- [x] 配对码可在多设备间交换校验：同一口令 + salt 推导出的指纹一致才允许配对。
- [x] 浏览器 fallback 与 Tauri 链路行为一致，`sync-keys:v1` 不破坏既有 localStorage 结构。
- [x] `verify:ui` / `verify:preview` 的 `syncPassphraseSecurity` / `syncE2e` lane 双端通过；Rust 单测 188/188。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；RAG 跨文件来源选择器为下一 Sprint 候选。
