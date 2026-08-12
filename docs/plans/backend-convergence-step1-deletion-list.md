# Backend Convergence Step 1 - Deletion List

Date: 2026-08-12
Repo: `D:\ai-workbench` (branch `develop`)

状态：**已执行完成**（2026-08-12）。

前端已按单页 HTML 严格收敛为 5 个空间：Dashboard / Projects / AI Studio / Actions / Knowledge。以下 Rust 命令与模块已无前端调用，属于孤儿代码。Step 1 只清理 Rust 侧命令层，`src/lib/db.ts` 的浏览器 fallback 包装与 `src-tauri/src/db.rs` 的底层函数保留到 Step 2 再统一移除。

## 执行结果

- `src-tauri/src/lib.rs`：10008 行 -> 6736 行（约删 3272 行）。
- 删除 `src-tauri/src/webhook_condition.rs`、`src-tauri/src/webhook_template.rs`。
- `src-tauri/src/db.rs` 顶部增加 `#![allow(dead_code)]`（Step 2 删除孤儿 DB 函数后移除）。
- 保留 `deliver_webhook_http`、`webhook_signature`、`WebhookDeliveryResult`：事件转发 worker 仍使用它们做通用 HTTP POST。
- `emit_event_bus_event` 不再触发 webhook，`webhook_deliveries` 固定为 0。
- 质量门：`cargo check` ✅、`cargo clippy --all-targets --all-features -- -D warnings` ✅、`cargo test` 186/186 ✅、`cargo fmt --check` ✅。

## 1. 删除整个模块文件

- `src-tauri/src/webhook_condition.rs`
- `src-tauri/src/webhook_template.rs`
- `src-tauri/src/lib.rs` 顶部对应的 `mod webhook_condition;` / `mod webhook_template;`

## 2. Webhook（命令 + worker + helper + 测试）

从 `invoke_handler` 删除以下命令：

`deliver_webhook`, `verify_webhook_signature`, `list_webhook_rules`, `create_webhook_rule`, `set_webhook_rule_enabled`, `list_webhook_template_versions`, `save_webhook_template_version`, `restore_webhook_template_version`, `validate_webhook_payload_template`, `delete_webhook_rule`, `run_webhook_rule`, `list_webhook_rule_runs`, `trigger_webhook_event`, `list_webhook_deliveries`, `retry_webhook_delivery`, `delete_webhook_delivery`, `clear_webhook_deliveries`, `get_webhook_retention_config`, `set_webhook_retention_config`, `prune_webhook_deliveries`, `get_webhook_delivery_stats`, `get_webhook_channel_config`, `set_webhook_channel_config`, `test_webhook_notification`, `test_webhook_email`, `probe_webhook_recovery`

连带删除：

- `spawn_webhook_delivery_worker` 及其在 `.setup()` 中的调用
- `deliver_webhook_http`, `deliver_webhook_email`, `webhook_signature`, `verify_webhook_signature`, `emit_webhook_notification`, `webhook_recovery_backoff_ms`, `render_webhook_payload`, `trigger_webhook_event`
- `run_webhook_rule_inner` 及 `#[cfg(test)] mod tests` 中所有 webhook 测试（约 `lib.rs:7772-9900` 区段）

## 3. Vault Watch（文件监视）

从 `invoke_handler` 删除：

`start_vault_watch`, `start_vault_watch_ex`, `stop_vault_watch`, `list_vault_watch_targets`, `upsert_vault_watch_target`, `delete_vault_watch_target`, `list_vault_watch_events`, `clear_vault_watch_events`, `get_vault_watch_status`, `get_vault_watch_config`, `set_vault_watch_config`

连带删除：

- `start_vault_watcher`（含 `vault_watch_status` helper）
- `start_vault_watch_impl`, `stop_vault_watch_impl`, `restore_vault_watch` 及其在 `.setup()` 中的调用
- `#[cfg(test)]` 中 `vault_watch_*` 测试

## 4. Vector / Embedding / Knowledge 聚类

从 `invoke_handler` 删除：

`get_rag_index_status`, `get_embedding_config`, `set_embedding_config`, `get_vector_index_status`, `rebuild_vector_index`, `get_knowledge_cluster_status`, `recompute_knowledge_clusters`, `dismiss_knowledge_duplicate`, `merge_knowledge_duplicate`, `index_vault`, `index_vault_ex`, `start_vault_index`, `cancel_vault_index`, `get_vault_index_queue_status`, `get_knowledge_index_status`, `recommend_index_concurrency`, `list_vault_target_stats`, `list_knowledge_files`, `cleanup_knowledge_files`

注意保留 `search_thoughts`（AI Studio 与全局搜索仍使用）与 `record_thought_reference` / `open_obsidian`。

## 5. 快捷提示（Quick Prompts）

从 `invoke_handler` 删除：

`list_quick_prompts`, `add_custom_quick_prompt`, `update_custom_quick_prompt`, `reorder_custom_quick_prompts`, `delete_custom_quick_prompt`, `list_quick_prompt_usage`, `record_quick_prompt_usage`

## 6. RAG 来源偏好

Rust 侧没有对应命令（`RagSourcePreference` 仅存在于 `src/lib/db.ts` 的 localStorage 实现），Step 1 无需删除；Step 2 清理 db.ts 时一并移除。

## 7. 会话管理（保留核心 4 个命令）

从 `invoke_handler` 删除：

`search_sessions`, `rename_session`, `set_session_pinned`, `set_session_archived`, `duplicate_session`, `update_chat_message`, `truncate_chat_messages`, `save_message_version`, `list_message_versions`, `restore_message_version`, `diff_message_version_with_current`, `save_message_aux`, `list_message_aux`

必须保留：`list_sessions`, `create_session`, `delete_session`, `save_chat_message`, `list_chat_messages`（AI Studio 历史回溯使用）。

## 8. Habits / Schedule（前端已删除）

从 `invoke_handler` 删除：

`list_habits`, `create_habit`, `toggle_habit`, `update_habit_week_goal`, `delete_habit`, `list_schedule_events`, `create_schedule_event`, `toggle_event_done`, `get_actions_bundle`

## 验证方式

删除后依次执行：

```powershell
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

再跑前端 8 项门：

```powershell
npm run build
npm run lint
npx prettier --check "src/**/*.{ts,tsx,css}" scripts/*.mjs
npm run verify:ui
npm run verify:preview
```

Step 1 后测试基线为 186/186（删除了被移除功能对应的 43 个 lib 测试，db.rs 底层测试全部保留）。
