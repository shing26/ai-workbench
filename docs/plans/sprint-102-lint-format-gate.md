# Sprint 102 计划：ESLint/Prettier 与 husky/lint-staged 质量门禁

目标：为前端落地代码质量门禁。ESLint flat config + TypeScript/React 规则负责静态检查，Prettier 统一格式，`husky` + `lint-staged` 在 commit 时自动 `eslint --fix` 并格式化；同时把验证脚本、`db.ts` 与三个视图中的 React Hooks 依赖问题清零，让 `npm run lint` 达到 0 errors / 0 warnings。

## Sprint 102 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | lint 配置 | `eslint.config.js` 使用 TS flat config + React Hooks + React Refresh；`npm run lint` 0 errors / 0 warnings |
| R2 | 格式化 | `.prettierrc.json` / `.prettierignore` 覆盖代码与配置文件；`npx prettier --check .` 全绿 |
| R3 | Git 门禁 | `.husky/pre-commit` 调用 `lint-staged`，staged TS/TSX 自动 `eslint --fix` + `prettier --write` |
| R4 | Hooks 清理 | Knowledge / Projects / System 六个 `exhaustive-deps` warning 手修：`useCallback` 稳定加载函数，定时器用 ref 持有最新闭包，Projects 补 `projects` 依赖 |
| R5 | 完整验证 | `npm run build`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`、`verify:preview` 全绿 |

## DoD 检查清单

- [x] `npm run lint` 0 errors / 0 warnings，`npx prettier --check .` 全绿。
- [x] commit 触发 `.husky/pre-commit`，staged 文件自动 lint fix 与格式化。
- [x] `exhaustive-deps` 六个 warning 已逐个手修，未整体关闭规则。
- [x] `npm run build`、Rust 114 单测、`cargo fmt`、`cargo clippy --lib -- -D warnings`、`verify:preview` 全绿。
- [x] 无数据库表结构变更；PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE / SDLC 已更新，tag `v0.102.0-alpha`。

## 范围外（Backlog）

- 会话搜索模糊匹配。
- MOA 三路结果共识摘要与 Provider 权重 / 路由排序。
- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）继续搁置，后续有需要再开发。
