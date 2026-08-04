# Sprint 8 计划：AI Studio 流式取消 / 中断

目标：AI Studio 流式输出期间提供 Stop 按钮，点击后立即停止继续渲染，并把当前回复标记为已中断，避免误发或过长回复占用注意力。

## Sprint 8 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust 取消协议 | 新增 `cancel_ai_stream(run_id)` 命令与 `StreamCancellation` 状态；流式函数逐块检查取消标记，结束后清理标记 |
| D2 | 事件协议 | `stream-chunk` 增加 `cancelled` 字段，取消时 done 事件带 `cancelled: true` |
| D3 | 前端 Stop | AI Studio busy 时输入区显示 Stop 按钮；点击后调用取消命令、标记消息 `[stopped]`、停止继续渲染 |
| D4 | 浏览器 fallback | 非 Tauri 环境用本地取消集合中断分块模拟流，保证 UI 验证可运行 |
| D5 | 自动化验收 | `npm run build`、`verify:ui`、`verify:preview`、`cargo test --lib`、clippy、fmt 全绿 |

## 范围外（进入 Backlog）

- 取消网络请求真正中断连接（当前 Rust 已整体读取 body，取消只停止渲染）
- 跨文件 / Obsidian Vault 检索
- 真实 Provider 端到端流式联调

## DoD 检查单

- [x] Rust `cancel_ai_stream` 命令已注册并有单测
- [x] AI Studio 出现 Stop 按钮，点击后消息标记 `[stopped]` 且不再增长
- [x] `verify:ui` 能稳定断言取消路径
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 已合并到 develop，复盘已更新
