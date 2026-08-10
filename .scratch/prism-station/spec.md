# Prism Station — 实施 Spec

**Status:** ready-for-agent（方案 B：P0 优先智脑 Canvas + CLI 唤醒）

## Problem Statement

Hermes Station v1.1-alpha 已完成 5 大 Bento 控制塔 + Local-First 持久化。本阶段按 `docs/plans/prism-station-prd.md` 实施 **Prism Station**：一人公司 AI CPO 桌面操作系统，核心是「思考与干活解耦」——多 Agent 圆桌辩论固化为知识 Spec，本地 CLI 兵团按 Spec 执行代码落地。

## 方案 B 范围（P0 优先）

按 PRD 4 Sprint 拆 tickets，但**实施顺序 P0 优先**：
- **P0-1（Sprint 2）智脑 Canvas**：多 Agent 圆桌辩论 + 📌 固化为知识
- **P0-2（Sprint 4）CLI 交付终端**：spawn_cli_process + SSE 流式 + 关联知识注入
- **P1（Sprint 1/3）控制塔 + Obsidian 联动**：后续迭代

## 复用基础（Hermes Station）

- Tauri v2 + Rust + SQLite + Tailwind ✅
- projects/tasks/thoughts 表 + 上下文管线（vibe/note/action context）✅
- AI Studio agents 数据模型（部门 Agent + systemPrompt）→ 扩展为高管辩论
- 全键盘 j/k/x/p/a + Quality Gate + git diff 树 ✅
- Local-First + 快照安全 ✅

## 关键约束

- **思考干活解耦**：AI Studio 只讨论固化为 Spec，CLI 只执行。
- **Local-First**：数据落盘 SQLite + Markdown，Scope 物理隔离。
- **双端同构**：浏览器 fallback 与 Rust 同语义。
- **8 项质量门**全绿；用户文件（package.json 等 3 个）不提交。
- **安全**：无字符串 SQL 拼接；文件操作 Scope 越权检查。

## 验收

- P0-1：多 Agent 辩论 + 📌 固化为知识（Markdown + Frontmatter）。
- P0-2：真实拉起 claude/aider + 逐行流式日志 + Exit Code。
- 每 Sprint：cargo test + verify:preview 双端绿。
