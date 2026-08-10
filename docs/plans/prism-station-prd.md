# Prism Station — 产品需求文档 (PRD) v1.2.3-Final

> Single Source of Truth：本文件是 Prism Station（光棱控制台）唯一事实来源。
> 状态：Approved（决策：方案 B — 先落盘 + 拆 tickets，按 P0 优先实施智脑 Canvas + CLI 唤醒）
> 独立品牌：Prism Station (PRISM ENGINE)
> 上游：Hermes Station v1.1-alpha（`docs/RELEASE-v1.1-alpha.md`，本 PRD 在其 5 大解耦空间基础上增强）

## 1. 产品定位

- **核心定位**："一人公司（One-Person Enterprise）" AI CPO 桌面级操作系统。
- **品牌愿景**：如三棱镜（Prism）将光束折射为光谱，开发者担任 **CPO**，将产品构想输入系统，由虚拟高管层（CTO/CDO/CISO）多维立论与辩论，通过纯净 Spec 调度本地 CLI 工程师兵团（Claude Code、Aider 等）在本地仓库完成代码落地，将"孵化心路"沉淀为企业数字资产。
- **技术架构**：Tauri v2 (Rust) + Tokio Async + SQLite (Rusqlite) + Tailwind CSS (Cyber Frost Slate) + Obsidian Interop。

```text
 👑 用户 (CPO 产品构想) ──► 🧠 虚拟高管层圆桌会商 ──► 📌 固化为知识卡片 / Spec
                                                                  │
 📚 企业数字资产 (Obsidian) ◄── 检查通过归档 ◄── 🎯 本地 CLI 程序员跑代码 (Actions)
```

## 2. 四大协同原则

1. **思考与干活严格解耦**：AI Studio 完成开放性讨论，仅导出几十 KB 结构化 Spec 喂给 CLI，上下文消耗减少 70%+。
2. **本地优先与绝对安全 (Local-First)**：数据落盘本地 SQLite + 纯文本 Markdown，物理 Scope 隔离，绝不跨项目覆盖。
3. **多 Agent 独立思考与交叉质控**：不同部门高管 Agent 独立 System Prompt、KPI 与思考立场，圆桌会议中辩论互补。
4. **知识活体演进**：`闪念/疑问 ➔ 多 Agent 论证 ➔ 📌 固化为知识 ➔ 📎 关联任务 ➔ CLI 派发 ➔ 健康检查归档`。

## 3. 五大解耦功能空间

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Prism Station 5 大解耦功能空间                       │
└────────────────────────────────────────────────────────────────────────┘
  ├── 📊 1. 控制塔 (Dashboard)    ──► 7天 Token 算盘 + 今日焦点决策 + CLI 状态摘要
  ├── 📁 2. 项目矩阵 (Projects)   ──► 仓库 Scope 锁定 + Git 矩阵 + 知识覆盖率警告
  ├── 💬 3. 智脑 Canvas (Studio)  ──► 多 Agent 圆桌辩论 + Trade-off 评估 + 📌 固化知识
  ├── 🎯 4. 交付终端 (Actions)    ──► 全键盘流 + 📎 关联知识注入 + CLI 进程唤醒
  └── 📚 5. 活体知识库 (Knowledge)──► F型卡片 + 活性衰减 + 语义搜索 + Obsidian 联动
```

### 3.1 📊 控制塔 (Dashboard)

- **核心职责**：全局监控、风险告警与今日焦点决策信号，下沉并移除所有命令行发送框。
- 全局 4 栏 Bento Grid：纳管项目数、7 天 Token 瘦身趋势 Sparkline、CLI 智能体状态摘要（在线数与历史成功率）、活体知识健康度。
- 今日焦点三栏面板：🎯 今日 Top DoD / 🚨 阻塞告警 (Blocked) / 🤖 AI 风险推送（多高管辩论 Trade-off 警示）。

### 3.2 📁 项目矩阵 (Projects)

- **Scope 物理隔离**：锁定仓库绝对路径，禁止跨目录越权读写。
- **📚 知识覆盖率**：`已文档化模块数 / 总模块数`，低于阈值（如 50%）黄色警告，点击直达 Knowledge 过滤。
- **AI Conventional Commit 生成**：抓取 git diff + 已完成 DoD，生成符合规范的提交信息（例：`feat(ui): complete Sprint 8 DoD noise reduction`）。

### 3.3 💬 需求论证 Canvas (AI Studio)

- **👥 多 Agent 圆桌智囊团**：多选勾选在席高管（`🦀 @rust-architect`、`🎨 @ui-designer`、`🛡️ @security-auditor`）。
- **独立思考与交叉辩论**：Rust 异步并发调度，Agent 依自身规约独立思考并针对前人方案交互质疑补充。
- **`📌 固化为知识` 按钮**：共识达成后一键将结论写入 Knowledge（Markdown + Frontmatter）。
- **Trade-off 与历史决策回溯**：右侧抽屉展示 Pros/Cons/Security 风险，自动匹配历史 ADR。
- **界面规格**：大容量画布（`min-h-[640px]`，消息渲染 `h-[520px]`），多行自适应 `<textarea>`（`⌘Enter` 秒级发送）。

### 3.4 🎯 交付终端 (Actions)

- **全键盘操控**：`j`/`k` 游走、`x` 完成、`c` 派发 CLI、`v` 健康检查。
- **`📎 关联知识`**：弹窗选择 Knowledge 卡片，`.md` 路径注入 CLI 命令模板。
- **Blocked 依赖链可视化**：被阻断任务红色虚线边框 + 告警高亮。
- **CLI 进程唤醒与 SSE 流式输出**：Tokio 线程唤醒系统终端/后台子进程，逐行流式渲染日志并回显 Exit Code。

### 3.5 📚 活体知识库 (Knowledge)

- **自然语言语义搜索 (⌘K)**：自然语言输入实时匹配过滤卡片。
- **F 型阅读布局与活性标记**：卡片标注 `🔥 3h前引用` / `❄️ 45d未激活` / `⚠️ 描述冲突`。
- **Hover 快捷行动栏**：`⚡ 注入 Context` | `🧩 拆解 DoD` | `💬 论证` | `🔮 Obsidian`。
- **Obsidian 零摩擦联动**：`obsidian://open?path={encodeURIComponent(fullPath)}` 绝对路径协议精准定位；图谱 (Graph View) 与田字格 (Grid View) 秒切。

## 4. 敏捷 Sprint 实施计划

```text
  Sprint 1: 基础设施与控制塔 ──► Sprint 2: 智脑 Canvas 与多 Agent 圆桌
                                                  │
  Sprint 4: 交付终端与 CLI 派发 ◄── Sprint 3: 活体知识库与 Obsidian 联动
```

### Sprint 1 — 基础设施、SQLite 持久化与控制塔（2 周）
1. Tauri v2 + Rust 骨架 + Cyber Frost Slate 高透毛玻璃布局
2. SQLite 建表（projects / tasks / knowledge_cards）
3. Dashboard：7 天 Token 瘦身 Sparkline、今日焦点三栏（Top DoD / 阻塞告警 / AI 风险）
4. Projects：Scope 物理锁定、git status/diff、知识覆盖率算法

### Sprint 2 — 智脑 Canvas 与多 Agent 圆桌会商（2 周）【P0 优先】
1. `.hermes/agents/` 规约解析器，载入 cto/cdo/ciso Markdown Frontmatter
2. Studio 大容量画布（`h-[520px]`）+ 多行 `<textarea>` + `⌘Enter` 发送
3. Rust 串并行混合调度器：多 Agent 独立思考 ➔ 交叉质疑辩论
4. `📌 固化为知识`：对话共识落盘标准 Markdown
5. 右侧 Trade-off 提取 + 历史决策 ADR 检索

### Sprint 3 — 活体知识库与 Obsidian 零摩擦联动（1.5 周）
1. Knowledge F 型布局卡片 + 分类 Filter Tabs
2. 知识活性指标（基于 last_referenced_at 渲染 🔥/❄️/⚠️）
3. Hover 快捷行动栏（注入 Context / 拆解 DoD / 论证）
4. `open_obsidian` 接口（`obsidian://open?path=` 绝对路径）
5. AI Curator 冲突警告 + 知识缺口 Header Banner

### Sprint 4 — 交付终端、CLI 派发与质量闭环（1.5 周）【P0 优先】
1. Actions 全键盘（j/k/x/c/v）
2. `📎 关联知识` 选择弹窗 → 路径注入 CLI 模板
3. Blocked 依赖可视化（红色虚线边框）
4. `spawn_cli_process`：Tokio 调系统 claude/aider 进程 + Tauri Event 流式 emit 日志
5. 健康检查（cargo check / npx tsc --noEmit），Exit Code 0 全绿归档

## 5. 全局验收标准 (AC & DoD)

### 5.1 全局代码健康门禁
- Rust：`cargo check --workspace && cargo clippy -- -D warnings`，0 error 0 warning，IPC 响应 < 2ms。
- 前端：`npx tsc --noEmit`，0 类型错误，无样式溢出，支持浅/深色热切。
- 安全：严禁 IPC 字符串 SQL 拼接；所有文件操作执行 `project_root` Scope 越权检查。

### 5.2 各 Sprint DoD Matrix

| 阶段 | 交付模块 | 关键验收标准 |
| --- | --- | --- |
| Sprint 1 | 控制塔 & 项目矩阵 | 1. 读取本地 Git Diff 与分支。<br>2. 知识覆盖率低阈值黄色警告。<br>3. Dashboard 渲染 7 天 Token Sparkline，无 CLI 发送框。 |
| Sprint 2 | 智脑 Canvas | 1. 勾选 Agent 席位 → 独立思辨与辩论交互。<br>2. 大容量画布稳定 + 多行 `⌘Enter`。<br>3. `📌 固化为知识` 生成结构化 Markdown 卡片。 |
| Sprint 3 | 活体知识库 | 1. `🔮 Obsidian` 无 Vault not found，秒级拉起并高亮。<br>2. Hover `⚡ 注入 Context` 装配路径入 CLI 模板。<br>3. 拓扑网图与田字格无缝切换。 |
| Sprint 4 | 交付终端 | 1. `📎 关联知识` 弹窗 → CLI 预览模板刷入路径。<br>2. `🚀 唤醒本地 CLI` 真实拉起 claude/aider + 逐行流式日志。<br>3. `✓ 检查 (v)` 真实执行健康检查并弹校验结果。 |

## 6. 知识资产沉淀与结项工作流

- 项目 Sprint/Milestone 完成（Actions 全绿 + cargo check 通过）→ 自动唤起结项沉淀：
  - 项目复盘卡 (Post-Mortem) → `docs/retros/YYYY-MM-DD-retro.md`
  - 架构决策记录 (ADR) → `docs/adrs/ADR-xxx-decision.md`
- 所有 `.md` 携带 YAML Frontmatter（id / tags / status / created_at）。
- 文档内使用 Obsidian `[[WikiLinks]]` 双向链接。
- 生成文件自动同步至 SQLite `knowledge_cards` 表，供 `#` 检索。

## 7. 本阶段实施决策（方案 B）

- **范围**：先落盘本 PRD + 拆 4 Sprint tickets；**按 P0 优先实施**：智脑 Canvas（Sprint 2）+ CLI 唤醒（Sprint 4）。
- **复用**：Hermes Station 的 5 视图骨架、SQLite、上下文管线、键盘引擎、Quality Gate 全部复用。
- **tickets**：`.scratch/prism-station/`（spec + issues）。
- **验收**：每 Sprint 结束 cargo test + verify:preview 双端绿。
