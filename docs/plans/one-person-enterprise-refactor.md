# One-Person Enterprise Refactor 落地计划

## 目标

以 Prism Station v1.2.3 模板为视觉与信息架构基准，把当前 5 视图工作台重构成“一人公司产品生命周期”闭环：CPO（用户）提出想法 → Studio 用 The Agency 专业 Agent 组成团队做两轮论证并产出旅程文档 → Actions 派发 CLI 实现 → 四级验证 → 手动归档到 Knowledge → 新建项目时检索复用旧旅程。前后端（Rust + 浏览器 fallback）逻辑保持同构。

## 当前基线（2026-08-12）

前端已严格收敛为 5 视图，后端孤儿代码 Step 1/2 已清理；Sprint 1-5 已完成并通过全部质量门：`build`、lint、prettier、`cargo fmt --check`、clippy、`cargo test`（133/133）、`verify:ui`、`verify:preview`、`verify:matrix`、`audit-contract` 当前全绿。候选池已清空，v1.0 发布文档见 `docs/releases/v1.0.0.md`。

## 已确认决策（grill 结论）

- **Q1**：模板为视觉基准，核心重构点是旅程闭环。
- **Q2 / ADR-003**：`Project` 增加持久化 `journeyStage`：`idea → discussing → ready → building → archived`；`status` 仅保留 `active/paused`。
- **Q3 / ADR-005**：Agent 团队来源为 The Agency 目录（255 个 Agent、17 个 Division、MIT），替代自建部门/员工组织模型；ADR-002 被取代。
- **Q4 / ADR-004**：单一产物「旅程文档」，Knowledge 卡片是索引视图，CLI 引用同一文档。
- **Q5**：手动归档 + 自动生成归档总结；归档卡片豁免活性衰减，可重新打开。
- **Q8**：两轮式论证：第一轮并行独立发言，第二轮 LLM 汇总出分歧/共识/风险/结论草案，CPO 确认定稿。
- **Q9**：内置 5 个团队预设 + 自由搜索/多选组队 + 自定义预设保存。
- **Q10**：旅程文档单文件七区块模板（背景与目标 / PRD 要点 / 设计决策 / 风险与 Trade-off / 论证结论 / 交付任务清单 / 实现与验证记录）。
- **Q11**：P0 只做旅程闭环，砍掉 Token 趋势、知识覆盖率、依赖链、活性衰减、组织模型。
- **Q13 / Q14**：交付 CLI 核心为 Claude Code / Aider / Codex，移除 Prism；新增 `detect_cli_tools` 自动探测安全白名单内本地 CLI（含 gemini / opencode / qwen / cursor / windsurf 等常见 CLI）。
- **Q15 / ADR-006**：四级验证矩阵 + 自动修复回环（默认人工确认，最多 2 轮）。

## P0 MVP 范围

1. `Project` 增加 `journeyStage` 与 `journeyDocPath`。
2. The Agency 目录导入：frontmatter + 精简 developer instructions + Division 元数据；5 个团队预设。
3. Studio 两轮论证 → 生成/更新旅程文档 → CPO 确认定稿。
4. Actions：CLI 自动识别；任务挂旅程文档；`v` 键触发四级验证；失败自动组装修复 Prompt（确认后重派）。
5. 归档：手动触发 → 生成归档总结 → Knowledge 索引；归档文档豁免衰减；可重新打开。
6. Knowledge：新建/打开项目时检索关联旧旅程文档。

## 完成定义（终点）

按已认可定义：范围冻结后的全部 P0 候选项完成 + 质量门全绿 + v1.0 发布文档。每做完一个 Sprint 就从候选池移除对应项，直到池子清空。Connection Layer、Monetization Workbench 与 P0 明确砍掉的功能不计入终点。

### 候选池（勾选即移除）

- [x] `Project.journeyStage` / `journeyDocPath` 双端同构落地。
- [x] The Agency 目录导入 + Division 元数据 + 5 个团队预设。
- [x] Studio 两轮论证 + 七区块旅程文档生成/确认。
- [x] Actions CLI 自动识别 + 任务挂旅程文档 + 四级验证 + 自动修复回环。
- [x] 手动归档 + Knowledge 索引/反哺 + 重新打开。
- [x] 前后端契约审计（`scripts/audit-contract.mjs`）+ `verify:matrix` 脚本 + v1.0 发布文档（`docs/releases/v1.0.0.md`）。

## Sprint 拆分建议

- **Sprint 1（数据模型）**：`Project.journeyStage` / `journeyDocPath`、`agent_catalog`、`team_preset`、`cli_tool` 的 SQLite migration 与 localStorage fallback，双端单测。
- **Sprint 2（团队与论证）**：Agency 导入脚本与 seed、Division 筛选、5 个团队预设、Studio 两轮论证、旅程文档生成与 CPO 确认。
- **Sprint 3（交付与验证）**：`detect_cli_tools`、任务挂旅程文档、`verify:matrix` 四级验证、自动修复回环（最多 2 轮）。
- **Sprint 4（归档与知识）**：手动归档、Knowledge 索引与重新打开、新建项目检索旧旅程并注入上下文。
- **Sprint 5（收敛与发布）**：移除 Prism 残留与 P0 外 UI、前后端契约审计、质量门全绿、v1.0 发布文档。

## 实施步骤

### 1. 数据模型与双端同构

- `src/lib/db.ts` + `src-tauri/src/db.rs` 同步新增：
  - `Project.journeyStage`（`idea | discussing | ready | building | archived`）、`journeyDocPath`。
  - `agent_catalog`（division / name / slug / description / emoji / color / developer_instructions / tools / source_url）；`team_preset`（id / name / agent_slugs）。
  - `cli_tool` 探测缓存（bin / label / detected / last_checked_at）。
  - SQLite migration + localStorage fallback 同步，`cargo test` 与浏览器验证双端覆盖。

### 2. The Agency 目录导入

- 新增导入脚本（`scripts/import-agency-agents.mjs`）：解析 `.reasonix/agency-agents/**/*.md` 的 frontmatter，从正文提取精简 developer instructions（复用仓库 codex-toml 的 `name/description/developer_instructions` 思路），输出 seed JSON。
- `divisions.json` 元数据（label / icon / color）转为前端展示源。
- 首次启动 seed 全量 255 个 Agent；后续支持“重新导入更新”。

### 3. Studio 论证与旅程文档

- 目录视图：Division 筛选 + 搜索 + 5 个团队预设（产品评审团 / 技术方案团 / 全栈落地团 / 质量安全门 / 极简快评团）+ 自由多选 + 保存自定义预设。
- 两轮论证：第一轮复用现有 `sendAiMessageStream` 并行发言；第二轮调用汇总 LLM（复用/改造 `buildTeamSummary` / `buildMoaConsensus`）输出结构化结论草案。
- “固化为旅程文档”：写入项目 `docs/journey/<slug>.md`，frontmatter + 七区块模板；CPO 确认后 `journeyStage: discussing → ready`。

### 4. 交付终端

- CLI 自动识别：Rust 新增 `detect_cli_tools` 命令（PATH 查找 + `--version` 探活，白名单包含 claude / aider / codex / gemini / opencode / qwen / cursor / windsurf），前端启动探测 + 手动刷新；UI 选择器与 Rust 白名单对齐，移除 Prism。
- 任务挂旅程文档：CLI 命令模板引用 `journeyDocPath`，替换现在硬编码的 `docs/plans/sprint-8.md`。
- 四级验证：`v` 键依次执行 L1（tsc / cargo check / clippy / eslint）→ L2（cargo test / vitest）→ L3（`verify:ui` CDP + 视觉基线比对）→ L4（Agency QA/CISO Agent 审 `git diff` vs DoD）；任一级失败即阻断并展示错误日志。
- 自动修复回环：失败后一键“自动修复”，组装 `验证未通过 + 错误日志 + 旅程文档路径` 的 Prompt 重派 CLI，最多 2 轮，每轮需 CPO 确认。

### 5. 归档与知识反哺

- 手动“归档旅程”：汇总旅程文档 + CLI run 记录 + DoD 完成情况生成归档总结，写入 Knowledge；`journeyStage: building → archived`。
- 归档卡片带 `archived` 标记，豁免活性衰减；可一键重新打开回 `ready` / `discussing`。
- Knowledge 新建/打开项目时，用现有语义搜索检索关联旧旅程文档并注入论证上下文。

### 6. 清理与收敛

- 前端移除 Prism CLI 选项与 `prism-cli` 命令模板。
- 砍掉 Token 7 天趋势、知识覆盖率、Blocked 依赖链、活性衰减、部门/员工组织 UI。
- 按上轮 AST 审计结果，视情况清理 `db.ts` 97 个不可达导出及对应 Rust 死命令（独立 Step 3，不影响 P0）。

## 验收标准（AC）

1. 新建项目无路径可处于 `idea`；发起 Studio 论证后进入 `discussing`；定稿后进入 `ready`。
2. Studio 可从 255 个 Agent 中按 Division/搜索组队，5 个预设一键入席；两轮论证后能生成七区块旅程文档。
3. Actions 能自动识别已安装 CLI 并只展示可用项；`v` 键可跑四级验证并展示每级结果。
4. 验证失败时一键重派修复，最多 2 轮；成功或达到上限后停止。
5. 归档生成总结并出现在 Knowledge；归档卡片豁免衰减；重新打开后阶段正确。
6. 新建项目可检索到相关旧旅程文档并注入 Studio 上下文。
7. 前后端契约审计全绿：新增命令均在 Rust `invoke_handler` 注册，`db.ts` fallback 同构。

## 质量门

`tsc`、eslint、prettier、build、`cargo fmt --check`、clippy、`cargo test`、`verify:ui`、`verify:preview` 全绿；新增 `verify:matrix` 脚本串联四级验证（可用 `MOCK_ALL_AGENTS` 降级 L4）。

## 风险与假设

- The Agency 按 MIT 引入，保留出处与 LICENSE 说明；全量 255 个 Agent 用搜索/筛选承载，不铺平 UI。
- vitest 本轮先搭最小测试框架（store/工具函数），不追求覆盖全部 UI。
- 自动修复默认人工确认，避免无人值守的 token 消耗。
- 用户脏文件（`package.json`、`searchHistory.ts`、`tokenBudget.ts`、`Cargo.toml`）如需改动需单独确认。
