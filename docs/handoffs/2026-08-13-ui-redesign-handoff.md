# AI Workbench Handoff - UI Redesign 按稿重构

日期：2026-08-13
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-12-sprint5-handoff.md`
设计稿：`preview-redesign.html`
设计评审：`docs/meetings/2026-08-13-ui-redesign-design-review.md`

## 本次目标

把 React 版旅程指挥台按 `preview-redesign.html` 的组件级结构重做，不再保留旧版堆叠；设计稿样式类用 `pc-` 前缀移植进 `src/index.css`，前后端逻辑不变。

## 已完成

- 五视图按稿重构：Dashboard `pc-stat-row + pc-focus-row + pc-system-strip`；Projects `pc-project-grid + pc-bottom-grid`；AI Studio `pc-studio-grid`；Actions `pc-actions-grid`；Knowledge `pc-kb-toolbar + pc-kb-grid`。
- Header 五段旅程阶段轨（总览 → 构想 → 论证 → 落地 → 归档），Dock lucide 图标导航并支持折叠。
- `src/index.css` 新增约 500 行 `pc-*` 样式，色值收敛到 Prism Token，新增 `pc-graph-view/node/edge` 图谱样式。
- 审查修复：Dashboard 焦点卡改为 badge/title/desc/meta-line；Actions 移除旧本地 CLI 第三面板；Knowledge 工具栏改为内联搜索并移除多余类型筛选 seg，图谱改为节点连线；AI Studio 固化按钮常驻。
- `scripts/ui-verify.mjs` 新增 motion lane：动效 <=150ms、reduced-motion、横向溢出断言。

## 质量门结果（2026-08-13 实跑）

- `npm run lint` ✅
- `npm run build` ✅
- `node scripts/ui-verify.mjs` ✅（5 视图 + modals + motion lane）
- `npm run verify:preview` ✅
- `node scripts/audit-contract.mjs` ✅（0 missing / 0 dynamic）

## 工作区注意

- 浏览器 fallback（`src/lib/db.ts`）与 Rust（`src-tauri/src/db.rs`）必须同构；Rust 侧为用户脏文件，本轮未改。
- 用户脏文件不提交：`src-tauri/Cargo.toml`。
- `data-*` / `aria-label` / `role="dialog"` 是验证契约，后续只能移动位置或换样式，不能删语义。
- dev server：`npm run dev`（浏览器 `localhost:1420`）；桌面：`npm run tauri dev`。

## 下一步建议

1. 归档流程端到端 UI 自动化（创建旅程 → 挂载 → 归档 → Knowledge 卡片出现）。
2. `tauri dev` 实测真实 CLI 探测与 Obsidian 联动。
3. 引入 vitest 并把 `verify:matrix` 接入 npm scripts（需用户确认后修改 `package.json`）。
