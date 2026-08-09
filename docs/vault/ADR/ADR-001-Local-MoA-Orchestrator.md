---
type: adr
adr: 001
status: accepted
date: 2026-08-07
tags: [adr, moa, orchestrator, architecture]
---

# ADR-001: Local MoA Orchestrator

> 本地 MoA 编排层架构决策。经 `/grilling` 5 轮访谈定稿。

## 一句话

个人本地 MoA 编排层：Tauri 壳保留 + 同进程 Rust 编排引擎，状态落 SQLite，路由在本地，无云组件。LUI 优先入口，FSM 任务图 + permission_rules 零信任执行 + Fail-Closed 评估。

## 决策摘要

| 维度 | 决策 |
|---|---|
| 架构 | 本地编排层，不写 FastAPI 服务端，浏览器/Rust 双端同构 |
| 入口 | LUI 优先，CommandPalette 升级为实体级万能入口 |
| 用户 | Solo Creator 主战场，企业叙事降级 |
| 编排 | 1 个全局 FSM 实例 + 单任务 3 路 provider 并行 |
| 记忆 | `user_behavior_memory` 表，不自动改写主档案 |
| 降级 | 4 级：health → fallback → Ollama → 离线提示 |
| 授权 | `permission_rules` + 确认门下沉 Rust Tauri 命令层 |
| 评估 | Fail-Closed，输出校验中间件，retry 绑 node_id |
| 幂等 | `delivery_id`(ULID) + `UNIQUE(rule_id, event_id)` |
| 可观测 | ULID trace 贯通 + `run_metrics` 表 + `MOCK_ALL_AGENTS` |
| 成本 | 前缀缓存 + 条件校验 + TPM 门控 |
| 合规 | 级联物理删定义 + 密钥只进 Keyring |

## 前置条件

**Sprint 0 必须完成 v1.0 P0 缺陷修复**（任务删除/改名、草稿持久化、MOA 浏览器死锁、无确认批量操作）后才允许落地本 ADR。

## 全量正文

完整决策见 [[ADR-001 全量正文]]。

## 关联

- [[AI Workbench Hub]]
- [[Kanban]]
- [[Tickets]]
