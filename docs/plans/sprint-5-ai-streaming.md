# Sprint 5 计划：AI Studio 真流式输出

目标：把 AI Studio 从“一次返回完整回复”升级为逐块流式输出，Rust 后台解析 OpenAI/Ollama SSE，通过 Tauri Event 推送到前端，MOA 聚合后继续单流呈现。

## Sprint 5 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| C1 | Rust 流式命令 | `stream_ai_message` 解析 OpenAI `data:` 与 Ollama NDJSON，逐块 emit `stream-chunk` |
| C2 | MOA 聚合流 | 多 Provider 结果按顺序聚合为单流，`done` 事件收尾 |
| C3 | 前端流式渲染 | AI Studio 监听 `stream-chunk`，assistant 消息增量追加，busy 状态驱动打字机动画 |
| C4 | 浏览器 fallback | 非 Tauri 环境用分块模拟流，保证 `verify:ui` / `verify:preview` 可验证 |
| C5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib` 全绿 |

## 范围外（进入 Backlog）

- RAG 向量索引真实执行
- Webhook、云同步、移动端
- Provider 流式取消/中断

## DoD 检查单

- [ ] `stream_ai_message` 已注册并 emit `stream-chunk`。
- [ ] AI Studio 回复为逐块追加，不再等整段返回。
- [ ] 流式期间显示 busy 指示，结束后恢复输入。
- [ ] 动效仍遵守 150ms 与 reduced-motion。
- [ ] PR 已合并到 develop，复盘已更新。
