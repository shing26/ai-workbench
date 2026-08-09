# Sprint 91 计划：RAG 命中人工确认

目标：给 AI Studio 增加“命中结果人工确认后再发送”选项：开启后，发送消息若检索到本地 RAG 命中，先弹出确认面板，逐条勾选要注入的命中，确认后才发送；未开启时保持原有直接发送路径。

## Sprint 91 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 状态模型 | AIStudioView 新增 ragConfirmMode / pendingSend / pendingSelected 状态；New chat 与切换会话时清理待确认内容 |
| A2 | 发送链路 | sendText 拆出 dispatchSend：开启确认且命中大于 0 时先进入待确认态（不置 busy），确认后仅注入勾选的命中并继续原链路；普通发送路径不变 |
| A3 | 确认面板 | 渲染 data-rag-confirm-panel：命中复选框 data-rag-confirm-hit、选中计数、data-rag-confirm-send（Send with N，0 时禁用）、data-rag-confirm-cancel |
| A4 | 模式开关 | 模式条新增 data-rag-confirm-mode 开关（aria-checked）；开启后仅影响命中确认，不影响 RAG 开关本身 |
| A5 | 自动化验证 | verify:ui / verify:preview 新增 ragConfirmSend lane：开确认、发送、面板出现且命中大于等于 2、取消一条、Send with N-1、断言 badge RAG +N-1；关确认后再发送不出现面板 |

## DoD 检查单

- [x] `cargo fmt`、`cargo clippy --lib -- -Dwarnings`、`cargo test --lib` 全绿（101/101）。
- [x] `npm run build` 全绿。
- [x] `verify:ui` / `verify:preview` 的 `ragConfirmSend` 均为 true。
- [x] 普通发送、团队模式、复盘生成与 regenerate 路径保持可用，既有 streaming / teamDispatch / aiRecapSave lane 全部通过。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.91.0-alpha`。

## 范围外（Backlog）

- 不做 Embedding 向量检索升级；当前仍为 BM25 / 浏览器关键字命中。
- 不做命中来源跨文件选择器与“记住选择”偏好；继续留在 Backlog。
- 不做真实 Provider 端到端流式联调；继续留在 Backlog。
