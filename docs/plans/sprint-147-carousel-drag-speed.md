# Sprint 147 计划：Projects 轮播拖拽排序与速度滑杆

目标：让 Projects 轮播支持拖拽换位，并用滑杆控制自动播放速度；排序与速度偏好均持久化，Tauri 与浏览器 fallback 同构。

## Sprint 147 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | 排序数据模型 | `projects` 新增 `sort_order` 列；新库 SCHEMA 直接建列，旧库 `migrate_project_sort_order` 按 created_at 倒序回填，已加入 `init_connection` 迁移链。 |
| P2 | 排序持久化 | `reorder_projects` 按传入 id 顺序更新 `sort_order`；新增 Tauri 命令，`db.ts` fallback 重排 `ai-workbench:db:v1` 的 projects 数组。 |
| P3 | 拖拽交互 | 轮播卡片拖拽手柄支持 pointer 拖拽，超过半个卡片宽度即换位；拖拽期间暂停自动播放并抑制点击跳转，结束后持久化顺序。 |
| P4 | 速度滑杆 | 自动播放速度 1~10 滑杆，速度按 `0.00055 * speed` 推进；持久化到 `ai-workbench:carousel-speed:v1` 并在重载后恢复。 |
| P5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `carouselReorder` lane；Rust 单测覆盖迁移回填、reorder 持久化与 create 续排。 |
| P6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八门禁全绿后合入 develop。 |

## DoD 检查单

- [x] 旧库打开后 `projects.sort_order` 自动补列并按时间回填。
- [x] 拖拽换位后项目顺序持久化，重载保持不变。
- [x] 速度滑杆修改后自动播放速度生效并持久化，重载恢复。
- [x] `verify:ui` / `verify:preview` 的 `carouselReorder` lane 双端通过。
- [x] `npm run build` / lint / prettier / `cargo fmt --check` / clippy / `cargo test --lib` 全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；Projects / Material 逐卡配色记忆等候选留在候选池。
