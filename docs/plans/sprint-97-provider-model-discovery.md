# Sprint 97 计划：Provider /models 探测与下拉选择

目标：让 System Providers 卡片一键从 OpenAI-compatible `/models` 或 Ollama `/api/tags` 拉取真实模型列表，点击下拉项即可保存为当前模型，替代手写模型名的流程。

## Sprint 97 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | Rust 探测命令 | 新增 `ProviderModel` 结构与 `list_provider_models` Tauri 命令：非 Ollama 请求 `{base_url}/models`（Bearer 鉴权），Ollama 请求 `{base_url}/api/tags` |
| P2 | 响应解析 | `parse_provider_models` 兼容 OpenAI `data[].id / owned_by` 与 Ollama `models[].name`，空列表 / 非法 JSON 返回明确错误 |
| P3 | 浏览器 fallback | `db.ts` 新增 `ProviderModel` 类型与 `listProviderModels`：Tauri 走 invoke，浏览器走同构 fetch，8 秒超时 |
| P4 | System UI | Provider 卡片新增探测按钮（`data-provider-models-detect`）、下拉面板（`data-provider-model-options` / `data-provider-model-option`）与错误提示（`data-provider-model-error`），模型输入改为受控并即时持久化 |
| P5 | 自动化验证 | Rust 单测覆盖两种响应形状与空列表错误；`verify:ui` / `verify:preview` 新增 `providerModels` lane（本地 `/models` mock + 失败路径） |

## DoD 检查单

- [x] `list_provider_models` 已注册并可区分 OpenAI-compatible 与 Ollama 的探测端点。
- [x] OpenAI `data[].id / owned_by` 与 Ollama `models[].name` 两种响应均能解析。
- [x] System Providers 卡片可一键探测、下拉选择模型并立即持久化，失败有错误提示。
- [x] 浏览器 fallback 与 Rust 行为一致，8 秒超时兜底。
- [x] `npm run build`、Rust fmt/test/clippy、`verify:ui`、`verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.97.0-alpha`。

## 范围外（Backlog）

- 不做模型能力元数据（context window / 价格 / 速率）展示。
- 不做模型收藏与最近使用排序；下拉按服务端返回顺序展示。
- 不做 `/models` 缓存与自动刷新策略。
