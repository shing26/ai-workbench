# 03 — vitest 单元测试与验证矩阵接线

**What to build:** 建立前端单元测试基础：为纯 helper/store 增加最小 vitest 用例，新增 `test:unit` 与 `verify:matrix` npm scripts，并让验证矩阵的 L2 实际运行 vitest。

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] `npm run test:unit` 可运行且通过
- [ ] `npm run verify:matrix` 可运行，L2 包含 vitest 并计入结果
- [ ] `lint`、`build`、prettier 保持全绿

## Comments

2026-08-13：vitest 2 个测试文件 4 条用例通过；`npm run verify:matrix` L1-L4 全绿，L2 含 vitest。
