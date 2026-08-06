# AI Workbench v1.0 发布说明

发布日期：2026-08-07

## 版本目标

v1.0 是 AI Workbench 冻结范围后的完整版本：5 大核心主视图（ChatAI Studio / Projects / Knowledge / Actions / System）覆盖日常 AI 问答、项目落地、知识管理、日程推进与系统运维，Backlog 候选池已清空，八道质量门全绿。

## 功能范围

- ChatAI Studio：多模型 / MOA / Team 对话、流式输出、会话复制携带消息版本血缘、导出内嵌 RAG 与 Inspector Trace、RAG 来源选择与记住偏好。
- Projects：项目卡片矩阵、收益 / 进度、Git 变更挂载、Prompt / 代码生成工作流、轮播拖拽与材料记忆。
- Knowledge：Thought Inbox、Markdown 知识库、本地向量 RAG、真实 Embedding 模型、分片索引与近似索引（ANN）、语义聚类与文档去重、Vault 索引与 Watch。
- Actions：今日 Focus、待办、习惯打卡、日程时间线、周计划模板。
- System：Provider 配置与健康度、模型能力目录、Webhook 高级模板与版本管理、事件总线、剪贴板历史、错误日志、同步口令安全与多设备密钥轮换。

## 交付物

- Tauri 桌面应用（Rust 后端 + Vue / TS 前端），SQLite 本地存储。
- 浏览器 fallback：全部核心链路在 `src/lib/db.ts` 与 localStorage 同构可用，`verify:ui` / `verify:preview` 双端覆盖。
- 自动化验证：`verify:ui` / `verify:preview` 覆盖 5 大主视图核心工作流；Rust 单测覆盖数据库迁移、配置钳制、搜索、同步、Webhook 与导出血缘。

## 质量门复验结果

| 质量门 | 结果 |
|---|---|
| `npm run build` | 通过（tsc + vite build） |
| `npm run lint` | 通过 |
| `npx prettier --check .` | 通过 |
| `cargo fmt --check` | 通过 |
| `cargo clippy --all-targets -- -D warnings` | 通过 |
| `cargo test --lib` | 203/203 通过 |
| `npm run verify:ui` | 通过（含 `vectorAnnSearch` lane） |
| `npm run verify:preview` | 通过 |

## 已知限制

- 本地哈希向量（`local` embedding）是确定性降维表示，适合离线与双端一致，语义精度低于商用 Embedding 模型；需要更高精度时可切换 OpenAI compatible / Ollama。
- ANN 剪枝只在 `probe_count < shard_count` 时生效，关闭 ANN 或全量 probe 会回到精确召回但扫描成本更高。
- 向量索引单批重建最多 25 个文件，超大 Vault 首次索引需要多轮后台补齐。

## 遗留搁置模块

- Connection Layer（信号通知层）：未纳入 v1.0，后续有需要再开发。
- Monetization Workbench（创收工作台）：未纳入 v1.0，后续有需要再开发。

## 后续迭代建议

- 引入真实 ANN 索引文件（如 HNSW / IVF 落盘），把质心剪枝升级为可持久化的近似索引。
- 为 Knowledge 增加全文检索与向量检索的混合分页，支持更大 Vault。
- 在 System 中加入自动化规则与 Webhook 的可视化编排，为 Connection Layer 预留入口。
