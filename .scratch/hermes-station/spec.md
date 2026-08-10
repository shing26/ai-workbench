# Hermes Station — PRD 实施 Spec

**Status:** complete（v1.1-alpha 已封存，Tag `v1.1-alpha`，见 `docs/RELEASE-v1.1-alpha.md`）

## Problem Statement

v1.0.0-alpha 已落地 6 Sprint（5 大 Bento 控制塔 + Local-First 持久化）。本阶段按 PRD（`docs/plans/hermes-station-prd.md`）实施 v1.1+：核心资产安全、工程闭环、极客键盘流、API 热切与 i18n。

## Solution

按价值优先级分 4 个 Sprint 迭代：
- **Sprint 7 — 资产安全优先**：Code Apply 原子写入 + `.hermes/backups` 快照 + ⌘Z 撤销（AC-2.1/2.2）✅
- **Sprint 8 — 工程闭环**：DoD 项目绑定 + Quality Gate + Inline Diff 折叠树（AC-1.2/1.3/3.2）✅
- **Sprint 9 — 极客体验**：Linear 全键盘引擎 j/k/x/p/a + AI 3 步拆解 + MOA 熔断降级（AC-2.3/3.1/3.3）✅
- **Sprint 10 — 稳健与润色**：API 热切 + i18n 热切 + 快照清理（AC-4.1/4.3）✅
  - **Keyring 加固**（AC-4.2 全量审计迁移）→ 重定位 `v1.1.1-patch`，见 `issues/11-s10-keyring-hardening.md`

## 关键约束

- **Local-First**：数据/密钥/模型本地可控，重启无损。
- **资产安全优先**：任何覆盖写入前必须快照备份，可一键撤销。
- **双端同构**：浏览器 fallback 与 Rust 同语义，verify:ui / verify:preview 双端覆盖。
- **8 项质量门**：build/lint/prettier/clippy/test/verify 全绿。
- 用户文件 `package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts` 不提交。

## 验收

- 12 条 AC 全部通过（PRD 第 3 节），AC-4.2 核心已达成（Keyring 全量审计迁移延后至 v1.1.1-patch）。
- 每 Sprint 结束：cargo test + verify:preview 双端绿。
- v1.1-alpha 客户端打包完成（exe + MSI + NSIS），Tag 已推送。
