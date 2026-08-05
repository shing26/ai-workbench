# Sprint 80 计划：AI 生成式今日复盘

目标：把 Actions 的 Focus / Habits / Schedule 数据作为上下文，让 AI Studio 一键生成结构化今日复盘。点击“今日复盘”按钮后，工作台自动组装包含进度、任务、习惯与日程的提示词，走既有流式发送链路生成复盘。

## Sprint 80 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 复盘上下文模块 | 新增 `src/lib/dailyRecap.ts`：`buildDailyRecapContext` 聚合 Focus / Habits / Schedule 完成数与总体进度，`buildDailyRecapPrompt` 组装结构化中文提示词 |
| A2 | AI Studio 入口 | AI Studio 新增“今日复盘”按钮（`data-ai-daily-recap`），点击后读取 store 数据、组装提示词并直接走 `sendText` 流式发送 |
| A3 | 发送链路复用 | 把 `send` 拆出 `sendText(text)`，复盘与普通发送共用同一 RAG / 流式 / 会话链路 |
| A4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `aiDailyRecap` lane：点击按钮后断言用户消息含今日 Focus / 习惯 / 日程样例与 Overall 进度，流式回复可见 |

## DoD 检查单

- [x] `npm run build` 全绿，前端无 Rust 变更。
- [x] `verify:ui` / `verify:preview` 的 `aiDailyRecap` 为 true。
- [x] 复盘提示词包含 Focus / Habits / Schedule 三类数据与总体进度。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.80.0-alpha`。

## 范围外（Backlog）

- 不自动把复盘写入日程或知识库；保存复盘笔记进入候选池。
- 不按用户历史偏好定制复盘模板；Prompt 版本化继续沿用 Agent 目录既有能力。
