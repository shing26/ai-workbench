# Sprint 11 计划：AI Studio 多会话持久化

目标：AI Studio 从单页内存对话升级为多会话持久化：每个会话独立保存 user/assistant 消息，重启应用后仍可恢复历史对话。

## Sprint 11 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | 数据模型 | SQLite 新增 `chat_messages` 表（session_id、role、content、created_at），旧库升级不丢数据 |
| D2 | Rust 命令 | `save_chat_message(session_id, role, content)`、`list_chat_messages(session_id)` 注册并有单测 |
| D3 | 会话栏 | AI Studio 左侧新增会话列表与 New chat；点击会话加载历史消息 |
| D4 | 自动保存 | 发送时保存 user 消息，流式结束后保存 assistant 消息；浏览器 fallback 用 localStorage 持久化 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 会话重命名、删除与搜索
- 消息编辑与重新生成
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] `chat_messages` 表已建，Rust 保存/读取命令有单测
- [x] AI Studio 可新建会话、切换会话并恢复历史
- [x] `verify:ui` 能稳定断言刷新后会话与消息恢复
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
