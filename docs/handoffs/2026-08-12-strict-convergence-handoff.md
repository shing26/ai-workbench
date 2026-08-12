# AI Workbench Handoff - Prism Station 严格收敛

日期：2026-08-12
仓库：`D:\ai-workbench`（分支 `develop`）
上一份交接：`docs/handoffs/2026-08-11-prism-station-v1.2.3-handoff.md`

## 本次目标

按用户提供的单页 HTML（`C:\Users\Shing\.codex\attachments\083d193e-d458-4ae9-a5e9-07c520a6559e\pasted-text.txt`）严格收敛为 5 个空间，并保证前端与 Rust 后端逻辑相通。

## 已完成

### 前端 5 视图收敛

- `src/views/DashboardView.tsx`：4 指标卡（纳管项目 / Token 7 天趋势 / CLI 兵团摘要 / 活体知识健康度）+ 今日焦点三栏（Top DoD / 阻塞告警 / AI 风险推送），全部接真实数据源。
- `src/views/ProjectsView.tsx`：项目矩阵 + 知识覆盖率 + CLI 派发 + 关联知识 + 新建/删除/状态（此前已完成，本次仅修类型并格式化）。
- `src/views/AIStudioView.tsx`：重写为 3 Agent 圆桌辩论 + ⌘Enter 派发 + Trade-off 提炼 + 固化为知识 + 历史回溯；删除会话管理、快捷提示、MOA 链、Team、RAG 确认 UI、Token 预算 UI。
- `src/views/ActionsView.tsx`：Today Focus + Fast list + CLI 流水线（真实 `spawnCliProcess` 统计）+ 全局 CLI/关联知识模态派发；删除健康检查与归档区段。
- `src/views/KnowledgeView.tsx`：AI Curator 头部 + 语义搜索入口（⌘K / `/`）+ 类型过滤 + Grid/Graph 切换 + 活性（🔥/⚠️/❄️）+ Obsidian 联动 + 注入 Context；删除 Thought Inbox / Tag Library / Vault Index / Vector / 聚类 / doc health；监听 `COMMAND_OPEN_THOUGHT` 打开知识卡片。

### 全局壳层与模态

- `src/App.tsx`：移除 `AppInspector`，挂载 `PrismModals`。
- `src/components/ViewRouter.tsx`：移除 `SystemView`，仅 5 视图。
- `src/components/layout/AppDock.tsx` / `AppHeader.tsx`：按 HTML 重写为 PRISM ENGINE 品牌、5 导航、Obsidian、⌘K、CLI 选择器。
- `src/components/modals/PrismModals.tsx` + `prismModalsStore.ts`：全局搜索（真实 `searchThoughts`）、快捷键、CLI（真实 `spawnCliProcess` + 日志回流 + `recordCliRun`）、关联知识（真实 `listThoughts`）。
- 删除已无引用的废弃文件：`src/components/CommandPalette/`、`src/components/system/`、`src/components/layout/AppInspector.tsx`、`src/views/SystemView.tsx`、`src/views/ProjectDetailView.tsx`（CSS 体积由约 94KB 降至约 80KB）。

### 验证脚本

- `scripts/ui-verify.mjs`：11075 行旧脚本重写为约 250 行轻量 CDP 验证：5 视图可见性 + 关键选择器 + Dashboard 三栏 + 建项目 + Studio 席位 + Actions 任务/CLI 模态 + Knowledge Graph + ⌘K/快捷键模态 + 异常采集 + 截图。
- `scripts/preview-verify.mjs`：改为 `await runUiVerify()`，确保 preview 模式真实跑完 UI 断言。

## 质量门结果（2026-08-12 实跑）

- `npm run build` ✅（JS bundle 从约 960KB 降至约 325KB）
- `npm run lint` ✅
- `npx prettier --check "src/**/*.{ts,tsx,css}" scripts/*.mjs` ✅
- `cargo fmt --check` ✅（已对 `cli_spawn.rs` / `lib.rs` 执行 `cargo fmt`）
- `cargo clippy --all-targets --all-features -- -D warnings` ✅
- `cargo test` ✅ 129/129（Step 2 删除 db.rs 中对应孤儿 DB 函数/结构体及其 57 个测试后，仍保留 64 个覆盖核心/同步/事件/FSM 的底层测试）
- `npm run verify:ui` ✅
- `npm run verify:preview` ✅
- `npm run tauri build -- --debug --no-bundle` ✅（桌面端完整构建通过，产物 `src-tauri/target/debug/ai-workbench.exe`；Windows 下需先把 `C:\Users\Shing\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin` 加入 PATH，因为 `.cargo/bin` 只有 `.cmd` shim，Tauri CLI 找不到 `cargo.exe`）

## 后端孤儿代码（Step 1 已执行完成）

详见 `docs/plans/backend-convergence-step1-deletion-list.md`（已标记执行完成）。范围：Webhook / Vault Watch / Vector+Embedding+聚类 / 快捷提示 / 会话扩展命令 / Habits+Schedule 的 Rust 命令层已删除。执行结果：

- `src-tauri/src/lib.rs`：10008 行 -> 6736 行。
- 删除 `src-tauri/src/webhook_condition.rs`、`src-tauri/src/webhook_template.rs`。
- `src-tauri/src/db.rs` 顶部临时增加 `#![allow(dead_code)]`：Step 1 只清理命令层，底层 DB 孤儿函数与测试保留到 Step 2 统一移除后再删除该属性。
- 保留 `deliver_webhook_http`、`webhook_signature`、`WebhookDeliveryResult`：事件转发 worker 仍用它们做通用 HTTP POST。
- `emit_event_bus_event` 不再触发 webhook，`webhook_deliveries` 固定为 0。

## 后端孤儿代码（Step 2 已执行完成）

Step 2 清理 Rust 底层 DB 与浏览器 fallback 中对应 Step 1 已删功能的孤儿代码，并移除临时 `#![allow(dead_code)]`。

### `src-tauri/src/db.rs`

- 移除 160 个孤儿顶层项（Webhook / Vault Watch / Vector+Embedding+聚类 / Quick Prompt / Habits+Schedule / 会话扩展 / 消息版本 / FSM run metric 写入等）与 57 个对应测试；测试基线由 186 降至 129。
- 删除文件顶部 `#![allow(dead_code)]`，同时移除不再使用的 `use pinyin::ToPinyin;`。
- 保留 `get_embedding_config` / `seed_vector_shards` / `list_vector_shards` / quick prompt 读写等：同步快照（sync snapshot）与 `init_connection` 迁移仍引用它们。
- 规模：约 13364 行（PowerShell 统计）收敛至 7735 行；完整删除清单在 `.reasonix/db.rs.step2.removed.txt`，备份在 `.reasonix/db.rs.step2.bak`。

### `src/lib/db.ts`

- 移除 92 个浏览器 fallback 孤儿包装（Quick Prompt / 会话扩展 / Webhook / Vault Watch / Vector+Embedding+聚类 / Knowledge Index / Doc Health / `getRagIndexStatus` 等），全部调用的是 Step 1 已删的 Tauri 命令。
- `emitEventBusEvent` 与 Rust Step 1 对齐：不再调用 `triggerWebhookEvent`，返回值 `webhookDeliveries` 固定为 `0`；保留 `emitWorkbenchEvent`（事件/同步/剪贴板代码仍使用）。
- 顺带删除因此变成未引用的本地 helper / 类型 / 常量（session 搜索、webhook 模板与条件解析、vault index queue 模拟簇等），`tsc` 严格模式重新清零。
- 规模：9229 行收敛至 5776 行；删除清单在 `.reasonix/db.ts.step2.removed.txt`，备份在 `.reasonix/db.ts.step2.bak`。

### ViewId 收敛

- `src/stores/workbenchStore.ts` 与 `src/stores/viewState.ts` 的 `ViewId` 统一为 5 个：`ai-studio` / `dashboard` / `projects` / `knowledge` / `actions`，移除 `'system'`。

## 前后端对齐审计（2026-08-12）

- 命令层：全前端共 134 个 `invoke` 调用点，逐一比对 Rust `invoke_handler`（149 个注册命令），不存在“前端调用但后端未注册”的命令；所有 `invoke` 首参均为字符串字面量，无动态命令名绕过审计。
- 参数层：对 130 个带参数的命令做键名契约比对（按 Tauri camelCase→snake_case 归一化），发现并修复 2 处真不匹配：`create_thought` / `update_thought_type` 前端原传 `type`，Rust 参数名为 `kind`；已改为 `{ kind: type }`。其余命令参数全部对齐，`report_frontend_error` 的展开参数（`...input + deviceId`）经核对与 Rust 签名一致。
- 事件层：前端 9 个 `listen` 事件名全部能在 Rust 侧找到对应 `emit`；唯一未被前端监听的 `fsm://node/updated` 属于后端保留的 FSM API，符合 Step 1/2 的范围决定。
- 残留引用：全仓库扫描确认代码层无 `SystemView` / `ProjectDetailView` / `CommandPalette` / `AppInspector` / `SystemDrawer` / `SystemRail` / `SystemStage` / `webhook_condition.rs` / `webhook_template.rs` 残留；命中项均为历史文档（plans / RETRO / meetings / ARCHITECTURE）与 `db.rs` 保留的 schema 迁移。

## 孤儿源文件清理（2026-08-12）

确认 `src` 下无 `import.meta.glob` / 动态导入后，逐文件核对引用并 `git rm` 删除 14 个孤儿文件：

- `src/components/CodeBlockContent.tsx`、`src/components/ui/BentoCard.tsx`、`src/components/ui/MockBadge.tsx`、`src/components/ui/ProjectCarousel.tsx`、`src/components/ui/StatPill.tsx`、`src/components/ui/ThemeSwitcher.tsx`
- `src/lib/backend.ts`、`src/lib/commandUsage.ts`、`src/lib/diffHighlight.tsx`、`src/lib/i18n.ts`、`src/lib/tilt.ts`
- `src/stores/appStore.ts`、`src/stores/knowledgeStore.ts`、`src/stores/settingsStore.ts`

保留 `src/main.tsx`、`src/vite-env.d.ts` 与用户脏文件 `src/lib/searchHistory.ts`。删除后最新规模与质量门（重跑通过）：

- `src/lib/db.ts` 6147 行 / 186520 字节；`src-tauri/src/db.rs` 8187 行 / 288455 字节；`src-tauri/src/lib.rs` 6558 行 / 223517 字节。
- `npm run build`：JS 324.70 kB、CSS 75.10 kB；`tsc` / lint / prettier / `cargo fmt --check` / clippy / `cargo test` 129/129 / `verify:ui` / `verify:preview` 全绿。

## 孤儿导出 AST 审计（2026-08-12）

用 TypeScript AST + 调用图（前端根引用 → `db.ts` 顶层函数）统计 `src/lib/quickPrompts.ts`、`embed.ts`、`mockAgents.ts` 与 `db.ts` 导出可达性。初版正则统计会漏掉换行后的 `db\n.method()` 链式调用，已改用 AST 的 PropertyAccessExpression 复核：

- `quickPrompts.ts`：13 个导出全部 DEAD，仅被同步快照 / 同步冲突解析等未接线的 `db.ts` 包装引用；文件暂保留，待清理死包装后再删。
- `embed.ts`：`cosineSimilarity` / `embedText` / `embedTextRemote` / `hybridRagScore` KEEP（语义搜索 fallback 仍使用）；`EMBED_DIM` / `EmbeddingMode` / `shardFor` DEAD，但 `EmbeddingMode` 仍被 `db.ts` 的 `EmbeddingConfig` 类型引用，不能单独删。
- `mockAgents.ts`：`isMockAgentsEnabled` / `mockLlmReply` KEEP（流式 AI 消息 fallback 仍使用）；其余 6 个导出 DEAD，其中 `mockProviderHealth` 仍被 `db.ts` 的 `checkProviderHealth` 死包装导入，不能单独删。
- `db.ts`：155 个导出函数中 97 个从前端不可达（同步、Webhook / EventBus 高级接口、Git 高级操作、部门 / Agent、Provider 扩展、Quick Prompt、Agent Spec、向量 RAG 状态等）。本轮不直接删除，建议作为可选 Step 3，需先同步清理 `db.ts` 死包装及其引用的模块导出，再核对 Rust 命令与测试。
- `searchHistory.ts` 为用户脏文件，未触碰。

## 工作区注意

- 用户脏文件不提交：`package.json`、`src/lib/searchHistory.ts`、`src/lib/tokenBudget.ts`。
- 浏览器 fallback（`src/lib/db.ts`）与 Rust（`src-tauri/src/db.rs`）必须同构；新命令需在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册。
- dev server：`npm run dev`（浏览器 `localhost:1420`）；桌面：`npm run tauri dev`；verify 用 `vite preview --port 4173`。
- PowerShell 写文件易破坏 UTF-8 中文，优先用 `apply_patch` / 编辑器工具。
- 截图输出：`D:\ai-workbench\.screenshots\prism-*.png`。
- Step 2 本地工作文件在 `.reasonix/`（备份与删除清单），未跟踪，不要提交。
- Windows 桌面构建：先执行 `$env:PATH = "C:\Users\Shing\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;$env:PATH"` 再运行 `npm run tauri build`。

## 下一步建议

1. 可选 Step 3：按 AST 审计清理 `src/lib/db.ts` 中 97 个不可达导出（先核对 Rust 命令与测试，再删前端包装；`searchHistory.ts` 不动）。
2. 可选：用 `tauri dev` 实测真实 CLI 进程与 Obsidian 联动（浏览器 fallback、Rust 单测与桌面 debug 构建已验证）。
3. 后续新增功能时，命令必须在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册，并同步 `src/lib/db.ts` 包装。
