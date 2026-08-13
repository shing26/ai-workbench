# AI Workbench Handoff - 旅程文档 Deep Module（评审修复后）

日期：2026-08-13
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-13-ui-redesign-handoff.md`

## 本次提交

- `9c22ca2` feat(journey): single-artifact journey doc module with transition rules
- `fcc198a` fix(journey): address review findings for journey doc module

## 本次会话做了什么

1. 完成旅程文档 deep module 实现：`journey-stages.json` 单一真源、`src/lib/journeyDoc.ts` 前端 schema、`src-tauri/src/journey.rs` Rust 校验、`write_journey_doc` Tauri 命令、AI Studio 固化旅程文档、Projects 归档写回同一文档。
2. 按 `/code-review` 双轴审查（Standards + Spec 并行 sub-agents），逐条核对证据。
3. 修复审查发现的问题并重新跑完整质量门。

## 审查结论与修复

Spec/ADR 源：`docs/adr/ADR-004-Journey-Doc-Single-Artifact.md`、`docs/plans/one-person-enterprise-refactor.md`、`CONTEXT.md` 旅程文档词汇。

已修复：
- Knowledge 卡片改为索引视图（`buildJourneyDocIndex` / `buildArchiveIndex`），不再复制整份旅程文档。
- 归档时若项目没有 `journeyDocPath`，用 `buildArchiveJourneyDoc` 生成完整七区块文档（replace），否则 append 到原文档。
- append 更新 frontmatter `updatedAt`；Rust 对空文档也能生成最小 frontmatter。
- Rust `write_journey_doc` 校验 mode；DB 更新失败时回滚已写入文件；统一走 `db::get_project` 避免重复查找。
- 浏览器 fallback `updateProjectJourney` 用 `isAllowedTransition` 执行同一迁移规则。
- AI Studio 复用已有 `journeyDocPath`，不再因项目改名生成新路径。
- 写入后刷新 workbench store 的 projects，避免卡片阶段/路径停留在旧值。

## 质量门（2026-08-13 实跑）

- `npm run lint` / `build` / `test:unit`（13 通过）✅
- `cargo test`（142 通过）+ `cargo clippy -D warnings` ✅
- `npm run verify:matrix` L1-L3 GREEN；L4 AI 语义终审需在 app 内执行（SKIP）✅
- `prettier --check`、`audit-contract`、`desktop-smoke` ✅
- ui-verify 归档契约（`data-project-stage` / `data-project-archive` / `data-prism-card`）保持兼容

## 工作区注意

- 用户脏文件未提交：`src-tauri/Cargo.toml`、`.reasonix/`、`1.html`、`2.html`、`reasonix.toml`。不要回退。
- 浏览器 fallback 的 `writeJourneyDoc` 仍不写文件（与 `writeNote` fallback 一致），只更新 stage/path；Rust 侧写文件。
- 残余风险：`write_journey_doc` 的“原子”是 DB 失败回滚文件，不是跨文件系统 + SQLite 的事务级 crash 原子；如要真事务需引入 intent journal。

## 下一个候选

本线程之前的架构报告未在仓库内找到持久化副本；下一 session 需要：

1. 用 `/improve-codebase-architecture` 重新扫描/确认候选池（或用户提供原报告）。
2. 选定候选后走 `/grill-with-docs` 定决策；multi-session 则 `/to-spec` + `/to-tickets`，再 `/implement`。
3. 每个实现收尾跑 `/code-review`。

## Suggested skills

- `/improve-codebase-architecture`：重扫并确认下一个 deep module 候选
- `/grill-with-docs`：有 codebase 时定下一个候选的决策
- `/to-spec` + `/to-tickets`：multi-session 时拆 tracer-bullet tickets
- `/implement`：按 ticket 落地（内部驱动 `/tdd`）
- `/code-review`：每个候选收尾双轴审查
