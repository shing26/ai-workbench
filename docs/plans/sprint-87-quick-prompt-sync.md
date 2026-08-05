# Sprint 87 计划：自定义 Quick Prompt 与使用次数多端同步

目标：把 Sprint 86 留下的“多端同步自定义 Quick Prompt 与使用次数”候选池项落地。自定义 Quick Prompt 与使用次数进入 Sync Snapshot，随剪贴板 / 日志一起参与导出、导入、远端 push / pull 与冲突仲裁；浏览器 fallback 继续使用 `ai-workbench:quick-prompts:v1` 与 `ai-workbench:quick-prompt-usage:v1`。

## Sprint 87 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 数据模型 | `SCHEMA` 新增 `quick_prompts` / `quick_prompt_usage` 表；新增 `QuickPrompt` / `QuickPromptUsageEntry` 模型与 list / upsert / delete / record 函数 |
| A2 | Rust 同步协议 | `SyncSnapshot` 增加 `quickPrompts` / `quickPromptUsage`（`#[serde(default)]`）；`build_sync_snapshot` 导出、`merge_sync_snapshot` 按 `updatedAt` 合并 prompt、按 max count 合并 usage，并写入 sync audit 与冲突记录 |
| A3 | 冲突仲裁 | `quick_prompt` 冲突的 local / remote 内容存完整 JSON；`resolve_conflict` / union / structured 均支持 `quick_prompt`，裁决后以当前时间戳回写 |
| A4 | TS 异步 API | `db.ts` 新增 `listQuickPrompts` / `listCustomQuickPrompts` / `loadQuickPromptsByUsage` / `getQuickPromptUsage` / `recordQuickPromptUsage` / `addCustomQuickPrompt` / `deleteCustomQuickPrompt`；Tauri 走 invoke，浏览器走既有 local helpers |
| A5 | 前端接入 | AIStudioView 从同步 `quickPrompts.ts` 调用迁移到 `db.*` 异步 API，初始加载与增删 / 点选刷新均改为 async；保留 `data-quick-prompt*` 属性与排序语义 |
| A6 | 浏览器 fallback | `exportSyncSnapshot` / `pullSyncSnapshot` / `mergeSnapshotIntoLocal` 包含并合并 quick prompt 与 usage；冲突解析函数兼容 `quick_prompt` |
| A7 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `quickPromptSync` / `quickPromptSyncVisible` / `quickPromptSyncPersist` lane：导入含自定义 prompt + usage 的 snapshot，断言 AI Studio 可见、排序与持久化 |

## DoD 检查单

- [x] `cargo fmt`、`cargo clippy --lib -- -Dwarnings`、`cargo test --lib` 全绿（94/94）。
- [x] `npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `quickPromptSync` / `quickPromptSyncVisible` / `quickPromptSyncPersist` 均为 true。
- [x] Rust 单测覆盖 quick prompt + usage 合并与 `quick_prompt` 冲突仲裁。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.87.0-alpha`。

## 范围外（Backlog）

- 不做 Quick Prompt 编辑与拖拽排序；继续留在 Backlog。
- 不做行内着色与 diff 编辑器、整文件对比视图；继续留在 Backlog。
- 不做真实 Provider 端到端流式联调；继续留在 Backlog。
