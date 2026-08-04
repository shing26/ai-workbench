# Sprint 12 计划：AI Studio 会话管理

目标：在 Sprint 11 多会话持久化基础上补齐会话管理：重命名、删除、搜索，让会话栏从只读列表变成可维护的会话工作台。

## Sprint 12 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust 命令 | 新增 `rename_session(id, title)`、`delete_session(id)`；删除时 `chat_messages` 级联清理，均有单测 |
| D2 | 前端数据层 | `renameSession`、`deleteSession`，浏览器 fallback 同步更新 localStorage |
| D3 | 会话搜索 | 会话栏顶部新增搜索框，按标题/模型过滤列表，无结果时显示空态 |
| D4 | 重命名/删除 | 会话项 hover 显示重命名与删除操作；重命名使用内联编辑，删除需确认后执行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 消息编辑与重新生成
- 会话导出/合并
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] Rust 重命名/删除命令有单测且级联删除生效
- [x] 会话栏支持搜索、重命名、删除，删除后消息不再出现
- [x] `verify:ui` 能稳定断言会话管理交互
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
