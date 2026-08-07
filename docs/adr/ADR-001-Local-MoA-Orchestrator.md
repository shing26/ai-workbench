# ADR-001: Local MoA Orchestrator（本地 MoA 编排层）

- 状态：Accepted（2026-08-07）
- 决策者：用户（经 `/grilling` 5 轮访谈定稿）
- 前置条件：**Sprint 0 完成 v1.0 P0 缺陷修复**（见 `docs/plans/BACKLOG.md` 相关 Ticket），本架构不得建于未修复的 P0 地基之上。

## 背景

v1.0 已交付 5 大主视图（AI Studio / Projects / Knowledge / Actions / System），Backlog 清空、8 项质量门全绿。双代理 UX 审查确认：v1.0 是"功能堆砌但摩擦高"，核心交互缺陷包括任务只增不减、草稿切视图即丢、MOA 浏览器模式死锁、破坏性批量操作无确认。

本轮决策为下一迭代（Sprint 1+）确立产品定位与架构方向：**个人本地 MoA 编排层**。企业级 MoA Gateway 是另一条产品线，不在本决策范围。

## 决策

### 1. 产品定位（4 维）

| 维度 | 决策 |
|---|---|
| 核心价值 | Solo Creator 的"个体能力放大器"；定位是**指导下一阶段开发的**目标态，不是对 v1.0 的现状描述。降低认知负荷的承诺须以修复 v1.0 摩擦为前提 |
| 产品形态 | **LUI 优先**的统一入口（CommandPalette 升级为万能入口），AppDock 退居二线 |
| 目标用户 | 主战场 = Solo Creator；员工/企业叙事降级为"未来可借鉴"，不纳入本轮 |
| 业务边界 | 本地粘合剂（本机文件系统 + Codex CLI + 用户自配外部服务），HITL 关键决策权在人，确认门在 Rust 层强制 |

### 2. 架构形态

本地桌面优先，**不重写 FastAPI 服务端**：

- Tauri 壳保留；编排层为同进程 Rust 服务或本地 sidecar。
- 状态落在 SQLite / 进程内，路由在本地，无云组件（无 Redis / ES / VectorDB / Guard Sidecar / Vault 服务）。
- 浏览器 fallback（`src/lib/db.ts` + localStorage）与 Rust 后端保持同构，双端行为一致。

### 3. 统一入口（LUI 优先）

- 删除死代码（`Sidebar.tsx` / `TopBar.tsx` / `CommandPalette.tsx` 旧实现 / 5 个旧视图 / 8 个旧 store）。
- 重写 CommandPalette 支持实体级搜索（笔记 / 项目 / 任务 / 动作），Ctrl+K 拉起，模糊匹配 + 最近使用排序。
- AppDock 只保留高频导航（仪表盘 / 设置），其余入口收归 LUI。
- 验收标准：80% 日常操作可在 3 次按键内完成，无需鼠标点 Dock。

### 4. 本地 Agent 名录与编排深度

本地 Agent 名录（solo 场景真实可用，各 4 个）：

| Agent | 职责 |
|---|---|
| codex_agent | Codex CLI 执行（代码生成 / 运行 / 调试） |
| webhook_agent | Webhook / 定时任务（外部触发 / 定时复盘） |
| recap_agent | 复盘（周 / 月自动汇总 + 记忆写入） |
| document_agent | 本地 Markdown 读写 / 双链解析 |

调度深度 = **真正的本地编排引擎**（任务图 / FSM），不是多 Provider 聊天路由器。核心工作流"想法→澄清→实现→运行→验收"用 FSM 状态机管理，每步可暂停 / 回退 / 人工接管。

编排引擎与 Automation / Connection Layer 的边界：

- 编排引擎 = 决策层：管"做什么、什么顺序、什么状态"。
- Automation / Connection Layer = 执行层：只管"怎么触发、怎么连外部"。
- 编排引擎不直接调外部 API，通过 Connection Layer 代理，保持本地同构。

### 5. 行为记忆

- 采集信号：显式反馈（点赞 / 点踩 / 编辑 AI 输出 / 手动修正）、隐式行为（同类任务重复 ≥3 次）、偏好声明（"以后别…"/"我喜欢…"）、时间模式（固定时段执行某类任务）。
- 存储：SQLite `user_behavior_memory` 表（`id, signal_type, payload_json, created_at, confidence_score, is_active`）。
- 裁剪：`confidence_score < 0.3` 且 30 天未触发 → `is_active=false`。
- 审计：设置页"记忆管理"面板，单条删除 / 禁用。
- 防改写主档案：行为记忆只写 `user_behavior_memory`，**绝不自动修改 `user-profile.md`**；主档案变更必须用户显式确认（HITL）。

### 6. Router + FSM 状态边界

- 状态：`fsm_nodes` 表逐节点持久化，字段含 `status`（pending / running / paused / blocked-on-human / complete / aborted）、`context_json`、`updated_at`；状态变更即写库。
- 复活：应用关闭 / 崩溃后从断点复活。跨设备**仅同步业务产物（笔记、最终代码）**，不跨设备续跑 FSM 实例（运行时上下文与本机强绑定）。
- 流式瞬态边界：in-flight 流状态存进程内 store（Zustand），切视图不丢；只有完整消息落库才持久化。
- 降级阶梯（4 级，浏览器 / 桌面双端一致）：
  1. health check 正常 → 用当前 provider；
  2. 失败 → 按优先级 fallback 到下一个 provider；
  3. 所有远程 provider 挂 → 切本地 Ollama（若可用）；
  4. Ollama 也挂 → 离线提示（状态栏小红点 + tooltip），不阻塞 UI、不弹窗。
  - 降级逻辑抽成独立 `router-fsm.ts` 模块，浏览器 / 桌面共用，单测覆盖 4 级路径。
- 歧义澄清：发送前过 `clarification-guard` 中间件 → LLM 判断是否需澄清 → 需澄清则返回问题列表，UI 渲染可点击选项，用户答完才入队执行。不做澄清 = 放弃 HITL 承诺，不可接受。

### 7. Sub-Agent 生命周期与并发

- 混合模型：**全局同一时刻只允许 1 个 FSM 实例**（新任务等旧任务 complete / abort）；单任务内并行 provider 上限 **3 路**（沿用 MoA 3 路并发）。
- 限流：单任务单次请求 `max_tokens 4096`；全局 TPM 限制 `60,000`，超限排队等下一分钟窗口。
- 定时 / Webhook Agent 只在**应用打开期间**运行（不上自启、不加托盘，3050 Ti 资源敏感）。
- 错过窗口自愈：启动时读 `agent_schedules.last_run_at` + cron 算错过窗口；复盘 Agent 只补跑最近一次错过周期；Webhook 投递按指数退避重试（最多 3 次），超 24h 标记 expired 记审计。

### 8. Evaluator + 零信任执行

- **Fail-Closed（默认）**：无人值守节点任何异常（LLM 超时 >30s、空 / 纯空白输出、schema 校验失败、单节点 token >2048、敏感性检查失败）→ 节点 `failed`，不写入记忆、不投递，转 `blocked-on-human`。
- 可容忍降级：部分内容 + 截断标记 → `partial`，写审计，不写入记忆 / 不投递，转 `blocked-on-human`。
- 输出校验中间件：自动写入记忆 / 自动投递前必过（schema / 空内容 / 预算 / 敏感性），校验不通过 Fail-Closed。
- Retry 语义：绑定 `node_id`（非 workflow 全局），`max_retries=2` + 指数退避（2s / 8s），第 3 次失败 → `blocked-on-human`。**provider 降级不算 retry**（路由层行为）；**澄清轮次不算 retry**（前置中间件）。

### 9. 授权与执行边界

- `permission_rules` 表：`subject`（Agent 类型）/ `action`（read / write / exec / delete / outbound）/ `object`（路径 / URL / 资源模式）/ `mode`（allow / deny / ask）。Guard 在节点执行前逐条匹配，命中 ask → 节点转 `blocked-on-human`。
- 初始规则示例：
  - `document_agent / read / ~/notes/** / allow`
  - `codex_agent / exec / **/* / ask`
  - `any / delete / **/* / deny`（删除走独立审批流，非弹窗确认）
- **确认门下沉 Rust Tauri 命令层**：命令执行前查 `permission_rules`，ask → 返回 `RequiresConfirmation`，deny → 返回 `PermissionDenied`；前端只负责展示拦截结果。绕过前端直接调 IPC 同样被拦。
- 边界一句话："编排引擎不直接触碰钱包 / 支付 / 外部发布 / 本机敏感目录（/etc、/System、C:\Windows）"。保证方式 = **不存在对应 IPC 命令**（编译期白名单，非运行时检查）：文件系统命令硬编码允许路径（`~/notes`、`~/projects`、用户自定义工作区），白名单外编译期拒绝。

### 10. 幂等与去重

- Webhook 重试 = **同一条 delivery 重发**，`delivery_id`（ULID）保持不变，接收方靠此去重。
- 事件触发：`webhook_deliveries` 增加 `UNIQUE(rule_id, event_id)`，插入用 `INSERT OR IGNORE`，DB 层防重复入队。
- 三个入口（自愈 / 手动 Run now / 事件触发）收敛到同一 Rust `enqueue_delivery` 函数；不引入额外 `delivery_inflight` 内存表；审计记录"尝试入队但被忽略"。

### 11. 可观测性

- trace：FSM run 创建时在 Rust 层生成 **ULID**（字典序可排序），贯通 `fsm_nodes.context_json` → Provider 调用层（log context）→ `error_logs` / `webhook_deliveries` / `run_metrics`；日志查询 UI 支持按 trace 聚合。
- 指标：引入 `run_metrics` 表（`run_id, trace_id, kind, started_at, ended_at, node_count, hitl_count, total_tokens, status`），复盘 Agent 直接查表。
- Mock：引入 `MOCK_ALL_AGENTS` 开关，开启后 Rust 层拦截所有外部调用（LLM 返回 fixture、Codex CLI 返回 mock 结果、Webhook 只写日志），用于离线开发 FSM 状态机。

### 12. 成本与合规

- **前缀缓存**：同 session 的 system prompt 前缀复用（依赖 Provider Prompt Caching 能力）。
- **条件校验**：`permission_rules` 命中 read 的节点跳过 schema / 敏感性校验；仅 write / exec / delete / outbound 节点跑完整校验。
- 三管齐下压成本：前缀缓存 + 条件校验 + Q7 的 TPM 门控。
- 被遗忘权级联删除：
  - **强级联物理删**：messages、fsm_nodes、run_metrics、error_logs（跟随 run_id 删）。
  - **不级联物理删**：sync snapshot（下次同步自然覆盖）、vault 索引（后台 rebuild 自然剔除）、webhook 投递日志（保留审计痕迹，payload 置空）、user_behavior_memory（关联条目 `is_active=false`）。
- 密钥边界：FSM 节点产生的临时密钥 / 令牌（Codex 登录态、OAuth token）只进 Keyring / 进程内内存，**不落 `fsm_nodes.context_json`**；context_json 只存 Keyring 引用 ID（如 `keyring_ref: "codex_session_123"`），Rust 执行时动态读取。

## 前置条件（Sprint 0）

ADR-001 落地前必须完成 v1.0 P0 缺陷修复（"还债"优先于"建新"），否则 FSM 状态机会建立在有缺陷的任务地基上：

1. Task 删除 / 改名（`delete_task` / `update_task_title`，双端同构）。
2. 草稿 / 交互状态持久化（视图切换不丢）。
3. MOA 浏览器模式死锁修复。
4. 无确认批量操作（`clear_sync_audit`、`prune_webhook_deliveries`、`archiveWeekDone` 等）补 HITL 确认 / 审批流。
5. 破坏性操作确认下沉 Rust 层（与 §9 同向，先行落地）。

## 后果

- 正面：定位与 v1.0 现状解耦，下一迭代有明确目标态；编排、授权、可观测、幂等、成本、合规六层决策闭环，避免绿地重构反复。
- 代价：Sprint 0 纯还债无新功能；LUI 优先是一次 UX 重构；FSM 编排 + Guard + trace 体系是显著新增工程量。
- 风险：1 FSM 全局串行可能成为多任务用户瓶颈（本轮按"一件事做透"偏好接受）；App 关闭即停靠外部触发（已用错过窗口自愈缓解）；`MOCK_ALL_AGENTS` 与真实链路行为差异需测试兜底。

## 未决事项（后续层，本轮不展开）

- FSM 状态机事件表 / 转移矩阵细化。
- `clarification-guard` 中间件数据流与触发阈值。
- `permission_rules` 匹配引擎实现（前缀匹配 / 正则 / 参数化）。
- 企业 MoA Gateway 产品线（明确不在本轮范围）。

## 前端落地决策矩阵（2026-08-07 design tree 访谈 Q1–Q16 同步）

与 `docs/plans/frontend-refactor-adr001.md` 决策矩阵保持一致（该文件为权威源，此处为摘要）。共同理解确认后才可实施。

| # | 决策 |
|---|---|
| Q1 | 全视图保活（hidden）+ 监听上移 store + 后台节流 |
| Q2 | 三层层级（Stage/Rail/Fold）；SystemView Stage = Agent Live Event Stream；Projects 平铺特例 |
| Q3 | 内存 Ring Buffer（N=500）+ 分层落库；新增 `fsm://node/updated` 事件 |
| Q4 | 三档节流 + `useActiveThrottle` hook |
| Q5 | Lazy Mount + Keep Alive（首访才挂载） |
| Q6 | `stores/events.ts` 单一订阅 + `useEvent` 分发；流式按 runId 路由 |
| Q7 | CommandRegistry + commandUsage 排序；Ctrl+K 唯一入口 |
| Q8 | WorkbenchError 结构化错误 + usePermissionGuard（Rust 兜底裁决） |
| Q9 | SystemView 按层级拆 6 组件（Stage/Rail/Fold）；配置收进抽屉 |
| Q10 | Projects grid 模式（tier=grid）+ ProjectDetailView |
| Q11 | Carousel 双形态共存：grid 默认 + carousel 可选，关自动轮播默认 |
| Q12 | viewState 只上移 4 类高投入态；仅内存 |
| Q13 | withDbLock 注入 ~10 个内部写函数，不锁读 |
| Q14 | MOCK_ALL_AGENTS 只 Mock 外部 I/O 5 类，默认关 + Mock 徽标 |
| Q15 | 新建 SystemDrawer（420px 可交互）；AppInspector 保持只读 |
| Q16 | 前端契约先行 + Mock 驱动；后端就绪后事件源无感切换 |

## 参考

- `docs/RELEASE-v1.md`（v1.0 现状与已知限制）
- `docs/ai-workbench-design.md`（设计文档，本 ADR 是其编排 + 授权部分的具体化）
- `docs/user-profile.md`（Solo Creator 用户档案）
- `docs/plans/frontend-refactor-adr001.md`（前端改造规划 + Q1–Q16 决策矩阵，权威源）
- 双代理 UX 审查（2026-08-07，grilling 输入）
