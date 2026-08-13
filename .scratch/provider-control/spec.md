# Provider Control Spec

Status: ready-for-agent

## Goal

让 Provider 在工作台内可配置、可测试，并把当前选中 Provider Profile 贯穿 Studio 论证与验证链路。

## Scope

- Provider Control modal：新增、启用/停用、设置模型、设置优先级、设置超时/重试、健康检查、流式 smoke test、模型发现。
- 跨视图共享选中 Provider：AI Studio roundtable 使用它，Actions L4 上下文显示它。
- Rust/browser fallback 同构：UI 只依赖 `db.ts` adapter，不直接写浏览器/桌面分支。

## Acceptance

1. 用户可以从 Header 或 AI Studio 打开 Provider Control。
2. 用户可新增 OpenAI-compatible 与 Ollama provider，并立即健康检查/流式测试。
3. 选中 Provider Profile 在 AI Studio 与 Actions 保持一致，刷新后仍生效。
4. `npm run lint` / `npm run build` / `npm run test:unit` / `cargo test` / `cargo clippy -D warnings` / `npm run verify:matrix` / `prettier --check` / `audit-contract` 全绿。
