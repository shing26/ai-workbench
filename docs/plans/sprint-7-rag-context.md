# Sprint 7 计划：AI Studio RAG 上下文注入

目标：发送消息前从本地 thoughts 检索相关内容并注入对话上下文，让 AI 回复能引用个人知识库，并在 UI 上清楚展示注入来源。

## Sprint 7 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | 发送前 RAG 检索 | AI Studio 发送消息时调用 `search_thoughts(text, 5)`，命中时在消息前注入 `system` 上下文 |
| D2 | RAG 开关 | 模型切换条附近新增 RAG 开关，默认开启；关闭时跳过检索 |
| D3 | 来源展示 | 命中时消息区显示 `RAG +N` badge，Inspector 展示 RAG context 与来源摘要 |
| D4 | 浏览器 fallback | 非 Tauri 环境继续用关键词检索，保证 UI 验证可运行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib` 全绿 |

## 范围外（进入 Backlog）

- 跨文件 / Obsidian Vault 检索
- 向量 Embedding 模型接入
- Provider 流式取消 / 中断
- RAG 命中结果人工确认后再发送

## DoD 检查单

- [x] 发送消息时确实检索并注入 RAG 上下文
- [x] UI 可见 `RAG +N` badge 与 Inspector 来源
- [x] `verify:ui` 能稳定断言 RAG 注入
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
