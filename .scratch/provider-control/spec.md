# Provider Control Spec

Status: ready-for-agent

## Goal

让 Provider 在工作台内可配置、可测试，并把当前选中 Provider Profile 贯穿 Studio 论证与验证链路。

## Scope

- Provider Control modal：新增、删除、启用/停用、编辑供应商标签/地址/API key/类型、设置模型、设置优先级、设置超时/重试、健康检查、流式 smoke test、模型发现。
- 供应商类型显式建模：`ollama`、`openai-compatible`、`custom`，支持接入 OpenAI/Ollama 之外的其他供应商。
- Provider Lab：对当前选中 Provider 提供连接测试、流式测试和模型获取的独立入口。
- 跨视图共享选中 Provider：AI Studio roundtable 使用它，Actions L4 上下文显示它。
- Rust/browser fallback 同构：UI 只依赖 `db.ts` adapter，不直接写浏览器/桌面分支。

## Acceptance

1. 用户可以从 Header 或 AI Studio 打开 Provider Control。
2. 用户可新增 OpenAI-compatible、Ollama 与 custom provider；预设可一键保存，保存后仍可编辑标签和连接资料。
3. Provider Lab 可对当前选中 Provider 执行健康检查、流式 smoke test 与模型发现；Rust 与 browser fallback 都保持同构。
4. 选中 Provider Profile 在 AI Studio 与 Actions 保持一致，刷新后仍生效。
5. `npm run lint` / `npm run build` / `npm run test:unit` / `cargo test` / `cargo clippy -D warnings` / `npm run verify:matrix` / `prettier --check` / `audit-contract` 全绿。
