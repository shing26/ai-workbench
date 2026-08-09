# 2026-08-06 Provider 优先级与路由排序 Review

## 结论

Sprint 106 完成，Provider 优先级已贯穿 SQLite、Rust、浏览器 fallback、System UI 与自动化验证。

## 验收证据

- `providers.priority` 新库建列 + `migrate_provider_priority` 幂等迁移，`list_providers` / `get_provider` 读写并排序。
- `set_provider_priority` Tauri 命令与 `db.ts` fallback 同构，负数钳制为 0。
- MOA 前三路、Auto 路由与默认请求均按优先级排序，同优先级 Auto 路由保留健康延迟兜底。
- `verify:ui` / `verify:preview` 的 `providerPriority` lane 断言卡片按 3/2/1 排序、增减持久化。
- Rust 119 条单测、fmt、clippy、build、lint、prettier、`verify:ui` / `verify:preview` 全绿。

## 遗留

- 拼音模糊搜索、搜索历史与跨会话聚合统计进入下一 Sprint 候选池。
- Connection Layer 与 Monetization Workbench 继续搁置。
