# 2026-08-06 ESLint/Prettier 与 husky/lint-staged 评审

## 结论

- 新增 `eslint.config.js`：ESLint 10 flat config + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`；保留 `react-hooks/exhaustive-deps`，关闭 v7 中过于激进的 `set-state-in-effect` / `refs` / `purity` / `immutability`。
- 新增 `.prettierrc.json` / `.prettierignore`：`printWidth: 100`、`singleQuote`、`trailingComma: all`，排除 `dist`、`node_modules`、`src-tauri` 生成物、docs 与生成 schema；`npx prettier --check .` 全绿。
- `package.json` 新增 `lint` / `format` / `format:check` / `prepare` scripts 与 `lint-staged` 配置；`.husky/pre-commit` 调用 `npx lint-staged`。
- 六个 `exhaustive-deps` warning 清零：Knowledge 加载函数与自动巡检改为 `useCallback`，System 自动同步定时器用 ref 持有最新闭包、`checkAll` 用 `useCallback`，Projects git context effect 补 `projects` 依赖。
- `npm run build`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`（114 通过）、`verify:preview` 全绿。

## 排查记录

- Prettier 首轮 `--write .` 后 `ChatView.tsx` 仍有一处未对齐，单独重写一次后 `prettier --check .` 才全绿；格式验收统一以 `prettier --check` 为准。
- React Hooks v7 新增的 `set-state-in-effect` / `refs` / `purity` / `immutability` 会破坏现有视图语义，明确关闭；`exhaustive-deps` 保留并逐处修复，不整体关闭。
- System 自动同步 interval 若直接依赖每次渲染重建的 `runAutoSync`，会在心跳刷新时反复重建定时器；改用 ref 后 interval 只随开关与周期变化。

## 风险与后续

- 后续提交必须经过 husky/lint-staged；改动 UI、hooks 或验证脚本后重跑 `npm run lint` 与 `verify:preview`。
- 下一 Sprint 候选：会话搜索模糊匹配、MOA 共识摘要、Provider 权重 / 路由排序。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。
