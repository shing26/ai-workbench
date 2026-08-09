# 2026-08-05 Git 冲突自动解决与三方合并评审

## 结论

- `resolve_rebase_conflicts(path, strategy)` 支持三种策略：`ours` 保留被 rebase 分支、`theirs` 保留目标分支、`union` 使用 `git merge-file -p --union` 合并 base / ours / theirs 三方内容；解决后以 `GIT_EDITOR=true git rebase --continue` 自动续跑。
- 策略实现直接读取 Git 索引 stage 内容写回工作区，避免 `git checkout --ours/--theirs` 在 rebase 下语义反转带来的误用。
- 端到端单测覆盖真实仓库：theirs 解决并完成 rebase、union 保留双方新增行且无冲突标记、未知策略报错；`cargo test --lib` 35/35，fmt、clippy、build 全绿。
- Projects Git 图谱在冲突时展示 Take feature / Take main / Union merge / Abort rebase；`verify:ui` / `verify:preview` 新增冲突出现与 union 解决断言，两条 lane 全绿。

## 风险与后续

- union 策略适合机械并集合并，语义化冲突仍需人工编辑，逐文件冲突预览留在 Backlog。
- 下一 Sprint 候选：Vault 大目录并行扫描与 ignore 列表、同步快照定时自动同步与冲突 UI。
