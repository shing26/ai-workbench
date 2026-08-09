# Sprint 17 计划：消息分叉与版本历史

目标：为 AI Studio 消息增加版本历史：编辑/重新生成前自动保留旧内容，用户可查看版本列表并一键恢复，支持消息分叉回滚。

## Sprint 17 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| V1 | 版本表与 Rust 命令 | `message_versions` 表；`save_message_version` / `list_message_versions` / `restore_message_version`；`update_chat_message` 自动保存旧版本 |
| V2 | 前端数据层 | `saveMessageVersion` / `listMessageVersions` / `restoreMessageVersion`，localStorage fallback 与清理 |
| V3 | 版本 UI | 消息行 History 按钮展开版本面板，显示版本内容与时间，Restore 一键恢复 |
| V4 | 重新生成保留历史 | regenerate 前保存被截断回复的版本 |
| V5 | 自动化验收 | `verify:ui` 新增版本历史与恢复断言；完整验证套件通过 |

## 范围外（进入 Backlog）

- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 剪贴板/日志跨设备同步
- 版本差异对比视图

## DoD 检查单

- [x] Rust 单测覆盖编辑自动版本、版本列表与恢复
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
