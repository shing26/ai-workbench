# 2026-08-05 Quick Prompt 编辑与排序评审

## 结论

- `quick_prompts` 新增 `sort_order` 列：SCHEMA 直接包含该列，旧库通过 `migrate_quick_prompt_order`（ALTER TABLE + 按 rowid 回填）平滑升级；`QuickPrompt.order` 通过 serde 进入同步快照，兼容 Sprint 87 协议。
- 新增 `update_custom_quick_prompt` / `reorder_custom_quick_prompts` 两个 Tauri 命令；编辑拒绝非 custom 行，重排在单事务内把 `sort_order` 重编号为 0..n-1。
- `db.ts` 新增对应异步 API，浏览器 fallback 继续使用 `ai-workbench:quick-prompts:v1`；`loadQuickPromptsByUsage` 排序为使用次数降序 + `order` 升序，Sprint 79 / 87 的既有排序与同步断言全部保持。
- AIStudioView Manage 面板升级为行式列表：dnd-kit 拖拽手柄、编辑按钮、上下箭头、删除按钮；编辑态复用顶部表单，显示 Save / Cancel。
- `cargo test --lib` 95/95，fmt、clippy、`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `quickPromptEditSort` / `quickPromptEditSortPersist` 均为 true。

## 风险与后续

- 内置 Quick Prompt 仍为前端硬编码，不参与编辑与拖拽，避免覆盖产品默认文案。
- 拖拽排序提供上下箭头作为键盘 / 测试兜底；dnd-kit 手柄负责真实拖拽体验。
- 行内着色与 diff 编辑器、真实 Provider 端到端流式联调继续留在 Backlog。
