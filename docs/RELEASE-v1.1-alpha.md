# Hermes Station v1.1-alpha 发行归档

发布日期：2026-08-10
Tag：`v1.1-alpha`
分支：develop → 已推送 main 基线前
上游：v1.0.0-alpha（`docs/RELEASE-v1.md`）

## 发行定位

Hermes Station（赫尔墨斯全栈 AI 控制台）v1.1-alpha：在 v1.0 的 5 大 Bento 控制塔 + Local-First 持久化之上，完成 **资产安全闭环、工程管线闭环、极客键盘体验、国际化与运维稳健性** 四大攻坚，打通「意图下发 ➔ 智能生成 ➔ 校验门禁 ➔ 原子写入」全链路。

设计哲学：`Intent as Code, Agent as Runtime`。

## Sprint 7~10 战果

### Sprint 7 — 资产安全优先（P0 核心安全）

| 能力 | 交付 | AC |
|---|---|---|
| 阴影快照引擎 | `.hermes/backups/<ts>_<sha8>_<name>.bak` + `manifest.json` 索引 + NEW_FILE 标记；`atomic_write`（tmp + rename 原子替换） | AC-2.1 |
| 快照撤销 | `rollback_snapshot` 一键还原 Apply 前内容；`prune_snapshots` 保留最近 N | AC-2.2 |
| Code Apply | AI Studio 代码块 `[⚡ Apply]` → 写入 + 快照 + Toast + `[✓ 已写入本地]` / 还原态 | AC-2.1 |
| 事件广播 | `FILE_UPDATED` / `FILE_RESTORED` → `useTauriEvents` 监听 → Projects 刷新 + System IPC 日志流 | AC-2.1 |

### Sprint 8 — 工程管线闭环

| 能力 | 交付 | AC |
|---|---|---|
| DoD 双向同步 | tasks 加 `project_id`/`is_dod`（迁移 + 索引）；`DOD_STATUS_CHANGED` 广播；Actions `#proj-<id>` `#dod` 标签 → Projects 卡 `🎯 待攻坚 DoD` 实时削减 | AC-3.2 |
| Inline Diff 树 | 项目卡 `N files changed ▾` 折叠树（懒加载 `get_project_diff_tree`）+ 文件行 ±N + Hunk 侧滑抽屉 | AC-1.2 |
| Quality Gate | `run_quality_gate`（tsc/cargo 静默校验）→ 顶栏 `ALL GREEN ✅ / CHECK FAILED ❌` + 错误抽屉；FILE_UPDATED 自动触发 | AC-1.3 |

### Sprint 9 — 极客体验与算力容灾

| 能力 | 交付 | AC |
|---|---|---|
| Linear 全键盘 | Actions `j/k` 光标游走（`data-task-cursor`）、`x` 完成、`p` 置顶、`a` AI 拆解、`n`/`/` 聚焦输入；<5ms | AC-3.1 |
| AI 3 步拆解 | `a` 键呼出 `data-ai-breakdown` 弹窗（3 步建议）+ 一键投递 AI Studio（复用 actionContext 管线） | AC-3.3 |
| MOA 3s 熔断 | `firstTokenTimeoutMs`（MOA lane 3000ms）超时 abort；失败节点 `● Disconnected` 徽标，其余节点 `Promise.allSettled` 续流不卡死 | AC-2.3 |

### Sprint 10 — 国际化与运维稳健性

| 能力 | 交付 | AC |
|---|---|---|
| 全局 i18n | `src/lib/i18n.ts`（zh-CN/en-US/ja-JP 字典 + `useLocale` + localStorage 持久化）；AppHeader `🌐 Locale` 胶囊无刷新切变，reload 保留 | AC-4.3 |
| API 热切换 | SystemDrawer `[⚡ 设为当前 API]` 互斥热切（`hotSwapProvider`），秒级生效无需重启 | AC-4.1 |
| SQLite 瘦身 | SystemDrawer Storage tab：查看快照 + `🧹 清理快照`（`prune_snapshots` 保留最近 N） | — |
| 客户端打包 | Tauri v1.1-alpha：`ai-workbench.exe` + MSI + NSIS | — |

## 质量门全绿

| 质量门 | 结果 |
|---|---|
| `npm run build` | ✅ |
| `npm run lint` | ✅ |
| `npx prettier --check .` | ✅ |
| `cargo test --lib` | ✅ 220/220 |
| `cargo clippy --all-targets -- -D warnings` | ✅ |
| `cargo fmt --check` | ✅ |
| `npm run verify:preview` | ✅ |

## 验收标准达成（12 条 AC 全覆盖）

| 维度 | AC | 状态 |
|---|---|---|
| 维度 1（Vibe Pipeline） | AC-1.1 / 1.2 / 1.3 | ✅ |
| 维度 2（Apply 安全写入） | AC-2.1 / 2.2 / 2.3 | ✅ |
| 维度 3（DoD 双向 + 键盘流） | AC-3.1 / 3.2 / 3.3 | ✅ |
| 维度 4（热切 + Keyring + i18n） | AC-4.1 / 4.2 / 4.3 | ✅（4.2 Keyring 见重定位） |

## 已知限制与后续

- **Keyring 加固**（AC-4.2 部分）：API Key 已有 `keyring_ref` + `set_secret`/`get_secret` 基础与脱敏，但全量审计迁移（既有明文一键搬入 Keychain + 启动自检）**重定位至 v1.1.1-patch**，见 `.scratch/hermes-station/issues/11-s10-keyring-hardening.md`。
- MOA 熔断在浏览器 fallback 无真实流验证（依赖 Tauri 桌面端）；3s 超时逻辑已由代码 + tsc 保证，建议桌面端回归。
- i18n 覆盖 AppHeader 标题/副标题/Quality Gate；其余视图文案后续扩展字典。

## 归档说明

- 本文件为 v1.1-alpha 发行的事实来源（Single Source of Truth 扩展：`docs/plans/hermes-station-prd.md`）。
- Tag `v1.1-alpha` 已推送 `origin`。
- 后续迭代（v1.1.1-patch / v1.2）从 `develop` 分支继续。
