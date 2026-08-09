# Sprint 95 计划：Provider 模型配置与端到端流式联调

目标：让每个 Provider 可配置实际模型名，Rust 与浏览器 fallback 都按该模型发起真实流式请求；浏览器端补上 OpenAI-compatible SSE / Ollama NDJSON 实时流，并修复 Ollama 固定 localhost 端口导致自定义 Base URL 失效的问题。

## Sprint 95 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | Provider 模型字段 | `providers` 表新增 `model` 列，旧库 `migrate_provider_model` 幂等补列；Provider 结构体 / 类型 / 命令全部带 `model` |
| P2 | 模型编辑 UI | System Providers 卡片显示 fallback/live 徽标，`data-provider-model-input` 回车或失焦保存，新建表单带 `data-provider-model-new` |
| P3 | Rust 流式使用模型 | `stream_ai_message` / `run_provider_stream_smoke_test` / `call_provider` 优先 `provider.model`，空值回退默认；Ollama 流式与普通请求改用 `provider.base_url` |
| P4 | 浏览器实时流 | 配置 `model` 的 http(s) Provider 走 fetch SSE / NDJSON 真实流，失败回显错误；未配置 model 保持既有模拟流 |
| P5 | 自动化验证 | Rust 单测覆盖 model 迁移 / 持久化与请求体模型名；`verify:ui` / `verify:preview` 新增 `providerLiveStream` lane（本地 SSE mock） |

## DoD 检查单

- [x] 新库建表含 `providers.model`，旧库迁移幂等且不丢数据。
- [x] Provider 卡片可编辑模型并实时刷新，新建 Provider 可带模型。
- [x] Rust 流式 / 非流式请求均使用配置模型，Ollama 支持自定义 Base URL。
- [x] 浏览器 fallback 对已配置模型的 Provider 真实流式，SSE 与 NDJSON 均解析。
- [x] `npm run build`、Rust fmt/test/clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.95.0-alpha`。

## 范围外（Backlog）

- 不做 Provider 批量导入导出 / 密钥加密落库；API Key 仍走 Keyring 引用。
- 不做多 Provider MOA 的真实并行投票展示；MOA 仍按顺序流式输出。
- 不做流式请求超时配置与自动重试；错误只做回显与前端重试。
