# Architecture

## 形态

本地优先的 AI 工作台桌面应用：Tauri 2 + React + TypeScript + Tailwind CSS v4，Rust 后台负责 SQLite、密钥、AI 请求与系统能力。

## 分层

```text
UI 层（React Components + Zustand）
        |
        |
IPC 层（Tauri invoke / events）
        |
        |
Rust 服务层（SQLite、Keyring、AI Gateway、Git 上下文）
        |
        |
外部边界（OpenAI / Ollama / Codex CLI / 本地文件系统）
```

## 5 大主视图

- AI Studio：多模型对话与 MOA。
- Projects：项目管理与 Vibe Coding。
- Knowledge & Inbox：闪念与 Markdown 知识。
- Actions & Schedule：今日 Focus、任务、习惯、日程。
- System & Automation：Provider、剪贴板、日志、自动化。

## UI 动态效果层

- 主切换与交互反馈上限 150ms，只使用 `transform`、`opacity`、`filter`。
- `AppInspector` 为固定宽度右侧浮层，使用 `translateX` 滑入，不做宽度动画。
- BentoCard 使用流体材质伪层与 hover lift，尺寸稳定，无布局抖动。
- 所有连续动画遵守 `prefers-reduced-motion`，JS 动画使用 `matchMedia` 主动降级。
- 习惯/日程卡片支持 pointer tilt（<=7deg）、check-pop 与进度条 `scaleX`，参考 `octopus-kaogong-workbench` 的动效语言但不照搬 3D 轮播。
- UI 改造必须走 `docs/meetings/*-ui-dynamics-design-review.md` 设计评审与 `docs/plans/sprint-*-ui-dynamics.md` 验收清单。

## Tauri IPC 协议

- 命令命名：`snake_case`，例如 `list_tasks`、`create_task`、`list_habits`、`toggle_habit`。
- 事件命名：`snake_case` 事件名，例如 `stream_chunk`、`agent_trace`。
- 所有命令返回 `Result<T, String>`，错误信息不包含密钥。
- API Key 只通过 OS Keyring 存取，SQLite 只保存 Keyring 引用名。

Sprint 3 新增命令：`list_habits`、`create_habit`、`toggle_habit`、`list_schedule_events`、`create_schedule_event`、`toggle_event_done`。

## 数据流

1. 前端通过 Zustand 维护视图状态。
2. 持久化数据通过 IPC 调用 Rust 命令。
3. Rust 负责 SQLite 迁移、示例数据与事务。
4. AI 流式响应通过 Tauri Event 推送到前端。

## 环境隔离

- 开发模式：允许 Dev overlay 与调试面板。
- 生产模式：禁止 Dev Issues 浮标与任何开发遮罩。
