# 2026-08-06 Provider 端到端流式联调评审

## 结论

- `providers` 新增 `model TEXT DEFAULT ''`：新库 SCHEMA 直接建列，旧库 `migrate_provider_model` 幂等补列；`Provider` 结构体、`list_providers` / `get_provider` / `create_provider` / 新增 `update_provider_model` 命令全部贯通。
- System Providers 卡片新增模型编辑：`data-provider-model-input` 回车或失焦保存，`data-provider-model` 徽标区分 `live` / `fallback`；新建表单支持 `data-provider-model-new`。
- Rust 流式链路按 `provider.model` 发请求，空值回退 `gpt-4o-mini` / `qwen2.5:3b`；`stream_ollama` / `chat_ollama` 改为使用 `provider.base_url`，不再固定 `localhost:11434`。
- 浏览器 fallback 新增真实流式：配置 model 的 http(s) Provider 通过 `fetch` 消费 OpenAI-compatible SSE 或 Ollama NDJSON，逐 chunk 转发并支持取消；失败回显错误，未配置 model 时保持模拟流。
- `verify:ui` / `verify:preview` 新增 `providerLiveStream` lane：脚本内起本地 SSE mock，写入带 model 的 Provider 后重载页面，AI Studio 真实发出 fetch 请求并渲染 `Live provider stream ok model=mock-gpt`；dev 与生产构建全绿，Rust 107 个单测通过，clippy 零告警。

## 风险与后续

- 浏览器实时流依赖 Provider 开启 CORS；Tauri 桌面端不受此限制。
- 模型名目前是自由文本，未做模型列表探测；后续可接 `/models` 下拉选择。
- MOA 多 Provider 并行仍为顺序流式，真实并行聚合与超时策略留在 Backlog。
