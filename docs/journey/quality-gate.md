---
projectId: quality-gate
journeyStage: ready
updatedAt: 2026-08-13T12:00:00Z
tags: [prism, journey, quality-gate]
---

# 四级质量门残余风险收敛

## 背景与目标

让 L4 AI DoD 语义对齐与安全审计不再依赖 app 内人工触发，CLI 质量门也能执行可验证的 DoD 对齐审计。

## PRD 要点

CLI 与 Rust 质量门统一执行语义对齐审计；安全扫描规则保持共享。

## 设计决策

使用 `verify.matrix.json` 的 L4 `semantic audit` 检查与 `verify_matrix::run_semantic_audit` 作为双端同构实现。

## 风险与 Trade-off

- 确定性审计不替代 LLM 语义理解，只覆盖可验证的 DoD 清单与代码变更证据。
- 保留 app 内 AI 共识增强能力，避免把外部 Provider 变成 CLI 质量门硬依赖。

## 论证结论

CLI 与 app 共用同一 L4 执行路径，残余风险收敛为可重复运行的自动化检查。

## 交付任务清单

- [x] 新增 L4 语义对齐审计脚本
- [x] Rust 质量门接入语义对齐审计
- [x] 更新 ADR 与交接文档

## 实现与验证记录

- `scripts/verify-l4-semantic.mjs`
- `src-tauri/src/verify_matrix.rs`
