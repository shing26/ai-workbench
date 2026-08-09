# 02 — T-702/T-703: Tauri IPC + AI Studio [⚡ Apply] UI

**What to build:** apply_code_snippet / rollback_snapshot IPC 接口 + 前端代码块 Apply/撤销交互 + FILE_UPDATED/FILE_RESTORED 广播。

**Blocked by:** 01 (T-701 backup snapshot)

**Status:** completed

## T-702: IPC 接口（src-tauri/src/file_ops.rs）

```rust
pub struct ApplyResult { success: bool, backup_id: String, file_path: String, diff_delta: String }
#[tauri::command] pub async fn apply_code_snippet(app, project_path, relative_path, code_content) -> Result<ApplyResult, String>
#[tauri::command] pub async fn rollback_snapshot(app, project_path, backup_id) -> Result<bool, String>
```

- 路径安全性校验（防穿越 `../`）→ T-701 阴影快照 → T-701 原子写入 → `app.emit("FILE_UPDATED", relative_path)`
- rollback 读 manifest → `.bak` 覆盖回原文件 → `app.emit("FILE_RESTORED", backup_id)`
- 辅助命令：`list_snapshots` / `prune_snapshots`
- 注册进 invoke_handler（lib.rs）

## T-703: 前端 AI Studio UI

- `src/components/CodeBlock.tsx`：代码块容器，[⚡ Apply]（`data-code-apply-btn`）/ [↩️ 还原]（`data-code-rollback`）/ Copy
- 状态机：`idle → applying → applied`，按钮文案 [正在写入...] → [已写入本地]（还原态）
- `src/components/CodeBlockContent.tsx`：`renderRichContent` 解析 ```` ``` ```` 围栏 → CodeBlock
- AIStudioView 消息渲染改走 renderRichContent（vibeContext.path 作为 projectPath）
- `src/lib/db.ts`：`applyCodeSnippet` / `rollbackSnapshot` / `listSnapshots` / `pruneSnapshots` invoke 封装
- Toast 反馈：成功 `已写入本地 <path> (diffDelta)` / 还原 `已安全还原文件至 Apply 前状态`

## 任务清单（已实现）

- [x] Rust IPC + emit 广播
- [x] 前端 CodeBlock 组件 + renderRichContent + db.ts 封装
- [x] 状态机 + Toast + Copy
- [x] browser fallback 明确 throw（Apply 仅桌面端，避免误用）

## DoD 验收

- [x] 前端调用 apply_code_snippet 成功返回 backup_id 与 diff_delta（Rust 单测 + tsc/lint 保证）
- [x] FILE_UPDATED / FILE_RESTORED 广播已实现（前端 Event Bus 订阅为 Sprint 8 联动点）
- [x] 点击 Apply 状态机切换 + 撤销还原（AC-2.1 / AC-2.2）
