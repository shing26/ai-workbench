# ADR-003: Project Journey Stage（项目旅程阶段）

`Project` 增加持久化的 `journeyStage` 字段，取值为 `idea → discussing → ready → building → archived`；`status` 仅保留 `active/paused` 作为旁路状态。阶段由用户操作显式推进（建项目、会议定稿、派发 CLI、归档），不从任务或会议状态实时推导，以保证旅程进度可追踪、可恢复。

**Considered Options**: 沿用 `status` 表达阶段（无法表达旅程进度）；用任务/会议状态推导阶段（规则复杂且状态恢复不稳定）；故选显式存储。
