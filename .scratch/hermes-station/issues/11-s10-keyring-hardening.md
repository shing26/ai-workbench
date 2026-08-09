# 11 — S10-2: Keyring hardening + masked API keys

**What to build:** API Key 直写 OS Keyring，脱敏显示（sk-proj-••••），禁止明文落盘。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 审计 `create_provider` / `update_provider`：api_key 写入后立即转 Keyring 引用（`keyring_ref`），SQLite 不存明文
- [ ] 前端 Provider 卡显示脱敏（`sk-proj-••••`，`data-provider-key-masked`），编辑时明文输入但不回显
- [ ] 迁移：既有明文 key 启动时搬入 Keyring（一次性）
- [ ] 验证：抓取 localStorage + 配置文件，确认无明文 API Key（AC-4.2 硬性检查）
- [ ] verify lane + 安全断言：localStorage 无明文 key

**Definition of Done:** 明文零落盘，Keyring 安全归档，脱敏显示。AC-4.2。
