# 2026-08-06 Provider /models 探测与下拉选择评审

## 结论

- Rust 新增 `list_provider_models` Tauri 命令：非 Ollama 请求 `{base_url}/models` 并附加 Bearer 鉴权，Ollama 请求 `{base_url}/api/tags`，8 秒超时，非 2xx 用 `truncate_error` 收敛错误体。
- 新增 `parse_provider_models` 解析器：兼容 OpenAI `data[].id / owned_by` 与 Ollama `models[].name` 两种形状；空列表或非法 JSON 返回 `No models returned by provider`。
- `db.ts` 新增 `ProviderModel` 类型与 `listProviderModels`：Tauri 走 invoke，浏览器 fallback 走同构 fetch 并带 8 秒 AbortController 超时，错误直接回显。
- SystemView Provider 卡片新增探测按钮与下拉：`data-provider-models-detect`（带数量 badge）、`data-provider-model-options` / `data-provider-model-option`、`data-provider-model-error`；模型输入改为受控，选择后立即写入 `providers.model` 并切换 live 徽标。
- `verify:ui` / `verify:preview` 新增 `providerModels` lane：本地 `/v1/models` mock 断言 3 个选项、选中 `mock-gpt-4o` 后持久化、badge live、坏地址显示错误；dev 与生产构建全绿，Rust 110 个单测通过，clippy 零告警。

## 风险与后续

- 浏览器实时探测依赖 Provider 开启 CORS；Tauri 桌面端不受此限制。
- 模型列表目前按服务端顺序展示，未做能力元数据与最近使用排序。
- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、真实 MOA 并行、Webhook payload 模板 / 上下文字段。
