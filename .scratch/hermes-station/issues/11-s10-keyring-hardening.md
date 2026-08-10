# 11 — S10-2: Keyring hardening + masked API keys

**What to build:** API Key 直写 OS Keyring，脱敏显示（sk-proj-••••），禁止明文落盘。

**Blocked by:** None — can start immediately.

**Status:** deferred → **v1.1.1-patch**（独立维护 Ticket，不在 v1.1-alpha 主线）

> 重定位说明（2026-08-10）：v1.1-alpha 已含 `keyring_ref` + `set_secret`/`get_secret` + 脱敏显示基础能力，AC-4.2 核心安全达成。但**全量审计迁移**（既有明文 key 启动一键搬入 Keychain + 启动自检 + localStorage/配置明文扫描断言）留作后续底层重构的独立维护 Ticket，不影响 v1.1 主线发布。在 `docs/RELEASE-v1.1-alpha.md`「已知限制」中已记录。

- [ ] 审计 `create_provider` / `update_provider`：api_key 写入后立即转 Keyring 引用（`keyring_ref`），SQLite 不存明文
- [ ] 前端 Provider 卡显示脱敏（`sk-proj-••••`，`data-provider-key-masked`），编辑时明文输入但不回显
- [ ] 迁移：既有明文 key 启动时搬入 Keyring（一次性）
- [ ] 验证：抓取 localStorage + 配置文件，确认无明文 API Key（AC-4.2 硬性检查）
- [ ] verify lane + 安全断言：localStorage 无明文 key

**Definition of Done:** 明文零落盘，Keyring 安全归档，脱敏显示。AC-4.2 全量。（v1.1.1-patch 交付）
