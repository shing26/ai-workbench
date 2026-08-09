# Sprint 144 计划：事件总线持久化与跨设备转发

目标：把事件总线从“只触发 Webhook”升级为可持久化、可校验、可跨设备转发的事件管道：每次系统事件落库 `event_logs`，按事件 schema 校验，失败事件标记 rejected 并保留原因，同时按配置把事件转发到远端设备。

## Sprint 144 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| L1 | event log 数据模型 | 新增 `event_logs`（id / event / context / source / device_id / schema_version / status / rejected_reason / created_at）与 `(created_at DESC)`、`(event, created_at)` 索引；新库 SCHEMA 直接建表 |
| L2 | schema 校验 | 新增 `event_schemas`（event PK / schema JSON / enabled / updated_at）与 `validate_event_context`：支持 `required` 字段与 `properties.type`（string / number / boolean / object / array / null）；`schema_strict=false` 时缺失 schema 不拦截，有 schema 仍校验 |
| L3 | 转发队列 | 新增 `event_forwards`（event_log_id / target_url / target_token / status / attempts / next_attempt_at / last_status / last_message / created_at / updated_at）与 `event_bus_config` 单行表（forward_enabled / forward_url / forward_token / retention_days / max_logs / schema_strict / updated_at） |
| L4 | 事件入口 | 新增 Tauri 命令 `emit_event_bus_event`：落库 -> schema 校验 -> rejected / accepted -> 按配置入队转发 -> 复用 `trigger_webhook_event` 触发 Webhook；浏览器 fallback 同构 |
| L5 | 转发 worker | 后台线程按 `1000ms << attempts`（封顶 5 分钟）认领并 POST 事件 JSON 到 target_url（Bearer token），成功标 success，失败重排队；`retry_event_forward` 可手动重试 |
| L6 | System UI | 新增 Event bus 卡片：统计条、事件输入与发送、事件日志列表（status / reason 徽标）、schema 编辑区、转发配置与队列列表 |
| L7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `eventBusLogging` / `eventBusSchema` / `eventBusForward` lane；Rust 单测覆盖落库、schema 校验、保留策略、转发队列与退避 |
| L8 | 文档更新 | BACKLOG 移除该项并记入已完成，RETRO / ARCHITECTURE / DATABASE 同步；提交合入 develop |

## DoD 检查单

- [x] 事件落库后可查询、可清理；无效事件按 schema 标记 rejected 并保留原因。
- [x] 转发配置开启后事件自动入队并投递到远端 URL，失败按指数退避可重试。
- [x] `emit_event_bus_event` 同时触发已有 Webhook 事件规则。
- [x] `verify:ui` / `verify:preview` 的 `eventBusLogging` / `eventBusSchema` / `eventBusForward` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Knowledge 真实 Embedding、向量分片、语义聚类，继续留在候选池。
- Provider 导入导出 / 模型元数据 / Sync 口令轮换，继续留在候选池。
- Connection Layer 与 Monetization Workbench 继续搁置。
