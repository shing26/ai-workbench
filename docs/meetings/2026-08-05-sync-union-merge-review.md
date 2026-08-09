# 2026-08-05 同步冲突三方合并评审

## 结论

- 新增 `union_merge_content`：按行并集去重，local 行保持原顺序，remote 新增行追加；空串输入不再产生前导换行。
- `resolve_conflict_union` 写回合并内容并标记 `resolved_choice = 'union'`，审计记录 `sync.resolve.union`；`resolve_conflicts_union` 用 `unchecked_transaction` 批量提交并追加 `sync.resolve.union.batch`。
- 前端 `resolveSyncConflictUnion` / `resolveSyncConflictsUnion` 双通道实现；System Sync card 新增单个 Merge 与 Merge all，审计筛选增加 union 事件选项。
- 验证覆盖：`cargo test --lib` 53/53，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言 Merge all 成功、resolved 历史出现 union、原有 Keep local/remote 路径不回退。

## 风险与后续

- 行级 union 对长文本可能产生重复段落，后续可为 Markdown/JSON 做字段级合并。
- 批量合并审计同时包含单个 union 事件与 batch 事件，导出筛选可按事件前缀扩展。
