# Sprint 50 计划：同步冲突三方合并

目标：为同步冲突提供 union 合并策略，把本地与远端内容按行并集去重后写回，支持单个合并与批量合并，并留下审计记录。

## Sprint 50 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 合并算法 | `union_merge_content` 按行并集去重、保持 local 优先顺序，空串输入不产生多余换行 |
| A2 | 单个合并 | `resolve_conflict_union` 写回 clipboard/log 为合并内容，`resolved_choice = 'union'`，审计 `sync.resolve.union` |
| A3 | 批量合并 | `resolve_conflicts_union` 单事务执行，提交后审计 `sync.resolve.union.batch` |
| A4 | Tauri 命令 | 注册 `resolve_sync_conflict_union` / `resolve_sync_conflicts_union`，浏览器 fallback 同步实现 |
| A5 | System UI | 冲突项提供 Merge 按钮，批量区提供 Merge all，审计筛选新增 union 事件 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言批量合并成功、union 历史与审计可见、原有 local/remote 路径不回退 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 行并集、单个合并、批量合并单测通过。
- [x] System UI Merge / Merge all 可用，浏览器 fallback 与 Rust 语义一致。
- [x] `verify:ui` / `verify:preview` 断言 union 合并、历史与审计，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.50.0-alpha`。

## 范围外（Backlog）

- watch 目标级事件隔离与独立增量统计。
- 审计按时间范围与设备 ID 组合筛选。
- 索引进度事件与可取消队列。
- 结构化文档（Markdown/JSON）的字段级三方合并。
