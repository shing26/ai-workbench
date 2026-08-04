# Sprint 20 计划：消息版本图谱与分支可视化

目标：在版本历史与差异对比基础上增加版本图谱。为 `message_versions` 记录父版本血缘，版本面板以节点连线展示 `v1 → v2 → current` 链路，便于一眼看出分叉与恢复路径。

## Sprint 20 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| G1 | 血缘数据模型 | `message_versions` 增加 `parent_version_id`；编辑/恢复保存版本时记录父版本；迁移兼容旧库 |
| G2 | 图谱 UI | 版本面板新增图谱区：版本节点、连线、current 标记；节点可点击切换 diff 对比 |
| G3 | 动效约束 | 图谱入场动画 <=150ms、仅 transform/opacity/filter、遵守 reduced-motion |
| G4 | 自动化验收 | Rust 单测覆盖父版本血缘；`verify:ui` 新增图谱节点与 current 标记断言 |

## 范围外（进入 Backlog）
- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 自动文件监听与云端同步传输
- 项目级 Git 图谱

## DoD 检查单

- [x] Rust 单测覆盖父版本血缘与迁移
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
