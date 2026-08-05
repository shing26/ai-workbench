# 2026-08-05 Quick Prompt 多端同步评审

## 结论

- Rust 新增 `quick_prompts` / `quick_prompt_usage` 表与 `QuickPrompt` / `QuickPromptUsageEntry` 模型；`list_quick_prompts` / `add_custom_quick_prompt` / `delete_custom_quick_prompt` / `list_quick_prompt_usage` / `record_quick_prompt_usage` 5 个 Tauri 命令已注册。
- `SyncSnapshot` 增加 `quickPrompts` / `quickPromptUsage` 字段；`build_sync_snapshot` / `merge_sync_snapshot` 支持 prompt 按 `updatedAt` 合并、usage 按 max count 合并，结果写入 `SyncResult` 新增计数与 sync audit。
- `quick_prompt` 冲突 local / remote 内容存完整 JSON，`resolve_conflict` / union / structured 三种仲裁均支持该 kind，裁决后回写并以当前时间戳胜出。
- TS 侧 `db.ts` 新增 7 个异步 API，AIStudioView 已迁移到 `db.*`；浏览器 fallback 继续使用 `ai-workbench:quick-prompts:v1` 与 `ai-workbench:quick-prompt-usage:v1`，同步导出 / 导入 / 冲突解析兼容新数据。
- `cargo test --lib` 94/94，fmt、clippy、`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `quickPromptSync` / `quickPromptSyncVisible` / `quickPromptSyncPersist` 均为 true。

## 风险与后续

- 浏览器 fallback 的内置 prompt 仍以硬编码为准，远端内置 prompt 内容不覆盖前端；自定义 prompt 与使用次数完整参与同步。
- 本地旧版自定义 prompt 无时间戳，首次导出时按当前时间标记；usage 采用 max count 合并，不会回退。
- Quick Prompt 编辑与拖拽排序、真实 Provider 端到端流式联调继续留在 Backlog。
