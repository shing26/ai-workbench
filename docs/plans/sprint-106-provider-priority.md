# Sprint 106 计划：Provider 优先级与路由排序

目标：给 Provider 增加本地优先级，让 AI Studio 的 MOA 前三路、Auto 路由和默认请求都按用户设定的优先级取用；同优先级下保留原有健康延迟兜底。

## Sprint 106 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | SQLite 迁移 | `providers` 新库建表含 `priority INTEGER NOT NULL DEFAULT 0`；旧库 `migrate_provider_priority` 幂等补列并回写 `NULL`，已加入 `init_connection` |
| R2 | Rust 命令与排序 | `set_provider_priority` Tauri 命令持久化优先级（负数钳制为 0）；`list_providers` / `get_provider` 读写 `priority`，列表按 `priority DESC, rowid ASC` |
| R3 | 浏览器 fallback | `db.ts` 读写 `priority`；`listProviders` / `routeProvider` / `sendAiMessageStream` 与 Tauri 同构排序 |
| R4 | System UI | Provider 卡片显示优先级并支持上/下调整，调整后立即持久化并刷新 |
| R5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `providerPriority` lane；Rust 单测覆盖迁移、持久化与负数钳制 |
| R6 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:preview` 全绿 |

## DoD 检查清单

- [x] Provider 优先级持久化，旧库迁移幂等。
- [x] MOA / Auto 路由 / 默认请求按优先级排序。
- [x] System Provider 卡片可调优先级且 UI 稳定。
- [x] Rust 119 条单测通过，lint / format / build 全绿。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
