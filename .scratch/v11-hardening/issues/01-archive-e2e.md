# 01 — 归档旅程端到端自动化

**What to build:** 从 CPO 视角打通一条无人值守的归档验证：UI 自动化新建项目、归档项目，然后在 Knowledge 视图断言对应归档卡片出现。

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] UI 自动化可新建项目并触发归档，项目旅程阶段变为 `archived`
- [ ] Knowledge 视图出现该项目对应的归档卡片，卡片带 `archived` 标记
- [ ] 既有 5 视图、Dashboard 三栏、modals 验证仍全部通过

## Comments

2026-08-13：`scripts/ui-verify.mjs` 新增 archive lane，断言 Knowledge 卡片包含项目名与归档标记，`node scripts/ui-verify.mjs` 通过。
