# Sprint 105 计划：会话消息跳转与高亮

目标：会话搜索命中消息时，搜索结果显示 `messageId`，点击会话直接加载对应消息并滚动到命中位置，以高亮边框提示用户；Rust 与浏览器 fallback 同构返回命中消息 ID。

## Sprint 105 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 搜索命中消息 ID | `SessionSearchHit` 新增 `message_id: Option<String>`；`search_sessions` 在消息全文命中时返回对应 `chat_messages.id`，标题 / 模型命中为 `None` |
| R2 | 浏览器 fallback | `db.ts` 的 `SessionSearchHit` 新增 `messageId`；`searchSessions` 在消息命中时携带 `message.id` |
| R3 | AI Studio 跳转 | 搜索结果行带 `data-session-message-id`；点击 Open session 调用 `selectSession(id, messageId)`，加载后 `scrollIntoView` 并添加 `message-jump-highlight` |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 的 `sessionSearchEnhanced` lane 断言跳转成功且高亮元素 ID 与命中 ID 一致 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:preview` 全绿 |

## DoD 检查清单

- [x] 会话搜索消息命中返回真实 `messageId`，Rust 与浏览器 fallback 一致。
- [x] 点击命中会话后自动加载消息、滚动到命中位置并高亮。
- [x] 新开会话 / 切换无命中会话时清除高亮。
- [x] Rust 118 条单测通过，`cargo fmt` / `cargo clippy --lib -- -D warnings` 全绿。
- [x] `npm run build`、`npm run lint`、`npx prettier --check .`、`verify:preview` 全绿。
- [x] 无数据库表结构变更；PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.105.0-alpha`。

## 范围外（Backlog）

- Provider 权重 / 路由排序与跨路 token 预算控制。
- 拼音首字母 / 中文分词模糊匹配。
- 搜索历史、保存过滤条件与跨会话全文聚合统计。
- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）继续搁置。
