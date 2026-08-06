# Sprint 148 计划：Projects / Material 逐卡独立配色记忆

目标：Projects 轮播每张卡片独立记住自己的材质配色；未设置时保持现有按位置循环默认；Tauri 与浏览器 fallback 同构持久化。

## Sprint 148 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| M1 | 数据模型 | `projects` 新增 `material TEXT NOT NULL DEFAULT ''`；新库 SCHEMA 直接建列，旧库 `migrate_project_material` 幂等补列并加入 `init_connection` 迁移链。 |
| M2 | 持久化命令 | 新增 `update_project_material(id, material)` Tauri 命令，仅接受 cyan / original / rain / chrome / 空串，返回最新 Project；`db.ts` fallback 更新 `ai-workbench:db:v1` 的 projects。 |
| M3 | 逐卡渲染 | 卡片 `data-carousel-material` 优先读 `project.material`，空值回退到按索引循环预设；选中卡详情条提供 Auto + 4 个材质 swatch。 |
| M4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `carouselMaterialMemory` lane：切换材质、持久化、reload 恢复、Auto 还原；Rust 单测覆盖迁移与非法值钳制。 |
| M5 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八门禁全绿后合入 develop。 |

## DoD 检查单

- [x] 旧库打开后 `projects.material` 自动补列且默认空串。
- [x] 选中卡片切换材质后立即生效并持久化，reload 保持不变。
- [x] Auto 清除逐卡记忆，回到按位置循环默认。
- [x] `verify:ui` / `verify:preview` 的 `carouselMaterialMemory` lane 双端通过。
- [x] 八门质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；其余候选留在候选池。
