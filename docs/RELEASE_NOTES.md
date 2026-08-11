# Prism Station v1.2.3 发行归档

发布日期：2026-08-11
Tag：`v1.2.3`
分支：develop
上游：v1.1-alpha（`docs/RELEASE-v1.1-alpha.md`）

## 发行定位

Prism Station（棱镜 · 一人公司 AI CPO 桌面操作系统）v1.2.3：在 Hermes Station v1.1-alpha 的 5 大 Bento 控制塔 + Local-First 持久化之上，完成 **「思考与干活解耦」** 的完整落地——多 Agent 圆桌辩论固化为知识 Spec，本地 CLI 兵团按 Spec 执行代码落地，知识活性演进 + Obsidian 零摩擦联动。

设计哲学：`Intent as Code, Agent as Runtime, Thought as Asset`。

## 架构图谱

```text
┌────────────────────────────────────────────────────────────────────────┐
│                    Prism Station v1.2.3 架构图谱                        │
├────────────────────────────────────────────────────────────────────────┤
│  UI 层（React + Tailwind v4 + Zustand）                                │
│    DashboardView ─ AIStudioView ─ ProjectsView ─ KnowledgeView ─        │
│    ActionsView ─ SystemView（ViewRouter keep-alive 常驻）               │
│          │                                                              │
│  IPC 层（Tauri invoke / events）                                       │
│    list_agent_specs / ensure_agent_specs / spawn_cli_process            │
│    record_thought_reference / open_obsidian / run_quality_gate          │
│    events: cli_log_line ▸ cli_exited ▸ FILE_UPDATED ▸ provider-heartbeat│
│          │                                                              │
│  Rust 服务层（SQLite + Keyring + Tokio）                               │
│    prism_agents（YAML Frontmatter 规约解析器）                          │
│    cli_spawn（Tokio 子进程 + 逐行流式日志 + Exit Code）                 │
│    db（thoughts/tasks/projects/agent_specs 表 + 迁移）                 │
│          │                                                              │
│  外部边界（OpenAI / Ollama / Codex / Claude / Aider / Obsidian）        │
└────────────────────────────────────────────────────────────────────────┘
```

## 5 大解耦空间

四大协同原则：思考与干活严格解耦 · 本地优先与绝对安全 · 多 Agent 独立思考与交叉质控 · 知识活体演进。

| # | 空间 | 职责 | v1.2.3 交付 |
|---|------|------|-------------|
| 1 | 📊 控制塔 Dashboard | 全局监控、风险告警、今日焦点决策信号 | 7 天 Token Sparkline、CLI 状态摘要、Top DoD / Blocked / AI 风险三栏；**只读控制塔，无命令行发送框** |
| 2 | 📁 项目矩阵 Projects | 仓库 Scope 物理隔离、Git 矩阵、知识覆盖率告警 | 知识覆盖率 <50% 黄警告（点击直达 Knowledge 过滤） |
| 3 | 💬 智脑 Canvas AI Studio | 多 Agent 圆桌辩论 + Trade-off 评估 + 📌 固化知识 | 席位勾选并行辩论（CTO/CDO/CISO）、大容量画布、⌘Enter 发送、共识固化为 Frontmatter 知识卡 |
| 4 | 🎯 交付终端 Actions | 全键盘流 + 📎 关联知识注入 + CLI 进程唤醒 | `c` 派发 CLI 模板、`v` 健康检查、关联知识弹窗注入路径、🚀 唤醒本地 CLI + 流式日志 + Exit Code |
| 5 | 📚 活体知识塔 Knowledge | F 型卡片 + 活性衰减 + 语义搜索 + Obsidian 联动 | 覆盖率警告、🔥/⚠️/❄️ 活性标记、Hover 快捷行动栏、田字格/图谱秒切、`obsidian://open` 零摩擦联动 |

## 解耦主线

```text
闪念/疑问 ──► 多 Agent 圆桌论证 ──► 📌 固化为知识 Spec（Markdown + Frontmatter）
      ──► 📎 关联任务注入路径 ──► 🚀 CLI 派发执行 ──► v 健康检查归档 ──► 活体知识塔
```

## .hermes/agents/ 规约配置

> 注：PRD 习称 `.prism/agents/`，实际落盘路径为 `.hermes/agents/`（沿用 Hermes Station 资产目录约定）。

AI Studio 圆桌席位由项目内 `.hermes/agents/*.md` 规约驱动，每个文件 = 一个独立高管席位。`ensure_agent_specs` 首次挂载自动写入默认 3 席（幂等），用户可自由增删席位文件实现自定义辩论阵容。

### Frontmatter 格式

```markdown
---
id: cto
name: CTO
role: 技术架构师
kpi: 可行性、架构一致性、性能
active: true
---
你是 Prism Station 的 CTO。从架构可行性、系统一致性、性能与可维护性角度独立评估需求，质疑不合理的实现路径，提出技术选型建议。
```

| 字段 | 含义 |
|---|---|
| `id` | 席位唯一标识（缺失时取文件名 stem） |
| `name` | 高管显示名 |
| `role` | 部门角色 |
| `kpi` | 该席位的评审维度（Inspector 汇总展示） |
| `active` | 是否可用（`false` 则席位不参与圆桌） |
| 正文 | 系统提示词（System Prompt），定义独立思考立场 |

### 默认 3 席

| 文件 | id | 角色 | KPI 维度 |
|---|---|---|---|
| `cto.md` | CTO | 技术架构师 | 可行性、架构一致性、性能 |
| `cdo.md` | CDO | 设计负责人 | 用户体验、信息架构、视觉一致性 |
| `ciso.md` | CISO | 安全审计官 | 数据安全、权限边界、注入防护 |

### 解析规则（`prism_agents.rs`）

- 扫描 `.hermes/agents/*.md`，跳过空文件/空正文
- Frontmatter `---` 包裹，`key: value` 逐行解析；正文即 `prompt`
- 席位按 `id` 排序；自定义席位仅需新建 `*.md` 文件即可加入圆桌

## P0 / P1 交付清单

| Ticket | 交付 | 验证 |
|---|---|---|
| P0-1a | Agent 规约解析器（Frontmatter + 默认 3 高管 + 3 单测） | cargo ✅ |
| P0-1b | 多 Agent 圆桌辩论（席位勾选 → 并行流 → Inspector 观点） | CDP ✅ |
| P0-1c | 大容量画布 + ⌘Enter + 自适应高度 | CDP ✅ |
| P0-1d | 📌 固化为知识（共识消息 + Frontmatter 知识卡 + `#prism,#consensus` 标签） | CDP ✅ |
| P0-2a | `spawn_cli_process`（Tokio 子进程 + 流式日志 + Exit Code + Scope 校验） | 6 单测 ✅ |
| P0-2b | Actions c/v 键盘 + 📎 关联知识 + CLI 模板 + 唤醒终端 | CDP ✅ |
| P1-1 | Dashboard 控制塔 + 7 天 Token Sparkline + CLI 状态摘要 | CDP ✅ |
| P1-2 | 知识覆盖率 + 活性标记 + Hover 行动栏 + Obsidian 联动 | CDP ✅ |

## 质量门全绿

| 质量门 | 结果 |
|---|---|
| `cargo test --lib` | ✅ 229/229 |
| `cargo clippy` | ✅ |
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| `npx prettier --check .` | ✅ |
| `npm run build` | ✅ |
| `npm run verify:preview` | ✅ |

## 已知限制与后续

- **CLI 真实拉起**：`spawn_cli_process` 已在浏览器 fallback 全链路 mock 验证（流式日志 + exit 0），真实 claude/aider 拉起需桌面端（Tauri）回归。
- **Keyring 全量审计迁移**（AC-4.2）仍重定位在 v1.1.1-patch，见 `.scratch/hermes-station/issues/11-s10-keyring-hardening.md`。
- **P1 余项**：Dashboard 7 天 Sparkline 依赖 token-history 自 v1.2.3 起逐步累积；CLI runs 同理自本版开始统计。
- 自定义席位辩论（新增 `.hermes/agents/foo.md`）已支持，但 Inspector Trade-off 历史 ADR 自动匹配属后续 P2 增强。

## 归档说明

- 本文件为 v1.2.3 发行的事实来源（Single Source of Truth 扩展：`docs/plans/prism-station-prd.md`、`.scratch/prism-station/spec.md`）。
- Tag `v1.2.3` 已推送 `origin`。
