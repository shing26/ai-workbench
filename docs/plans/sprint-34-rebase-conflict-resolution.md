# Sprint 34 计划：Git 冲突自动解决与三方合并

目标：把 Sprint 31 的“冲突检测 + abort”升级为可执行冲突解决：`ours` / `theirs` 直接保留单侧版本，`union` 使用 Git 索引中的 base / ours / theirs 三方内容做并集合并；解决后自动 `git rebase --continue`。

## Sprint 34 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 冲突解决命令 | `resolve_rebase_conflicts(path, strategy)` 支持 `ours` / `theirs` / `union`，解决后自动 `GIT_EDITOR=true git rebase --continue` |
| A2 | 端到端单测 | 真实仓库覆盖：`theirs` 保留 main 版本并续跑成功；`union` 合并双方新增行且无冲突标记；未知策略报错 |
| A3 | Projects UI | 冲突结果旁新增 Take feature / Take main / Union merge 三个策略按钮，解决后回显结果并刷新 Git 图谱 |
| A4 | 自动化验收 | `verify:ui` / `verify:preview` 断言 Hermes 项目 Rebase 触发冲突、Union merge 后显示 Resolved 与 continued rebase |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy 全绿。
- [x] `ours` / `theirs` / `union` 三条真实 Git 仓库链路单测通过。
- [x] 浏览器 fallback 下冲突出现、策略解决、结果可见。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.34.0-alpha`。

## 范围外（Backlog）

- 逐文件冲突预览与人工编辑合并。
- Vault 大目录并行扫描与 ignore 列表。
- 同步快照定时自动同步与冲突 UI。
