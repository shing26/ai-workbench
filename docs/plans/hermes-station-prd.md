# Hermes Station — AI-Native 产品需求文档 (PRD)

> Single Source of Truth：本文件是 Hermes Station（赫尔墨斯全栈 AI 控制台）唯一事实来源。
> 所有 AI Agent（Cursor / Claude / OpenClaw 等）辅助编程时必须先读取本文件。
> 状态：Approved（v1.0.0-alpha 之后，Sprint 7+ 迭代依据）

## 1. 产品基本信息

- **产品名称**：Hermes Station（赫尔墨斯全栈 AI 控制台）
- **定位**：Local-First 极客级 AI 编程控制塔，连接本地 Git 资产、MOA 共识引擎与 Linear 式任务流。
- **设计哲学**：`Intent as Code, Agent as Runtime`（意图即代码，Agent 即运行时）。彻底消灭冗余手敲，实现"意图下发 ➔ 智能生成 ➔ 校验门禁 ➔ 原子写入"的自动化闭环。
- **形态**：Tauri 2 桌面 + React/TS + Rust + SQLite（Local-First，数据不出本机）。

## 2. 核心模块与功能规范

### 2.1 📁 Projects & Vibe Pipeline（工程控制塔）

**上下文自动化挂载 (Vibe Context Mount)**
- 点击 `[⚡ 进入 Vibe Coding]`，后台自动调用 `libgit2` 读取当前项目的 Uncommitted Diffs、HEAD 分支与未完成 DoD，结构化组装为 `<vibe_context>` XML 注入 AI 上下文。

**代码门禁 (Quality Gate)**
- 替换传统虚荣指标（如收益），顶栏实时展示 `Quality Gate` 状态（自动静默跑 `tsc` / `lint` / `prettier` 校验）。

**待攻坚 DoD 嵌套**
- 项目卡片内部直观展示绑定该 `project_id` 的待攻坚 DoD 任务，与 `Actions` 视图实现双向状态同步。

**Inline Git Diff 折叠树**
- 点击卡片内的变更文件数量（如 `2 files changed ▾`），展开 Inline 变动树，支持侧滑抽屉对比 Diff。

### 2.2 💬 AI Studio & MOA Consensus（对话与共识 Canvas）

**多模型共识 (MOA Consensus)**
- 支持对极具挑战性的架构问题并发请求 3 个模型节点（如 Qwen 2.5 + GPT-4o + Ollama Local），并由 Aggregator 提炼出最终共识代码。

**原子级安全写入 (`[⚡ Apply]`)**
- 点击代码块上的 `Apply` 按钮，后台在覆盖本地文件前 **1 毫秒内** 自动将原文件压入 `.hermes/backups` 阴影快照，支持 `⌘Z` 一键撤销。

**写入后事件广播**
- 文件成功写入后，向 Event Bus 广播变更，`Projects` 卡片的 Git Diff 计数与状态增量实时刷新。

### 2.3 🎯 Actions & Schedule（Linear 级键盘流）

**Linear 全键盘快捷键引擎**
- 支持 `j`/`k` 上下光标游走、`n` 极速新建 Task、`x` 标记完成、`p` 置顶到 Today's Focus、`a` 触发 AI 3 步拆解。

**DoD 状态双向闭环**
- 在 Actions 勾选完成带有 `#project_id` 标签的任务，`Projects` 控制台对应的 `🎯 待攻坚 DoD` 计数秒级实时削减。

### 2.4 ⚙️ System & Provider Operations（运维与 API 热切）

**API 自由热切换 (Hot-Swapping)**
- 可纳管多个全兼容 OpenAI 协议的 API 端点，支持一键热切当前生效的 API 节点，并带 3 秒熔断降级退避机制。

**OS Keyring 凭据安全**
- API Key 直写操作系统 Keychain / Credential Manager，脱敏显示（`sk-proj-••••`），禁止明文落盘。

**资源开销与清理**
- 监控 `workbench.db` 本地占用，提供一键 `🧹 清理快照` 按钮，安全精简历史文件阴影快照。

**全局 i18n 语言热切**
- 顶栏集成 `🌐 Locale` 快捷胶囊，支持 `中文` / `EN` / `日本語` 即时切变，配置持久化落盘。

## 3. AI Coding 时代交付验收标准 (Acceptance Criteria / DoD)

任何提交的版本必须 100% 通过以下 **4 个维度、12 条硬核验收标准**。

### 维度 1：Vibe Pipeline & 上下文装配验收

| 序号 | 验收测试场景 | 预期标准 (Pass Criteria) |
| --- | --- | --- |
| **AC-1.1** | 点击项目卡片 `[⚡ 进入 Vibe Coding]` | 1. 自动调用 `libgit2` 提取变更树，耗时 < 50ms。<br>2. 自动跳转 `AI Studio`，顶部高亮浮现 `Mounted: [Project (Branch)]` 标签。 |
| **AC-1.2** | 点击 `x files changed ▾` 展开 Diff | 树形结构无卡顿展开，准确显示文件变动行数（如 `+12, -4`）。 |
| **AC-1.3** | 门禁 Quality Gate 静默校验 | 当项目本地代码存在 TypeScript / Lint 报错时，顶栏门禁状态自动由 `ALL GREEN ✅` 切变为 `CHECK FAILED ❌`。 |

### 维度 2：代码 Apply 写入与安全撤销验收

| 序号 | 验收测试场景 | 预期标准 (Pass Criteria) |
| --- | --- | --- |
| **AC-2.1** | 点击 AI 生成代码块的 `[⚡ Apply]` | 1. 目标文件被原子写入，按钮变为 `[✓ 已写入本地]`。<br>2. `.hermes/backups/` 目录下瞬间生成带时间戳的原文件快照备份。 |
| **AC-2.2** | 触发代码还原 (`⌘Z` 或 Rollback) | 能够将文件恢复为 Apply 前的内容，无任何语法损坏或文件锁死。 |
| **AC-2.3** | MOA 节点故障降级 | 当某一 API 节点超时（> 3s）或报 429 时，系统自动标记为 `Disconnected` 并跳过，其余正常节点继续打字流输出，界面不卡死。 |

### 维度 3：DoD 双向同步与全键盘流验收

| 序号 | 验收测试场景 | 预期标准 (Pass Criteria) |
| --- | --- | --- |
| **AC-3.1** | Actions 视图键盘游走 | 按下 `j`/`k` 键，高亮光标在 Task 列表间流畅上下切变，响应延迟 < 5ms。 |
| **AC-3.2** | 按 `x` 勾选完成 DoD Task | 1. 当前 Task 呈现划线淡出动画。<br>2. 切换回 `Projects` 视图，对应卡片的 `待攻坚 DoD` 计数增量 -1，无需刷新页面。 |
| **AC-3.3** | 按 `a` 键呼出 AI 拆解 | 弹窗展示针对当前 Task 的 3 步代码落地建议，支持一键投递至 AI Studio 执行。 |

### 维度 4：API 热切、Keyring 与 i18n 验收

| 序号 | 验收测试场景 | 预期标准 (Pass Criteria) |
| --- | --- | --- |
| **AC-4.1** | API 节点热切换 | 在 System 视图点击任意 API 卡片的 `[⚡ 设为当前 API]`，全局 Zustand Store 与 Rust 后端 Client 句柄瞬间更新，无须重启应用。 |
| **AC-4.2** | API Key 存储安全性 | 抓取前端 LocalStorage 与配置文件，确认**不存在明文 API Key**，Key 必须安全离线归档至 OS Keychain。 |
| **AC-4.3** | 全局语言切换 (i18n) | 点击顶栏 `🌐 Locale` 中的 `EN` 或 `日本語`，全局 UI 标语、状态文字秒级更新，且重启客户端后语言配置依然有效。 |

## 4. 历史里程碑（Sprint 1-5，v1.0 已交付）

> 以下 5 个 Sprint 是 v1.0.0-alpha 已交付能力的正式归档（开发基线），Sprint 7+ 在其上迭代。

### Sprint 1 — 骨架基座、Tauri IPC 与 System 运维中枢
**目标**：建立全屏响应式 App Shell、Tauri 2.0 后端 IPC 通信桥梁、OS Keyring 凭据加密与 API 热切换机制。

- 前端 Shell：React + Tailwind + Zustand 骨架，全屏撑满、顶部拖拽条、底部 Apple Glass Dock
- Rust IPC 桥梁：`tauriBridge.ts` 强类型接口，前端 `invoke` 异步调用
- System 视图：API Profile 卡片网格、一键 `⚡ 设为当前 API` 热切、`⚡ 批量 Ping` 探测
- OS Keyring：keyring-rs 加密存取 + 脱敏显示（`sk-proj-••••`）
- 全局 i18n 引擎：顶栏 `🌐 Locale` 胶囊，zh-CN / en-US / ja-JP 无刷新字典切变 + SQLite 落盘
- **DoD**：AC-4.1 / AC-4.2 / AC-4.3

### Sprint 2 — 工程控制塔、Git 扫描与 Vibe Pipeline
**目标**：打通本地 Git 资产扫描、Quality Gate 门禁、项目卡片矩阵与上下文打包流水线。

- Projects 视图：2 列响应式 Bento Grid
- libgit2 集成：Rust `git2` crate，HEAD 分支 + Uncommitted Diffs 毫秒级扫描
- Inline Git Diff 展开树：`x files changed ▾` 折叠展开 + 变动 Hunk 预览
- Vibe Context Mount：`⚡ 进入 Vibe Coding` 毫秒级流水线，构造 `<vibe_context>` XML 并发射切变事件
- Quality Gate 静默校验：异步跑 tsc / lint 诊断，顶栏 ALL GREEN ✅ 状态
- **DoD**：AC-1.1 / AC-1.2 / AC-1.3

### Sprint 3 — AI Studio、MOA 共识与安全代码 Apply 写入
**目标**：打造多模型共识 Canvas，实现带阴影快照与一键 Rollback 的安全文件写入引擎。

- AI Studio：对话面板、挂载 Context 状态 Banner、Markdown / CodeBlock 渲染器
- MOA 降级流引擎：Rust `tokio::spawn` 多 API 节点并发，3s 超时自动退避 + Aggregator 提炼
- 原子文件 Apply（`apply_code_snippet`）：写入前压入 `.hermes/backups/` 快照，写入后广播 `FILE_UPDATED`
- 快照撤销（Rollback Engine）：⌘Z / 按钮一键恢复 Apply 前状态
- **DoD**：AC-2.1 / AC-2.2 / AC-2.3

### Sprint 4 — Linear 全键盘引擎与 Projects DoD 双向同步
**目标**：实现无鼠标全键盘驱动的任务流，建立 SQLite 关系引擎与 Projects DoD 增量更新机制。

- Actions 视图：Today's Focus、Habit Streaks、Linear Task 列表
- Linear-Style Shortcuts Engine：keydown 监听，j/k 游走高亮、n 新建、x 完成、p 置顶、a AI 3 步拆解
- SQLite tasks Migration：`project_id`、`is_dod` 索引字段
- DoD 增量事件广播：勾选完成 → Rust 推 `DOD_STATUS_CHANGED` → Projects 卡 DoD 计数实时削减
- **DoD**：AC-3.1 / AC-3.2 / AC-3.3

### Sprint 5 — 闪念 Inbox、Obsidian RAG 与 v1.0-alpha 发布
**目标**：实现闪念捕获与 Obsidian 向量 RAG，全系统回归测试与客户端打包。

- Knowledge 视图：⌘N 全局唤醒闪念捕获框
- 正文 #tag 自动解析器：剥离正文与标签，归类标签云
- Obsidian Vault 向量 RAG：本地 Embeddings 索引，AI Studio 检索笔记图谱
- 全系统集成测试 & 瘦身：`🧹 清理快照` 缩减 SQLite 体积，打包 macOS .dmg / .app
- **DoD**：100% 覆核 12 条 AC，输出 `Hermes-Station-v1.0-alpha.dmg`

### Sprint 进度跟踪总览表

| Sprint | 核心主题 | 关联核心视图 | 主要技术栈 | 预估交付物 |
|---|---|---|---|---|
| Sprint 1 | 骨架基座 & 系统运维 | ⚙️ System | React, Tauri IPC, Keyring, i18n | 全屏 App Shell + API 热切 + Keychain 凭据库 |
| Sprint 2 | 工程控制塔 & Vibe Pipeline | 📁 Projects | libgit2, Quality Gate, Bento Grid | Git Diff 扫描树 + ⚡ Vibe Coding 上下文挂载 |
| Sprint 3 | MOA 共识 & Apply 安全写入 | 💬 AI Studio | Tokio Multi-thread, Atomic File I/O | 多模型共识 Canvas + 阴影快照代码写入引擎 |
| Sprint 4 | Linear 键盘流 & DoD 闭环 | 🎯 Actions | Shortcuts Engine, SQLite, Event Bus | j/k/x 全键盘流 + Projects DoD 双向增量同步 |
| Sprint 5 | 闪念 RAG & v1.0 发布 | 🧠 Knowledge | Local Embeddings, Obsidian Vault, Tauri Packager | 闪念捕获 + v1.0-alpha 桌面端打包 |

## 5. 迭代规划（Sprint 7+）

按价值优先级分 4 个小 Sprint 迭代推进：

### Sprint 7 — 资产安全优先（Code Apply 原子写入 + 备份撤销）
- `.hermes/backups` 阴影快照机制（Rust 原子写入 + 时间戳备份 + ⌘Z 撤销）
- AI Studio 代码块 `[⚡ Apply]` 按钮 + `[✓ 已写入本地]` 状态
- 写入后 Event Bus 广播 → Projects Git Diff 计数实时刷新
- 验收：AC-2.1 / AC-2.2

### Sprint 8 — 工程闭环（DoD 绑定 + Quality Gate）
- Task 增加 `project_id` 绑定 + Actions/Projects 双向计数同步
- 顶栏 Quality Gate（tsc/lint/prettier 静默校验 → ALL GREEN / CHECK FAILED）
- 项目卡 Inline Git Diff 折叠树（`x files changed ▾` → 变动树 + 行数）
- 验收：AC-1.3 / AC-3.2 / AC-1.2

### Sprint 9 — 极客体验（Linear 全键盘 + MOA 降级强化）
- 键盘引擎 j/k/x/p/a 完整实现
- `a` 键 AI 3 步拆解弹窗 + 一键投递 AI Studio
- MOA 节点 3s 熔断降级退避强化（Disconnected 标记 + 其余节点续流）
- 验收：AC-3.1 / AC-3.3 / AC-2.3

### Sprint 10 — 稳健与润色（API 热切 + Keyring 加固 + i18n）
- API 一键热切（Store + Rust Client 句柄即时更新）+ 3s 熔断退避
- Keyring 凭据安全加固（明文零落盘 + `sk-proj-••••` 脱敏）
- workbench.db 占用监控 + `🧹 清理快照`
- 全局 i18n 热切（中文/EN/日本語）+ 配置持久化
- 验收：AC-4.1 / AC-4.2 / AC-4.3

## 6. 设计哲学约束

- **Local-First**：数据、密钥、模型全部本地可控；重启 100% 无损。
- **Intent as Code, Agent as Runtime**：意图下发 → 智能生成 → 校验门禁 → 原子写入闭环。
- **资产安全优先**：任何覆盖写入前必须快照备份，可一键撤销。
- **双端同构**：浏览器 fallback（localStorage）与 Rust（SQLite）同语义，verify:ui / verify:preview 双端覆盖。
