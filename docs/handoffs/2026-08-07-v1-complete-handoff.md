# AI Workbench Handoff

日期：2026-08-07
仓库：D:\ai-workbench（分支 `develop`）

## 当前状态

- 项目已到达 v1.0 终点：Backlog 候选池清空 + 8 项质量门全绿 + v1.0 发布文档，目标已标记 complete。
- 最新提交：`4aef24c`（Merge sprint 156: vector shard centroids and approximate ANN search）。
- Sprint 156 已完成向量分片质心与近似索引（ANN）搜索，详细验收标准见 `docs/plans/sprint-156-vector-ann-shards.md`，此处不重复。

## 关键产物与引用

- `docs/RELEASE-v1.md`：v1.0 发布范围、8 项质量门结果、已知限制、遗留搁置模块。
- `docs/plans/BACKLOG.md`：候选池已清空，Sprint 156 已移入已完成列表。
- `docs/plans/RETRO.md`：Sprint 156 复盘。
- `docs/plans/sprint-156-vector-ann-shards.md`：Sprint 156 任务表与 DoD。
- `docs/ARCHITECTURE.md` / `docs/DATABASE.md`：架构与 SQLite 表结构的最新说明。
- `CONTEXT.md`：领域上下文。

## 质量门复验结果

最终代码状态复验全绿：`npm run build`、`npm run lint`、`npx prettier --check .`、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test --lib`（203/203）、`npm run verify:ui`、`npm run verify:preview`。

备注：
- `verify:preview` 曾有一次 `syncAudit` 偶发时序失败，重跑通过。
- `providerModelCatalog` lane 已加固等待检测按钮与 options 的加载逻辑，降低偶发失败。
- `verify:ui` / `verify:preview` 共用 `scripts/ui-verify.mjs`；新增 `vectorAnnSearch` lane。

## 工作区注意事项

- 以下文件是用户改动，保持原样、不要提交：`package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts`。
- 浏览器 fallback（`src/lib/db.ts`）与 Rust 后端（`src-tauri/src/db.rs`）保持同构，改动搜索/索引/同步逻辑时两端都要同步。
- 当前有一个 dev server 在 http://localhost:1420（node 进程），浏览器模式可直接访问。
- 启动方式：浏览器模式 `npm run dev`；桌面模式 `npm run tauri dev`；打包 `npm run tauri build`。

## 遗留与后续方向

- Connection Layer（信号通知层）：用户明确搁置，后续有需要再开发。
- Monetization Workbench（创收工作台）：同上。
- 已知限制与后续迭代建议见 `docs/RELEASE-v1.md`，例如真实 ANN 索引落盘、RAG 混合分页、System 自动化编排。
- 不要假设 Backlog 还有未完成项；新范围需先与用户确认。

## suggested skills

- 继续开发新模块（Connection Layer / Monetization Workbench 等）：`implement`
- 排查运行或测试问题：`diagnosing-bugs`
- 代码审查或合并前自检：`code-review`
- 把新方向拆成 ticket / spec：`to-spec`、`to-tickets`
- 复盘或写开发流程文档：`handoff`、`research`
