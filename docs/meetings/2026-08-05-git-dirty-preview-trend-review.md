# 2026-08-05 Git dirty 预览与提交趋势评审

## 结论

- `git_change_paths` 剥离 `git status --short` 的 XY 状态前缀并处理 rename 箭头，`GitActivityItem` 新增 `changed_paths`；Projects 的 dirty 行支持 Preview 展开 / 收起实际文件列表。
- `build_commit_trend` 聚合 reflog 全部时间戳为 UTC 日粒度 `commit_trend`，最多保留最近 7 个有提交的日桶；Git activity 卡片新增 7 日趋势条。
- TS fallback 与 Rust 共用同一语义；`verify:ui` / `verify:preview` 的 `gitDirtyPreview` / `gitCommitTrend` 均为 true，`cargo test --lib` 81/81。

## 风险与后续

- 趋势目前固定 UTC 日粒度，未做本地时区 / 周粒度切换；需要更细的节奏分析时可加入 `granularity` 参数。
- dirty 预览只展示路径，不提供逐文件 diff；逐文件 diff 与批量提交内容预览进入下一阶段候选池。
