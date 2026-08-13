# AI Workbench Handoff - Provider Control (Deep Module)

日期：2026-08-14
仓库：`C:\Users\Shing\.codex\worktrees\ea0d\ai-workbench`
分支：`codex/provider-control`

## 本次提交

- `feat(provider-control)`: add Provider Control deep module and shared selection
- `fix(provider-control)`: support deleting providers
- `docs(provider-control)`: add provider control handoff

## 本次会话做了什么

1. 按上一轮用户确认，选定 Provider Control 作为下一个 deep module。
2. 经 `/grill-with-docs` 有 codebase 的决策流程，写入 `CONTEXT.md` 的 Provider Profile / Provider Test 词汇，以及 `docs/adr/ADR-009-Provider-Control.md`。
3. 新增 `src/lib/providerControl.ts` 与 `src/lib/providerControl.test.ts`，由 `ProviderControlOrchestrator` 统一管理 provider 列表、选中配置、模型缓存、健康检查、流式 smoke test 与 busy/error 状态。
4. 新增 Provider Control modal，支持 OpenAI-compatible / Ollama 预设、新增 provider、启用/停用、选择、模型设置、优先级、超时/重试配置、健康检查、流式测试、模型发现。
5. Header、AI Studio、Actions 共用同一个 Provider Control snapshot；AI Studio 的 roundtable 不再各自计算 provider，缺少 provider 或模型时给出可操作错误。
6. L4 验证门禁在 `QualityGateResult` 中记录当前 Provider Profile，作为审计上下文；Rust 与 browser fallback 保持同构。
7. 修复 browser fallback 早期 `detectCliTools` 写入空 localStorage 导致 seed providers 缺失的问题。
8. 扩展 `scripts/ui-verify.mjs` 的 provider modal 验证，并修复项目输入框 selector 歧义。
9. 跑完整质量门，全部通过后按 Conventional Commits 提交。
10. 根据用户反馈补齐 provider 删除：Provider Control 提供两步确认删除按钮，`ProviderControlOrchestrator` 删除后自动重选下一个可用 provider，并清理模型缓存与健康/smoke 状态。
11. 桌面端新增 `delete_provider` Tauri 命令，删除 provider 时同步清理 `model_metadata`；Rust DB 测试覆盖删除及缓存清理。

## 架构决策

- `ProviderControlOrchestrator` 是前端 deep module，提供 `snapshot / subscribe` 与可注入 adapter。
- Provider 配置、健康检查、流式测试、模型发现都通过 adapter 调用 `db.ts`；Rust/browser 差异仍收在 db 层。
- 选中 Provider 持久化在 `localStorage` 的 `ai-workbench:provider-selection:v1`，刷新后仍生效。
- L4 只展示并记录当前 Provider Profile，不把未实现的真实 AI L4 伪装为已完成。
- 保留既有 `data-*` / `aria-label` 契约，新增 `data-provider-*` 锚点供 UI 验证。

## 审查结论与修复

Spec/ADR 来源：`docs/adr/ADR-009-Provider-Control.md`、`.scratch/provider-control/spec.md`。

已修复：
- `useSyncExternalStore` 需要稳定 snapshot 引用，修复 `getSnapshot()` 每次返回新对象导致的 React 最大更新深度错误。
- Provider Control 需在 `initDb()` 后挂载，否则 browser fallback 首次启动会读到空 provider 列表。
- browser fallback 的 localStorage 首次写入需要先 seed 核心数据，避免 Header CLI 探测提前写入空库。
- `initDb()` 对损坏或空核心数据做恢复性 seed，并用 try/catch 避免 JSON parse 抛错。
- UI verify 的项目输入框 selector 从 `[data-project-name]` 收敛为 `input[data-project-name]`，避免与项目卡同名锚点冲突。
- L4 审计上下文现在会随 `QualityGateResult` 持久化，Actions 优先显示最近一次 gate 记录的 Provider Profile。
- Provider 删除支持在 Rust 与 browser fallback 中同构：删除 provider、清理模型缓存，找不到 provider 时返回明确错误。

## 质量门（2026-08-14 实跑）

- `npm run lint` / `npm run build` / `npm run test:unit`：通过（41 tests）
- `npm run format:check` / `node scripts/audit-contract.mjs`：通过
- `cargo test`：150 通过；`cargo clippy --all-targets --all-features -- -D warnings` + `cargo fmt --check`：通过
- `npm run verify:matrix`：L1-L4 GREEN；preview-verify 覆盖 Provider modal 通过

## 工作区注意

- 未提交用户脏文件：`src-tauri/Cargo.toml`、`.reasonix/`、`1.html`、`2.html`、`reasonix.toml`。
- 本机 Rust 命令需要 `D:\cargo_home\bin`，并使用 `CARGO_TARGET_DIR=D:\ai-workbench\src-tauri\target` 才能稳定运行。
- `npm run verify:preview` 依赖 `dist/` 已构建；`npm run verify:matrix` 内部会先跑 build。

## 下一个候选

按上一份架构报告剩余候选继续：

1. 按域拆分 workbenchStore：journey / studio / delivery store 替换现有 facade。
2. Agency 目录真实导入 seam：移除 `prism_agents.rs` 与 ADR-005 遗留 fallback。
3. VerificationReport 统一 schema：让 auto-fix 消费结构化 report。
4. 共享 UI anchor contract：`data-*` / view id 单一真源。

## Suggested skills

- `/grill-with-docs`：下一个候选走同样的有 codebase 决策流程
- `/to-spec` + `/to-tickets`：multi-session 时拆分 tracer-bullet tickets
- `/code-review`：每个候选收尾做双轴审查
