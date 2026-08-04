# Sprint 10 计划：System Provider 健康度监控

目标：把 System 视图中 Provider 的占位 `Latency - ms` 升级为真实健康检查：Ollama 探测 `/api/tags`，OpenAI 兼容节点探测 `/models`，展示 ok / unreachable 与延迟。

## Sprint 10 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust 健康检查 | `check_provider_health(provider_id)` 按 Provider 类型探测对应端点，返回 `{ ok, latencyMs, message }` |
| D2 | Ollama 判定收敛 | 抽取 `is_ollama_provider(name, url)` 供健康检查与既有路由复用，并有单测 |
| D3 | 前端状态展示 | System Provider 卡片显示健康点、状态与延迟，提供 Check 与 Check all 按钮，进入视图自动检查 |
| D4 | 浏览器 fallback | 非 Tauri 环境模拟健康结果，保证 UI 验证可运行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 连续心跳与告警通知
- 按延迟自动路由 Provider
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] Rust `check_provider_health` 命令已注册，Ollama 判定有单测
- [x] System Provider 卡片显示真实健康状态与延迟
- [x] `verify:ui` 能稳定断言健康检查展示
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
