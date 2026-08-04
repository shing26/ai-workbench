# Sprint 14 计划：AI Studio 消息编辑与重新生成

目标：让历史会话中的消息可编辑、可重新生成。用户修改某条 user 消息后，一键重新生成该条回复，旧回复自动替换，消息链保持完整。

## Sprint 14 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust 命令 | 新增 `update_chat_message(id, content)`、`truncate_chat_messages(session_id, keep_message_id)`，有单测 |
| D2 | 前端数据层 | `updateChatMessage`、`truncateChatMessages`，浏览器 fallback 同步 localStorage |
| D3 | 编辑交互 | user 消息 hover 显示 Edit，内联编辑保存后更新会话历史 |
| D4 | 重新生成 | 编辑或原消息旁提供 Regenerate；重新生成时截断其后消息，复用当前 Provider/Auto/MOA 模式流式输出并落库 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 消息分叉与版本历史
- 单条消息复制/分享/导出
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] 编辑 user 消息后能保存并替换会话内容
- [x] Regenerate 能截断旧回复并以新模式重新生成
- [x] `verify:ui` 能稳定断言编辑与重新生成
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
