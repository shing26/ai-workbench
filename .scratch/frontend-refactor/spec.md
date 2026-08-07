# Frontend Refactor — ADR-001 前端落地 Spec

**Status:** ready-for-agent

## Problem Statement

v1.0 前端是"功能完备的壳，而非状态驱动的引擎"：切视图丢草稿、MOA 浏览器模式死锁、任务只增不减、SystemView 9 卡平铺无焦点、LUI（CommandPalette）是死代码、权限确认只在 UI 层。双代理 UX 审查 + ADR-001 定稿确认这些是真实缺陷。

## Solution

按 `docs/plans/frontend-refactor-adr001.md`（Q1–Q16 决策矩阵权威源）实施：Sprint 0 完成 v1.0 P0 修复（ADR 前置），Sprint 1–3 落地本地 MoA 编排器的前端改造——全视图保活、LUI 万能入口、三层视觉层级 + Live Event Stream、permission_rules 前端预检、Web Locks、MOCK_ALL_AGENTS。

## 依赖与顺序

- **Sprint 0 必须先行**（P0 是 ADR 前置，未完成不得进入 Sprint 1）。
- Sprint 1 → 2 → 3 按决策矩阵 Q 编号，后端 fsm_nodes（Sprint 2）依赖 Rust 侧同交付。

## 关键约束

- 双端同构：浏览器 fallback 与 Rust 同语义。
- 确认门在 Rust 层，前端 `usePermissionGuard` 只做 UX 预检。
- 动效遵守冻结契约（<=150ms，transform/opacity/filter，reduced-motion）。
- 不新增色彩体系（Token 冻结），Projects 为唯一平铺特例（tier=grid）。
- 用户文件 `package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts` 保持原样不提交。

## 验收

- 8 项既有质量门全绿 + 新增 lane：`commandPaletteEntity` / `viewStatePersist` / `fsmVisualization` / `permissionDenied` / `fsmPipelineMock`。
- 每视图可回答"焦点在哪"；80% 日常操作 3 次按键内。
