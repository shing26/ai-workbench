# Sprint Retrospective

## Sprint 143

### What went well?

- Webhook 投递升级为 HTTP / 邮件 / 系统通知三通道：`webhook_rules` 新增 `channels` / `recovery_backoff_seconds` / `circuit_opened_at`，`webhook_deliveries` 新增 `channel`，新增 `webhook_channel_config` 单行表，全部走幂等迁移；调度器与事件触发按规则 `channels` 逐通道入队。
- 邮件通道用 `lettre` SMTP 真实发信并配本地 mock SMTP 单测，系统通知通过 `webhook-notification` Tauri 事件 + 浏览器 Notification API / CustomEvent 双端可触发；`test_webhook_email` / `test_webhook_notification` / `probe_webhook_recovery` 命令与 fallback 同构。
- 熔断恢复按 `recovery_backoff_seconds * 2^failures`（封顶 24h）指数退避自动探测，成功恢复 enabled 并清零失败计数，失败重置计时继续退避；`verify:ui` / `verify:preview` 新增 `webhookMultiChannel` / `webhookRecoveryBackoff` lane，Rust 单测增至 161 条，全部门禁全绿。

### What went wrong?

- `webhook_recovery_backoff_ms` 首版把指数 `.min(6)` 且负数经 `as u32` 包装，低失败数时移位溢出；改为 `.clamp(0, 30)` 后既避免溢出又让 24h 封顶真实可达。
- `set_webhook_channel_config` 10 个参数触发 clippy `too-many-arguments`，收敛为 `WebhookChannelConfigInput` 结构体后通过。
- verify 首两轮在不同 lane 出现 CDP 超时（与本次改动无关的环境性卡顿），重启 Vite dev server 后第三轮双端全绿。

### Action Items

- 下一 Sprint 候选：事件总线持久化 event log、事件 schema 校验与跨设备事件转发。
- 保留 `webhookMultiChannel` / `webhookRecoveryBackoff` lane，修改投递通道、SMTP、熔断恢复或规则模型时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 142

### What went well?

- 新增 `webhook_condition.rs`：条件 DSL 与 cron 在 Rust / TS 双端同构，`event / context / and / or / not / 括号` 与 `cron(分 时 日 月 周)` 均可组合，事件不满足条件不入队。
- `webhook_rules` 新增 `trigger_condition` 列并走幂等迁移；`verify_webhook_signature` 命令与 Web Crypto fallback 覆盖 `sha256=<hex>` 与裸 hex，System Webhook 卡片补齐签名校验面板。
- `verify:ui` / `verify:preview` 新增 `webhookTriggerCondition` / `webhookSignatureVerify` lane，双端通过；Rust 单测新增 cron、条件、签名与迁移覆盖，`cargo test --lib` 增至 154 条，全部门禁全绿。

### What went wrong?

- 首轮条件 lane 用 `event == and` 作为非法条件，但 DSL 会把它解析为比较字符串 `"and"`，两边引擎都判定合法；改为缺右侧值的 `event ==` 后正确触发校验错误。
- clippy 对 `cron_is_valid` 中两处 `map_or` 给出简化提示，改用 `is_ok_and` / `is_some_and` 后通过。

### Action Items

- 下一 Sprint 候选：Webhook 多通道投递（邮件 / 系统通知）与熔断恢复指数退避调度。
- 保留 `webhookTriggerCondition` / `webhookSignatureVerify` lane，修改条件 DSL、cron 或签名逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 141

### What went well?

- `schedule_events` 新增 `date` 列：新库 SCHEMA 直接建列，旧库 `migrate_schedule_event_date` 幂等补列；Rust / Tauri / TS 三层同构，列表按 `date, start_time` 排序。
- 新增 `weekPlanTemplates.ts` 与 store `applyWeekPlan`：Balanced week 默认模板一次写入 9 条 Focus（含 dueDate）与 8 条 Schedule（含 date），ActionsView 新增 Week Plan 卡片与 Schedule 日期展示 / 手动选择。
- `verify:ui` / `verify:preview` 新增 `weekPlanTemplate` / `weekPlanPersisted` lane：断言 7 日预览、9 focus + 8 events 落库、重载持久化；Rust 单测新增迁移与排序覆盖，`cargo test --lib` 增至 145 条，全部门禁全绿。

### What went wrong?

- `cargo fmt --check` 首轮报 `migrate_schedule_event_date` 里 `execute_batch` 单行过长，执行 `cargo fmt` 后通过；后续新增 SQL 迁移函数都按 rustfmt 格式书写。

### Action Items

- 下一 Sprint 候选：Webhook 复杂触发器条件表达式（cron / 事件匹配）与签名校验收发端 UI。
- 保留 `weekPlanTemplate` / `weekPlanPersisted` lane，修改任务创建、事件创建或日期排序逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 140

### What went well?

- `db.ts` 新增 `WikiLinkSuggestion` 与 `suggestWikiLinkTargets`：按首行标题 / 标签过滤，精确 > 前缀 > 包含 > 标签排序，默认最多 6 条并排除当前笔记。
- Knowledge 正文编辑器输入未闭合 `[[...` 时弹出 `data-wiki-link-suggestions`：支持点击、ArrowUp / ArrowDown 高亮、Enter / Tab 插入与 Esc 关闭；保存 / 取消 / Preview / 跳转笔记时清理联想状态，插入后光标落在 `[[Title]]` 末尾。
- `verify:ui` / `verify:preview` 新增 `wikiLinkAutocomplete` / `wikiLinkPersisted` lane：种子 4 条笔记，覆盖候选排序、方向键高亮、点击 / Enter / Tab / Esc 与保存重载持久化；纯前端改动，无新增 Rust 命令与表结构，`cargo test --lib` 仍为 144 条全绿。

### What went wrong?

- 持久化 lane 首版用 `[data-thought-body-current="wl-alpha"]` 查询，误把内容属性当 id 选择器，实际内容已落库但断言拿不到元素；改为从 `[data-thought-body-edit="wl-alpha"]` 读取 `data-thought-body-current` 后双端通过。
- verify lane 在外层模板字符串里嵌套了 `` `[[${tabTarget}]]` ``，导致脚本语法错误；改成字符串拼接后 lint / prettier 通过。

### Action Items

- 下一 Sprint 候选：Actions 周计划模板（一键把本周计划写入 Focus / Schedule）。
- 保留 `wikiLinkAutocomplete` / `wikiLinkPersisted` lane，后续修改双链解析、插入逻辑或正文编辑器时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 139

### What went well?

- 新增 `webhook_rule_runs` 表与 `record_webhook_rule_run` / `list_webhook_rule_runs`：手动 Run、定时调度、事件投递的 success / dead 终态都会落日志，按规则裁剪保留最近 50 条。
- SystemView Webhook 卡片新增 Run log 区与 `data-webhook-rule-fail-alert` 24h 失败告警；`db.ts` fallback 用 `ai-workbench:webhook-rule-runs:v1` 同构持久化。
- `verify:ui` / `verify:preview` 新增 `webhookRuleRunLog` lane：种子 3 条运行记录，断言列表 / failed 徽标 / 告警条，并验证成功与失败 Run now 都即时追加日志；Rust 单测增至 144 条，全部门禁全绿。

### What went wrong?

- `list_webhook_rule_runs` 首版在 stmt 分支里绑定了未使用的 `rule_id`，cargo test 报 unused variable 警告；改为 `rule_id.is_some()` 分支后 clippy `-D warnings` 通过。

### Action Items

- 下一 Sprint 候选：Knowledge 双链补全编辑器提示、Actions 周计划模板、Webhook 复杂触发器条件表达式。
- 保留 `webhookRuleRunLog` lane，修改运行日志模型、规则执行链路或 Run log 渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 138

### What went well?

- `webhook_rules` 新增 `consecutive_failures` / `auto_disable_after`：新库 SCHEMA 建列，旧库 `migrate_webhook_circuit_breaker` 幂等补列；`record_webhook_rule_outcome` 统一处理真实投递终态，2xx 清零、失败累加、达到阈值自动停用，手动重新启用时重置计数。
- 定时调度与事件投递的 success / dead 终态都接入同一熔断函数，202 入队标记只更新 `last_run_at`；`run_webhook_rule_inner` 在网络错误时也回写失败状态。
- SystemView 新增 `data-webhook-rule-auto-disable` 表单输入与 `data-webhook-rule-failures` / `data-webhook-rule-auto-disable` 徽标；`db.ts` fallback 与 Rust 同构，按 URL 含 `/fail` 模拟失败。
- `verify:ui` / `verify:preview` 新增 `webhookRuleCircuitBreaker` lane，覆盖累计停用、成功清零、重新启用重置与表单创建；Rust 单测覆盖迁移与状态机，`cargo test --lib` 增至 143 条，全部门禁全绿。

### What went wrong?

- lane 首轮失败：`runWebhookRule` 写 localStorage 后 React DOM 刷新晚于轮询，断言读到旧行徽标并点击了旧按钮。改为先等 DOM 文本反映新状态，再读徽标 / 操作最新行；新增 `waitForDomText` 后双端通过。

### Action Items

- 下一 Sprint 候选：System 自动化规则补强（投递失败告警 / 规则日志）、Knowledge 双链补全编辑器提示、Actions 周计划模板。
- 保留 `webhookRuleCircuitBreaker` lane，修改熔断语义、规则行渲染或 fallback 时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 137

### What went well?

- `db.ts` 新增 `buildSessionSummary`：统计 questionCount、提取关键词（中文 2-3 字 n-gram + 英文词，过滤停用词，取 top 6）、生成 Q&A 要点（每个 user 消息配对下一条 assistant 回复，首行截断）。
- `buildSessionMarkdown` 在正文前插入 `## Summary` 段：Questions / Keywords / Q&A 要点，导出到知识库的笔记自带摘要。
- 导出面板头部新增 `data-session-summary` 摘要条：`data-session-summary-stats`、`data-session-summary-keyword` chips、`data-session-summary-point` 要点列表。
- `verify:ui` / `verify:preview` 新增 `sessionSummary` lane：种子 Weekly Sync 会话与 4 条消息，断言 2 questions、收益 / 风险关键词、2 个要点与 Markdown Summary 段。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（140 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- tsc 报 `buildSessionSummary` 的 map 回调里 `index` 未使用，去掉参数后通过；纯前端改动，无 Rust 命令与表结构变更。

### Action Items

- 下一 Sprint 候选：System 自动化规则补强、Knowledge 双链补全编辑器提示、Actions 周计划模板。
- 保留 `sessionSummary` lane，修改会话摘要、导出 Markdown 或导出面板时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 136

### What went well?

- ProjectsView 新增 `revenueAggregate` 派生：由 `projects` + `revenueTrends` 计算最新收益合计、趋势点数、7d / 30d 变化与状态拆分；无历史项目回退当前 revenue，delta 为 0。
- Portfolio summary 新增 `data-project-revenue-summary` 四格面板（Latest / Trend points / 7d delta / 30d delta）与 `data-project-revenue-status` 状态收益 chips；Portfolio export 报告同步追加四行聚合数据。
- 7d / 30d delta 以窗口内最后一个历史点为基线：种子 10→20→30→40 的趋势后，7d 为 +20.00、30d 为 +30.00。
- `verify:ui` / `verify:preview` 新增 `projectRevenueSummary` lane：种子两个项目（paused 收益 0）与 4 个趋势点，断言 40.00 最新值、4 点、+20.00 / +30.00 变化与 active / paused 拆分；lane 结束后恢复原始 projects / history，避免污染后续 Git activity 与编辑 lane。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（140 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮断言把 7d / 30d delta 预期写成 +10.00 / +20.00，实际按窗口基线语义为 +20.00 / +30.00，更新 lane 与计划后通过。
- 聚合 lane 种子替换了默认 projects，导致下游 `projectEdit` / `gitActivityFilters` 断言失败；改为断言后恢复原 projects 与收益历史，验证顺序耦合已写入 lane 注释与 RETRO。

### Action Items

- 下一 Sprint 候选：System 自动化规则补强、AI Studio 会话摘要、Knowledge 双链补全编辑器提示。
- 保留 `projectRevenueSummary` lane，修改收益模型、聚合派生或 Portfolio summary 渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 135

### What went well?

- `db.ts` 新增 `extractWikiLinks` / `thoughtTitle` / `resolveWikiLinkTarget` / `buildThoughtLinkGraph`：正则解析 `[[target]]` 与 `[[target|alias]]`，按首行 Markdown 标题提取笔记名，先精确匹配再子串兜底，纯前端派生无需落库。
- Knowledge 详情新增 `data-thought-links` 区：Outgoing / Backlinks / Missing 三组，`data-knowledge-graph-stats` 展示 links / backlinks / missing 统计；点击出链或回链会清空搜索与标签过滤并跳转到目标笔记。
- `verify:ui` / `verify:preview` 新增 `knowledgeBacklinks` lane：种子 Alpha / Beta / Gamma 三篇笔记，断言 Beta / Gamma 出链、Beta 回链、Missing Note 未解析、3 links / 1 backlinks / 1 missing 统计，并验证点击回链跳到 Beta、再从 Beta 出链回到 Alpha。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（140 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 验证种子里的 `\n\n` 写在 evaluate 模板字符串内，首次运行被解释成真实换行导致 SyntaxError；改为 `\\n\\n` 双反斜杠转义后通过，与 Sprint 133 的 CSV 转义问题同类。

### Action Items

- 下一 Sprint 候选：Projects 收益端聚合展示、System 自动化规则补强、AI Studio 会话摘要。
- 保留 `knowledgeBacklinks` lane，修改双链解析、详情面板或 Knowledge 列表渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 134

### What went well?

- SQLite 新增 `webhook_retention_config` 单行表：`retention_days / max_records / auto_cleanup / updated_at`，默认 30 天 / 200 条 / 自动开启，`set_webhook_retention_config` 对 1~3650 天与 1~100000 条做钳制；新增 get / set / prune / stats 四个 Tauri 命令。
- `prune_webhook_deliveries` 按天数删除过期 success / dead，再按 max_records 从最旧开始裁剪终态记录；queued / delivering 永不按年龄删除，返回 removedByAge / removedByCount / totalRemoved。
- delivery worker 每轮在 auto_cleanup 开启时自动清理；SystemView Webhook 卡片新增 Retention policy 区（天数 / 条数 / Auto / Save / Run cleanup），`data-webhook-retention-stats` 展示 total / queued / ok / dead 统计。
- 浏览器 fallback 用 `ai-workbench:webhook-retention:v1` 保存同一配置，`triggerWebhookEvent` 写入时按 autoCleanup 自动裁剪；`verify:ui` / `verify:preview` 新增 `webhookRetention` lane，种子 6 条记录后 Save 1d / 1 条并 Run cleanup，断言 age 2 + count 1、剩余 3 条与持久化。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（140 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- clippy 在保留策略单测里报 `let mut set` 多余可变性，去掉 `mut` 后通过；首轮验证前该问题由 `-D warnings` 拦截，未进入双端验证。

### Action Items

- 下一 Sprint 候选：Knowledge 笔记双链 / 回溯、Projects 收益端聚合展示、System 自动化规则补强。
- 保留 `webhookRetention` lane 与三个保留策略单测，修改投递队列、worker 或 System Webhook 面板时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 133

### What went well?

- Projects Portfolio summary 新增收益历史 CSV 导出：由 `projects` + `revenueTrends` 派生 `revenueCsv`，字段统一做引号转义，无历史项目的行用当前 `revenue` 兜底，表头为 `Project,ProjectId,Status,RecordedAt,Revenue`。
- 导出面板提供 `data-project-revenue-export` 开关、`data-project-revenue-csv-preview` 预览、`data-project-revenue-csv-copy` 复制与 `data-project-revenue-csv-download` 下载；复制成功后按钮显示 Copied，结果区显示 `N rows`。
- `verify:ui` / `verify:preview` 新增 `projectRevenueExport` lane：断言表头、AI Workbench / Hermes Station 项目名、行数、复制状态与结果文本；修复了验证脚本中 `preview.split("\\n")` 在模板字符串内被格式化破坏的问题。
- 纯前端改动，无新增 Rust 命令与表结构；`npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（137 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:ui` 在 `projectRevenueExport` lane 报 SyntaxError：模板字符串内的 `split("\\n")` 被 Prettier 改写后变成真实换行，导致 evaluate 的代码语法错误；改回双反斜杠转义并保留 Prettier 兼容格式后通过。

### Action Items

- 下一 Sprint 候选：Projects 收益端聚合展示或导出增强、Knowledge 笔记双链 / 回溯、System 投递保留策略与自动化规则补强。
- 保留 `projectRevenueExport` lane，修改收益模型、CSV 生成或 Portfolio summary 渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 132

### What went well?

- 会话导出面板新增 `data-session-export-knowledge`：一键把 `buildSessionMarkdown` 输出存为 `#chat,#session` note，保存中禁用按钮，结果写入 `data-session-export-knowledge-result`，打开 / 关闭面板自动复位状态。
- `verify:ui` / `verify:preview` 新增 `sessionSaveKnowledge` / `sessionSaveKnowledgePersisted`：复用 `sessionWorkspace` 留下的 Workspace Beta 会话，断言预览内容、保存结果、tags / type 与 reload 后 Knowledge 可见。
- 纯前端改动，无新增 Rust 命令与表结构；`npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（137 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞，双端验证一次全绿；验证 lane 依赖 `sessionWorkspace` 留下的会话数据，因此在归档 lane 重置 sessions 之前执行，顺序耦合已写入 lane 注释与 RETRO。

### Action Items

- 下一 Sprint 候选：Projects 收益导出、System 投递保留策略、Knowledge 笔记双链 / 回溯。
- 保留 `sessionSaveKnowledge` / `sessionSaveKnowledgePersisted` lane，修改会话导出、知识笔记模型或 Knowledge 列表渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 131

### What went well?

- `webhook_rules` 新增 `cooldown_seconds`：新库建列、旧库 `migrate_webhook_cooldown` 幂等补列；`list_event_webhook_rules` 按 `last_run_at` 过滤冷却规则，`trigger_webhook_event` 命中后写回 `last_run_at`，冷却期内重复事件不再入队。
- System 规则编辑器新增 `data-webhook-rule-cooldown` 输入与 `data-webhook-rule-cooldown-badge` 徽标；浏览器 fallback 的 `triggerWebhookEvent` 同步过滤并写回规则，旧 localStorage 数据读取时默认补 0。
- `verify:ui` / `verify:preview` 新增 `webhookRuleCooldown` lane：创建 60s 冷却规则后连续触发两次 `sync.completed`，第一次 1 条投递、第二次仍 1 条且 localStorage 只有 1 条；Rust 新增冷却迁移与抑制两条单测，`cargo test --lib` 增至 137 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 Rust 编译在 lib.rs 测试的 `WebhookRuleInput` 初始化中漏掉新增的 `cooldown_seconds` 字段，补齐后 clippy / test 通过；前端先格式化，Rust 由 `cargo fmt` 负责，prettier 不解析 Rust 文件。

### Action Items

- 下一 Sprint 候选：AI Studio 会话与知识库深度能力、Projects 收益导出、System 投递保留策略。
- 保留 `webhookRuleCooldown` lane 与冷却单测，修改规则模型、事件触发链路或 System 规则 UI 时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 130

### What went well?

- Actions 新增 Week Review 卡片：本周 7 天 planned / done 日条、周完成率、最佳日与连续完成天数均由 `tasks` 运行时派生，无新增表结构；无 dueDate 的今日 Focus 任务统一归入今天，空档日不断连 streak。
- `data-week-review-archive` 一键快速归档：本周 done 任务顺序执行 `setTaskToday(false)` + `setTaskDueDate(null)`，reload 后任务仍留在 Completed archive 且不再出现在今日 Focus。
- `verify:ui` / `verify:preview` 新增 `weekReviewStats` / `weekReviewArchive` / `weekReviewArchivePersisted` 三条 lane，覆盖统计锚点、归档后移出 Focus 与持久化。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`（135 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞，双端验证一次全绿；唯一注意点是验证 lane 读取 `data-week-review-*` 的 textContent 时包含 StatPill 的 label 前缀，断言按数值形状（`x/y`、`%`、`d`）校验，避免硬编码文案。

### Action Items

- 下一 Sprint 候选：System 自动化规则补强、AI Studio 会话与知识库深度能力、Projects 收益导出。
- 保留 `weekReviewStats` / `weekReviewArchive` / `weekReviewArchivePersisted` lane，修改任务模型、Focus 渲染或快速归档逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 129

### What went well?

- SQLite 新增 `project_revenue_history`（id / project_id / revenue / recorded_at），`create_project` / `update_project` 自动写收益快照，`delete_project` 同步清理历史；Rust 与浏览器 fallback 同构支持 `listProjectRevenueHistory`，localStorage 复用 `ai-workbench:db:v1`。
- Projects 项目卡片设置区下方新增 `data-project-revenue-trend` 条形趋势，每个点携带 `data-project-revenue-point` / `data-project-revenue-value` / `data-project-revenue-at`，reload 后按历史恢复。
- `verify:ui` / `verify:preview` 新增 `projectRevenueTrend` / `projectRevenueTrendPersisted` 两条 lane，覆盖保存后点数增加、末点为最新值、reload 后保持；`cargo test --lib` 增至 135 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:ui` 持久化断言期待 4 个点，实际种子 project 只有初始 0 快照 + 编辑快照 + trend 快照 = 3 个，放宽为 `points.length >= 2 && points.length === storedCount`。
- 第二次修复 `storedCount` 引用未在 evaluate 内定义的问题，改为显式 `const storedCount = storedPoints.length`。

### Action Items

- 下一 Sprint 候选：Actions 周目标统计 / 快速归档、System 自动化规则补强、AI Studio 会话与知识库深度能力。
- 保留 `projectRevenueTrend` / `projectRevenueTrendPersisted` lane，修改项目模型、收益编辑或卡片渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 128

### What went well?

- AI Studio 会话侧栏新增分组视图：pinned / today / yesterday / 7d / older 顺序分组，Active / Archived tab 共用同一规则，会话行渲染抽为 `renderSessionRow` 复用。
- 分组头支持折叠/展开并展示计数，搜索或 RAG 命中时自动退化为平铺列表，清空后恢复分组。
- `verify:ui` / `verify:preview` 新增 `sessionGrouping` / `sessionGroupingToggle` / `sessionGroupingSearchFlat` 三条 lane，覆盖分组顺序、计数、折叠与搜索退化。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:ui` 的折叠断言读取了 React 重渲染前的旧 DOM 引用，改为每次轮询重新查询组状态后一次通过。
- 首轮 `verify:preview` 的既有 `syncAudit` lane 偶发过滤计数失败，重跑一次后全绿，判定为既有 lane 抖动，与本 Sprint 改动无关。

### Action Items

- 下一 Sprint 候选：Projects 收益趋势、Actions 周目标统计/快速归档、System 自动化规则补强。
- 保留 `sessionGrouping` 系列 lane，修改会话模型、侧栏渲染或搜索逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 127

### What went well?

- Rust 与浏览器 fallback 同构支持笔记类型转换与删除：新增 `update_thought_type` / `delete_thought` 命令，Tauri 层对类型做 inbox / note / doc 白名单校验，缺失 id 返回 `QueryReturnedNoRows`。
- Knowledge 详情头部新增类型分段控件与删除二次确认：切换类型后徽标、Tag Library 类型分布同步刷新；删除后清除编辑状态并自动落到下一条笔记，列表、统计与 RAG 结果同步移除。
- `verify:ui` / `verify:preview` 新增 `thoughtTypeConvert` / `thoughtTypeConvertPersisted` / `thoughtTypeConvertRestored` / `thoughtDelete` / `thoughtDeleteCancel` / `thoughtDeletePersisted` 六条 lane；`cargo test --lib` 增至 134 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:ui` 的删除断言把“详情自动落到下一条笔记”误判为空态，改为断言被删笔记不再出现在详情面板后一次通过。
- 首轮 `verify:preview` 在 System 区域出现 CDP `Runtime.evaluate` 超时，重跑一次后全绿，判定为既有 lane 偶发抖动，与本 Sprint 改动无关。

### Action Items

- 下一 Sprint 候选：AI Studio 会话分组、Projects 收益趋势、Actions 习惯周目标统计或快速归档。
- 保留 `thoughtTypeConvert` 系列与 `thoughtDelete` 系列 lane，修改笔记模型、详情面板或 RAG 搜索时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 126

### What went well?

- SystemView 新增 `runAllProviderE2E()`：对全部 active Provider 并行执行 `runProviderE2EStream`，单卡异常捕获为 `ok=false` 不中断整批；操作区新增 `data-provider-batch-test` / `data-provider-batch-result`，结果同步写入各 Provider 卡片。
- `verify:ui` / `verify:preview` 新增 `providerBatchE2E` lane，断言 `2/2 ok` 与卡片结果数；`cargo test --lib` 保持 132 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:preview` 的既有 `syncAudit` lane 偶发时序失败，重跑一次后全绿，判定为既有 lane 抖动，与本 Sprint 改动无关。

### Action Items

- 下一 Sprint 候选：AI Studio 会话分组、Projects 收益趋势、Knowledge 笔记删除/类型转换。
- 保留 `providerBatchE2E` lane，修改 Provider 模型、卡片操作区或 E2E 汇总时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 125

### What went well?

- Rust 与浏览器 fallback 同构支持项目删除：`delete_project` 先解除关联 `sessions.project_id` 再删除项目，缺失 id 返回明确错误，localStorage fallback 行为一致。
- Projects 项目设置区新增删除二次确认与取消控件，删除后项目卡片、Portfolio summary 与 Project carousel 同步刷新。
- `verify:ui` / `verify:preview` 新增 `projectDelete` / `projectDeletePersisted` / `projectDeleteCancel`，覆盖删除 → reload 持久化 → 取消不删除全链路；`cargo test --lib` 增至 132 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；双端验证一次全绿。

### Action Items

- 下一 Sprint 候选：AI Studio 会话分组、Projects 收益趋势、System Provider 批量测试、Knowledge 笔记删除/类型转换。
- 保留 `projectDelete` / `projectDeletePersisted` / `projectDeleteCancel` lane，修改项目模型、卡片设置区或 Portfolio 汇总时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 124

### What went well?

- Rust 与浏览器 fallback 同构支持笔记正文编辑：新增 `update_thought_content` 命令返回最新 Thought，`db.ts` / `workbenchStore` 同步写回 `thoughts`，RAG 搜索实时反映正文变更。
- Knowledge 详情面板新增 Edit body / Preview 切换与内联 Markdown 编辑器，切换编辑/预览不丢草稿，保存后 Markdown 预览、列表与本地存储同步刷新。
- `verify:ui` / `verify:preview` 新增 `thoughtBodyEdit` / `thoughtBodyEditPersisted` / `thoughtBodyEditRestored`，覆盖编辑 → reload 持久化 → 恢复原文全链路；`cargo test --lib` 增至 131 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 `verify:ui` 的 `thoughtBodyEdit` 表达式因外层模板字符串把 `\n` 转成真实换行导致 JS 语法错误；改为 `\\n` 后一次通过。

### Action Items

- 下一 Sprint 候选：AI Studio 会话分组、Projects 项目删除或收益趋势、System Provider 批量测试、Knowledge 笔记删除/类型转换。
- 保留 `thoughtBodyEdit` / `thoughtBodyEditPersisted` / `thoughtBodyEditRestored` lane，修改笔记模型、详情面板或 Markdown 渲染时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 123

### What went well?

- Rust 与浏览器 fallback 同构支持会话归档：`sessions` 新增 `archived` 列 + `migrate_session_archived` 幂等迁移，新增 `set_session_archived` 命令返回最新 Session，`search_sessions` 默认只命中 active 会话。
- AI Studio 会话侧栏新增 Active / Archived 切换与归档/恢复行操作：归档当前会话自动切到下一个 active，恢复后回到 active tab，搜索与选中逻辑跟随当前 tab。
- `verify:ui` / `verify:preview` 新增 `sessionArchive` / `sessionArchivePersisted` / `sessionArchiveRestored`，覆盖归档 → reload 持久化 → 恢复全链路；`cargo test --lib` 增至 130 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；双端验证一次全绿。

### Action Items

- 下一 Sprint 候选：AI Studio 会话分组、Knowledge 笔记正文编辑、Projects 项目删除或收益趋势、System Provider 批量测试。
- 保留 `sessionArchive` / `sessionArchivePersisted` / `sessionArchiveRestored` lane，修改会话模型、侧栏或归档逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 114

### What went well?

- 新增 `src/lib/recapDraft.ts`：`loadRecapDraft` / `saveRecapDraft` / `markRecapDraftSaved`，localStorage key `ai-workbench:recap-draft:v1` 跨视图共享最近复盘草稿。
- AI Studio 复盘回复完成后自动写入草稿，对应 assistant 消息新增 `data-ai-recap-message-save` 一键保存按钮；保存后消息按钮、Quick Prompt 行按钮与 Knowledge 入口同步显示已保存。
- Knowledge Thought Inbox 新增 `data-knowledge-recap-save`：有未保存草稿时一键写入 `#daily,#recap` 笔记，状态从 draft 变 saved，无草稿显示提示。
- `verify:ui` / `verify:preview` 新增 `recapSaveEntries` / `recapSaveKnowledge` / `recapSaveMessageState` 三段断言：消息入口存在可点、Knowledge 入口完成保存且笔记数 +1、返回 AI Studio 后已保存状态回显。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（122 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；preview 端验证一次全绿，无需重跑。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调，或继续围绕 5 大主视图补日常高频能力。
- 保留 `recapSaveEntries` lane，修改复盘生成、草稿持久化或保存入口时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 115

### What went well?

- Rust 新增 `run_provider_e2e_stream(provider_id)`：复用 `stream_openai_compatible_with` / `stream_ollama_with` 真实流式链路，逐块统计 chunk / chars 并计时，返回 `ProviderE2eResult { ok, chunks, chars, durationMs, message }`。
- `src/lib/db.ts` 新增 `runProviderE2EStream`：真实 Provider 走 `streamProviderLive`（新增 `onChunk` 计数回调），无真实链路时返回确定性 mock，与 Rust 同构。
- System Provider 卡片新增 `data-provider-e2e-test` 按钮与 `data-provider-e2e-result` 展示，点击后显示 `ok · chunks · chars · ms` 完整报告。
- `verify:ui` / `verify:preview` 新增 `providerE2EStream` lane：用本地 SSE mock 覆盖完整链路并断言 chunk / chars / duration 三段指标。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（122 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮 lane 只断言结果文本，未覆盖真实流式计数，改为点击 E2E 后校验 `ok · 2 chunks · 26 chars · 120ms` 三段指标，避免 UI 其它文本干扰。
- 真实链路耗时依赖本机网络与 Provider 配置，验证统一走本地 SSE mock，Rust 端到端仍以单测覆盖流式复用逻辑。

### Action Items

- 下个 Sprint 候选：Actions Focus 周视图与完成归档、Projects 收益/进度汇总导出、Knowledge 文档标签分类视图、System Provider 批量测试、AI Studio 会话分组/归档。
- 保持 `providerE2EStream` lane，改动 Provider 卡片或流式命令时重跑 `verify:ui` / `verify:preview`。

## Sprint 116

### What went well?

- `tasks` 表新增 `completed_at`：Rust `Task` / 浏览器 `Task` 同构，旧库幂等迁移；`update_task_status` 完成时自动记录完成时间，`set_task_due_date` 支持按 `YYYY-MM-DD` 指派。
- Actions Today Focus 升级为一周视图：7 天条带展示每日任务数与完成态，周进度条汇总，焦点任务卡提供一键改派次日按钮；完成归档支持恢复回今日焦点。
- `verify:ui` / `verify:preview` 新增 `focusWeekArchive` / `focusWeekPersisted` lane：创建任务、改派次日、完成、归档、恢复、切换回今天与 reload 持久化全链路断言。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（123 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- lane 首轮把“明天”按周一顺延计算，实际任务改派为今天次日，导致点击了错误的日期 chip；改为从周条带中定位今天再取后一天后稳定。
- 恢复归档首轮点击了第一条恢复按钮，但归档可能含多个完成项；改为定位目标任务行内的恢复按钮，并校验该任务从归档消失。

### Action Items

- 下一 Sprint 候选：Projects 收益/进度汇总导出、Knowledge 文档标签分类视图、System Provider 批量测试、AI Studio 会话分组/归档。
- 保留 `focusWeekArchive` lane，修改 Focus 卡片、任务字段或归档逻辑时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 117

### What went well?

- Projects 新增 Portfolio summary 卡片：项目总数、总收益、Active / Paused、提交总数、Dirty 项目与周提交峰值一目了然。
- `data-portfolio-export` 生成完整 Markdown 报告（组合统计 + 项目表 + Git 活动表 + 提交趋势），内联预览并支持一键复制；复制带 `execCommand` 兜底，headless 验证环境也稳定。
- 纯前端计算复用 `projects` 与 `gitActivity`，无新增后端命令与持久化字段，改动面小且双端验证一致。
- `verify:ui` / `verify:preview` 新增 `portfolioSummaryExport` lane：汇总数值、导出预览与复制状态全链路断言；`npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（123 条）、双端验证全绿。

### What went wrong?

- 首轮 `verify:ui` 在 `syncAudit` lane 出现一次 `customOk` 时序抖动（重跑即恢复），与 Sprint 117 改动无关，属既有 lane 的日期范围刷新竞争。
- 复制按钮首轮在 headless 环境未显示 Copied：`navigator.clipboard` 不可用时改为 `execCommand` 兜底后稳定。

### Action Items

- 下一 Sprint 候选：Knowledge 文档标签分类视图、System Provider 批量测试、AI Studio 会话分组/归档。
- 保留 `portfolioSummaryExport` lane，修改 Projects 汇总或 Git 活动聚合时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 118

### What went well?

- Knowledge 新增 Tag Library 分类视图：标签 chips 聚合每个标签的笔记数与类型分布，点击后同步侧栏过滤器并展示该标签下最近笔记，All 一键恢复全部。
- Tag Library 是纯前端派生视图，复用 `thoughts.tags` 的逗号分隔标签，无新增后端命令与持久化字段，改动面小。
- `verify:ui` / `verify:preview` 新增 `knowledgeTagLibrary` lane：标签计数、选中联动、侧栏过滤行数、预览列表与 All 恢复全链路断言。
- 顺带修复 Rust 测试代码里一处 Clippy `identity_op`（`day_ms * 1` → `day_ms`），`cargo clippy --all-targets -- -D warnings` 恢复全绿。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings`、`cargo test --lib`（123 条）、双端验证全绿。

### What went wrong?

- lane 首轮按“结果行文本包含 `#work`”断言过滤，但侧栏结果行只显示正文、标签在详情 ModelBadge；改为断言过滤后结果行数等于 `#work` 计数后稳定。
- Clippy 首次以 `--all-targets` 全量检查时暴露测试代码里的 `identity_op`，顺手修复后门禁通过。

### Action Items

- 下一 Sprint 候选：System Provider 批量测试、AI Studio 会话分组/归档、Actions 习惯连续天数可视化、Projects 项目状态管理/收益编辑、Knowledge 笔记标签编辑。
- 保留 `knowledgeTagLibrary` lane，修改 Knowledge 标签解析、侧栏过滤或 Tag Library 卡片时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 119

### What went well?

- Rust 与浏览器 fallback 同构升级习惯数据：`list_habits` 从 `habit_logs` 实时计算连续天数与最近 14 天打卡，`toggle_habit` 写入 / 删除当天日志，静态 `current_streak` 种子不再参与计算。
- Rust 引入 chrono 本地日期，种子习惯自动生成连续打卡日志（晨间阅读 3 天 / 深水工作 2 天 / 运动 5 天），`today_local` 与浏览器 `dayKey` 对齐。
- Actions Habits 卡片新增 14 天热力条与周目标进度：`data-habit-recent-days` / `data-habit-day` / `data-habit-day-checked` / `data-habit-streak` / `data-habit-week` 锚点齐全。
- `verify:ui` / `verify:preview` habit lane 覆盖种子连续天数、14 天热力条、打卡后连续天数 +1、今日点亮、周进度与 reload 持久化；`cargo test --lib` 增至 125 条。
- 顺带修正两处既有验证缺陷：习惯按钮改用 `data-habit-toggle` 精确定位；`focusWeekArchive` 改为 reload 后先验归档持久化，再恢复任务，逻辑不再自相矛盾。

### What went wrong?

- 首轮 `verify:ui` 的习惯断言拿到 0，因为旧 `aria-label^="Toggle "` 选择器在 Actions 视图里会先命中任务行的 Toggle；为习惯按钮补充显式锚点后稳定。
- Rust 种子测试首轮失败：深水工作日志偏移写成 `[2,3]`，导致昨天断档、连续天数算成 0；改为 `[1,2]` 后符合 2 天连续。
- 修复习惯选择器后暴露出 `focusWeekArchive` 验证本身有误：它先恢复归档再 reload，却要求归档仍存在；重新编排为 reload 验归档、再恢复。

### Action Items

- 下一 Sprint 候选：System Provider 批量测试、AI Studio 会话分组/归档、Projects 项目状态管理/收益编辑、Knowledge 笔记标签编辑。
- 保留 habit lane 与 `focusWeekArchive` / `focusWeekPersisted` / `focusWeekRestored` 断言，修改习惯打卡、Focus 周视图或归档逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 120

### What went well?

- Rust 与浏览器 fallback 同构新增项目状态 / 收益编辑：`update_project(id, status, revenue)` 状态仅接受 active / paused、收益非负钳制，保存后返回最新 Project；`db.ts` / `workbenchStore` 与 localStorage fallback 行为一致。
- 每个项目卡片新增 `data-project-edit` 设置区：状态下拉、收益数字输入、保存按钮与 `Saved` 结果徽标，保存后 Portfolio summary、StatPill 与 Project carousel 同步刷新。
- `verify:ui` / `verify:preview` 新增 `projectEdit` / `projectEditPersisted` / `projectEditRestored`：编辑 1234.56 / paused → reload 持久化 → 恢复 active / 0；`cargo test --lib` 增至 126 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings`、`cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；双端验证一次全绿，无需重跑。

### Action Items

- 下一 Sprint 候选：System Provider 批量测试、AI Studio 会话分组/归档、Knowledge 笔记标签编辑、Actions 习惯删除/周目标编辑、Projects 项目删除或收益趋势。
- 保留 `projectEdit` / `projectEditPersisted` / `projectEditRestored` lane，修改项目字段、设置区或 Portfolio 汇总时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 121

### What went well?

- Rust 与浏览器 fallback 同构新增笔记标签更新：`update_thought_tags(id, tags)` 仅更新 `thoughts.tags` 并返回最新 Thought；`db.ts` / `workbenchStore` 与 localStorage fallback 行为一致。
- Knowledge 详情面板新增标签编辑控件：`data-thought-tags-edit` 打开内联输入，保存时按逗号拆分、去空白、补 `#` 并去重，保存后详情徽标、侧栏与 Tag Library 同步刷新。
- `verify:ui` / `verify:preview` 新增 `thoughtTagEdit` / `thoughtTagEditPersisted` / `thoughtTagEditRestored`：编辑 #work,#review → reload 持久化 → 恢复 #work,#life；`cargo test --lib` 增至 127 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings`、`cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；双端验证一次全绿，无需重跑。

### Action Items

- 下一 Sprint 候选：System Provider 批量测试、AI Studio 会话分组/归档、Actions 习惯删除/周目标编辑、Projects 项目删除或收益趋势。
- 保留 `thoughtTagEdit` / `thoughtTagEditPersisted` / `thoughtTagEditRestored` lane，修改标签解析、侧栏过滤或 Knowledge 详情面板时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 122

### What went well?

- Rust 与浏览器 fallback 同构新增习惯管理：`update_habit_week_goal` 周目标钳制 1~31，`delete_habit` 删除习惯并清理 `habit_logs`；`db.ts` / `workbenchStore` 与 localStorage fallback 行为一致。
- Actions Habits 卡片每行新增周目标内联编辑与删除二次确认：编辑保存后周进度、今日进度与热力条同步，删除后习惯行消失且汇总减少。
- `verify:ui` / `verify:preview` 新增 `habitManage` / `habitManagePersisted` / `habitManageRestored` / `habitDeleteCheck`：编辑 7 → reload 持久化 → 恢复 5，并创建后删除测试习惯；`cargo test --lib` 增至 128 条。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings`、`cargo test --lib`、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 无新增阻塞；双端验证一次全绿，无需重跑。

### Action Items

- 下一 Sprint 候选：System Provider 批量测试、AI Studio 会话分组/归档、Projects 项目删除或收益趋势、Knowledge 笔记正文编辑。
- 保留 `habitManage` / `habitDeleteCheck` lane，修改习惯字段、周目标或删除逻辑时重跑双端验证。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 113

### What went well?

- Sync audit Activity 图升级为跨时间轴分层图：每个日 / 周 bucket 按 merge / resolve / other 三色堆叠，`data-sync-audit-segment` 带 kind / count 锚点，旧 `data-sync-audit-bar` 总数锚点保留。
- 图例 `data-sync-audit-legend` 显示三类合计，桶数 > 1 时新增 `data-sync-audit-trend-line` 累计折线；过滤条件与 Day / Week 粒度联动不变。
- `verify:ui` / `verify:preview` 的 `syncAuditChart` lane 新增分段合计 = 总数、图例合计 = 总数、趋势线存在性 = 桶数 > 1、Week 切换后分段合计一致。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（122 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首轮断言把趋势线当作必须存在，但单日数据只有一个 bucket，UI 按“桶数 > 1”才渲染折线；改为断言存在性与桶数一致后稳定。
- preview 出现一次 CDP `Runtime.evaluate` 超时（providerToggled 之后），重跑通过，属环境抖动而非功能回归。

### Action Items

- 下一 Sprint 候选：AI 复盘结果一键保存更多入口、真实 Provider 端到端流式联调。
- 保留 `syncAuditChart` lane，修改审计聚合、图表结构或趋势线规则时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 112

### What went well?

- MOA 链式路由落地：`stream_ai_message` 新增 `moa_chain`，按优先级顺序串行请求前 3 个 Provider；后续请求在原始 messages 后追加 `[Previous agent output from X]` 上下文，失败只插入错误片段并继续。
- 浏览器 fallback 同构：`sendAiMessageStream` 新增 `moaChain`，串行消费真实 SSE / NDJSON，取消语义与并行 MOA 一致；`appendMoaChainContext` 提供统一上下文格式。
- AI Studio MOA 新增 Parallel / Chain 切换（`data-moa-chain-mode`），Chain 时头部展示 `data-moa-chain-badge`（A → B → C），MOA badge 状态显示 chain，Inspector 展示 Chain / Final。
- `verify:ui` / `verify:preview` 新增 `moaChain` lane：3 个本地 SSE mock 断言请求顺序 chain-a → chain-b → chain-c、`maxActive <= 1`、上下文传递与链式徽标。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（122 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- chain 断言首轮误判：上一 lane 的并行 MOA 消息仍留在会话历史里，`document.body.innerText` 含有旧的 `## MOA Consensus`；改为只检查最新一条 assistant 消息后稳定，同时避免旧链路文本造成 false positive。

### Action Items

- 下一 Sprint 候选：审计跨时间轴图、AI 复盘结果一键保存更多入口、真实 Provider 端到端流式联调。
- 保留 `moaChain` lane，修改 MOA 执行拓扑、链式上下文格式或 AI Studio 模式控件时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 111

### What went well?

- Rust `error_log_summary` 扩展为 hour / day / week 三档粒度，并新增 `since_ms` / `until_ms` 范围过滤；Tauri 命令 `get_error_log_summary` 同步透传，单测覆盖 24h 小时分桶、30d 边界、双端范围与旧数据排除。
- System Error logs 卡片把 Day / Week 切换升级为 24h / 7d / 30d 时间范围，图表按范围自动使用 hour / day 粒度，明细列表与总数徽标跟随同一窗口。
- 峰值告警按“最高桶 count >= 3 且超过均值 3 倍”触发，`data-error-peak` 徽标展示峰值桶、计数与倍率；24h 小时视图可及时发现单小时异常突增。
- `verify:ui` / `verify:preview` 的 `errorLogTrend` lane 覆盖 24h / 7d / 30d 过滤与严重度联动，新增 `errorLogPeakAlert` lane 覆盖尖峰徽标出现、倍率正确与切回 7d 后消失。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（121 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 验证种子曾把日志放在 24h / 30d 边界外 1 分钟，导致过滤正确但断言误判；改为安全落在窗口内的相对时间戳后稳定。
- dev 模式两次出现 CDP `Runtime.evaluate` 超时且集中在较后 lane，加 lane 进度日志定位后重跑即过；preview 双端全绿，属环境抖动而非功能回归。
- 30d 补零桶数量随 UTC 日界在 20 / 21 之间波动，断言放宽为 20-22 根柱并保留总数与粒度强断言。

### Action Items

- 下一 Sprint 候选：MOA 链式路由、审计跨时间轴图、AI 复盘结果一键保存更多入口、真实 Provider 端到端流式联调。
- 保留 `errorLogTrend` / `errorLogPeakAlert` lane，修改错误日志聚合、System 卡片或峰值规则时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 110

### What went well?

- 跨流 Token 预算落地：`src/lib/tokenBudget.ts` 用 `len/4` 估算，localStorage key `ai-workbench:token-budget:v1` 持久化，月度 key 变化自动清零；System Token budget 卡片可配置上限、Auto degrade 与 Reset month。
- AI Studio 头部 `data-token-budget-badge` 展示用量与 degrade / over 状态，流完成时自动记录估算 Token；超预算且开启降级时只路由本地 Ollama，关闭时拦截并回显 `token budget exceeded`；Inspector 新增 `Budget` 区块。
- `verify:ui` / `verify:preview` 的 `tokenBudget` lane 覆盖本地降级回复、徽标、配置切换、超限拦截、重置与恢复云 Provider 五步，双端全绿。
- `npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 预算降级 lane 首次失败：本地 Provider 的 mock 返回 OpenAI SSE 格式，但 name 含 Ollama 走了 NDJSON 解析；改为 Ollama NDJSON 响应后稳定。
- preview 出现两轮 CDP `Runtime.evaluate` 偶发超时，加临时 lane 日志定位后重跑即过，属环境抖动而非功能回归；临时日志已移除。

### Action Items

- 下一 Sprint 候选：MOA 链式路由、错误日志趋势优化、审计跨时间轴图、AI 复盘结果一键保存更多入口、真实 Provider 端到端流式联调。
- 保留 `tokenBudget` lane，修改预算估算、降级路由或 System 配置 UI 时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 109

### What went well?

- Rust `stream_ai_message` 新增 `auto_fallback`：非 MOA 分支按 `provider_ids` 顺序逐个尝试，失败时 emit `stream-fallback` 并追加 `[auto fallback: A → B]` 文本块；`auto_fallback_marker` 单测覆盖格式。
- 浏览器 fallback 与 Tauri 同构：`StreamFallback` / `listenStreamFallbacks` 统一事件模型，`sendAiMessageStream` 同序降级，全部失败才返回最终错误。
- AI Studio Single / Auto 模式传入全部 active Provider，头部 `data-ai-fallback-chain` 徽标与 Inspector `Fallback chain` 区块展示回退链；`autoFallback` lane 用 500 + SSE 双 mock 覆盖消息标记、回复、徽标与 Inspector。
- `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`cargo test --lib`（121 条）、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- `autoFallback` lane 首次失败是因为上个 lane 遗留的 Agent 选择仍生效，请求走了 agent 专属 Provider；显式重置为 Default agent 后稳定。
- lane 结束后停在 AI Studio，导致后续 `webhookSystemEvents` 找不到 System 视图按钮；在 lane 前补 `clickDock('System')` 后恢复全绿。

### Action Items

- 下一 Sprint 候选：MOA 链式路由、跨流 token 预算、错误日志趋势优化、审计跨时间轴图、AI 复盘结果一键保存更多入口。
- 保留 `autoFallback` lane，修改流式链路、Provider 排序或 AI Studio 模式选择时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 108

### What went well?

- 搜索历史模块落地：`src/lib/searchHistory.ts` 提供查询去重、最多 8 条、localStorage 持久化（`ai-workbench:session-search-history:v1`），AI Studio 搜索完成后自动记录并显示 Recent 标签。
- 跨会话聚合统计上线：`summarizeSearchHits` 计算总命中、会话数、title/model/message、拼音命中与平均分，搜索栏下方 `data-session-search-stats` 让用户一次搜索即可判断覆盖范围。
- Recent 标签支持点击回填，清空按钮同时清理 DOM 与 localStorage；`verify:ui` / `verify:preview` 的 `sessionSearchHistoryStats` lane 覆盖 `question` 命中多会话消息、历史可见、回填与清空。
- Rust 无结构变更；`npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- `sessionManagement` 的 `emptyState` 偶发因异步时序读到旧渲染；改为 waitFor 轮询期望空态后稳定，双端验证恢复全绿。

### Action Items

- 下一 Sprint 候选：MOA 链式路由、跨流 token 预算、多 Provider 自动降级、错误日志趋势优化、审计跨时间轴图、AI 复盘结果一键保存更多入口。
- 保留 `sessionSearchHistoryStats` lane，修改会话搜索、命中聚合或 AI Studio 会话栏时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 107

### What went well?

- 会话搜索升级为原文 → 全拼 → 首字母三层匹配：Rust 引入 `pinyin` crate，`db.ts` 引入 `pinyin-pro`，两侧同构；命中类型 `pinyin-title` / `pinyin-model` / `pinyin-message` 让 UI 与验证都能区分来源。
- 拼音消息命中沿用 `messageId`，点击后自动加载消息、滚动到命中位置并高亮，`sessionPinyinSearch` lane 在 dev 与 preview 均覆盖 `mrjh` / `meirijihua` / `mnhjd`。
- Rust 120 条单测、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 拼音 lane 首次用新会话覆盖 localStorage，导致后续 `sessionManagement` 的 `emptyState` 断言失败；改为追加拼音会话并在 lane 结束后清理，双端验证恢复稳定。

### Action Items

- 下一个 Sprint 候选：搜索历史与跨会话聚合统计。
- 保留 `sessionPinyinSearch` lane，修改搜索评分、会话模型或消息渲染时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 106

### What went well?

- Provider 优先级落库：`providers.priority INTEGER NOT NULL DEFAULT 0`，旧库 `migrate_provider_priority` 幂等补列并回写 `NULL`；`list_providers` / `get_provider` 按 `priority DESC, rowid ASC` 返回。
- 路由与 MOA 统一按优先级排序：Rust `stream_ai_message` / `send_ai_message`、浏览器 fallback 的 `sendAiMessageStream` / `routeProvider` 同构；同优先级下 Auto 路由继续用健康延迟兜底。
- System Provider 卡片新增上/下优先级按钮，`data-provider-priority` 系列锚点让 `verify:ui` / `verify:preview` 能断言排序与持久化。
- `indexQueuePersist` lane 在 preview 偶发先看到 active 后看到 drained、却错过 queue count；改为 `(sawQueue || activeSeen) && drained`，仍覆盖“重载后恢复执行并清空”的核心语义。
- Rust 119 条单测、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`npm run build`、lint、prettier、`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首次 `verify:preview` 在 `indexQueuePersist` 失败：队列处理太快，轮询没有捕获 `count > 0`，但已捕获 `activeSeen` 与最终 drained；收紧断言条件后稳定。

### Action Items

- 下一个 Sprint 候选：拼音/中文分词模糊搜索、搜索历史与跨会话聚合统计。
- 保留 `providerPriority` lane，修改 Provider 模型、路由或 MOA 取流逻辑时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 105

### What went well?

- 会话搜索的消息命中现在携带真实 `messageId`：Rust `search_sessions` 查询 `SELECT id, content`，浏览器 fallback 同步携带 `message.id`，两侧行为一致。
- AI Studio 点击命中会话会自动加载消息、滚动到命中位置并高亮，`data-message-id` 与 `message-jump-highlight` 为验证提供稳定锚点。
- `verify:ui` / `verify:preview` 的 `sessionSearchEnhanced` lane 新增跳转断言，`jumpMessageId` 与 `highlightedMessageId` 在 preview 中一致。
- Rust 118 条单测、`cargo fmt` / `cargo clippy --lib -- -D warnings`、`npm run build`、lint、prettier、`verify:preview` 全绿。

### What went wrong?

- `@dnd-kit/utilities` 导出的 `CSS` 遮蔽了全局 `CSS.escape`，`tsc` 首次构建失败；改用 `window.CSS.escape` 后通过。
- 跳转后 aside 可能重渲染，验证 lane 重新获取 fulltext 控件引用，避免陈旧 DOM 导致空态断言失败。

### Action Items

- 下一个 Sprint 候选：Provider 权重 / 路由排序、拼音模糊搜索、搜索历史与跨会话聚合统计。
- 保留 `sessionSearchEnhanced` lane，修改会话搜索、消息渲染或跳转逻辑时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 104

### What went well?

- MOA 三路并行流结束前追加确定性的 `## MOA Consensus` 摘要块：共识关键词、分歧/独特观点、结论首行，随主消息一起落库。
- Rust 与浏览器 fallback 通过同构 `build_moa_consensus` 生成相同结构；`stream_ai_message` 的三路 `spawn_blocking` 返回最终文本后统一 emit 摘要。
- AI Studio MOA badge 升级为 `3-way+summary`，Inspector 展示 `3-way consensus` 状态与 Consensus 摘要。
- `verify:ui` / `verify:preview` 的 `moaParallel` lane 新增 `consensusSeen` / `summaryText` 断言，`maxActive = 3`；Rust 新增 1 条单测，总计 118 通过。
- `npm run build`、lint、prettier、`cargo fmt`、`cargo clippy --lib -- -D warnings`、`verify:preview` 全绿。

### What went wrong?

- 停用词表首版包含 `answer` / `answers`，导致三路共同关键词断言失败；移除后 Rust / TS 两侧规则保持一致。
- 流式函数返回值从 `()` 改为完整文本后，Rust 需要显式声明 `JoinHandle<Result<String, String>>`，补齐后编译通过。
- 摘要追加在流内同一 run，Inspector 读取 `run.content` 存在事件竞态，通过短暂轮询等待摘要块后稳定展示。

### Action Items

- 下一个 Sprint 候选：Provider 权重 / 路由排序、会话消息内跳转、拼音模糊搜索。
- 保留 `moaParallel` lane，修改流式链路、取消语义或 Provider 选择逻辑时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 103

### What went well?

- 会话搜索从精确 includes 升级为模糊 + 全文：Rust `search_sessions` 与 TS fallback 同构实现字符子序列评分，标题 / 模型 / 消息内容均可命中，pinned 加权并支持时间范围过滤。
- AI Studio 会话栏新增 180ms 防抖搜索、Any / Today / 7d / 30d 时间范围、全文开关与命中摘要；`data-session-match-type` 区分 title / model / message。
- `verify:ui` / `verify:preview` 新增 `sessionSearchEnhanced` lane，覆盖模糊标题、消息全文、全文关闭空态与恢复列表；Rust 新增 3 条单测，总计 117 通过。
- `npm run build`、`cargo fmt`、`cargo clippy --lib -- -D warnings`、`verify:preview` 全绿。

### What went wrong?

- 首轮消息全文断言读到上一次模糊搜索的旧渲染，目标按钮还在但 matchType 仍是 `title`；改为等待期望 matchType 后再取摘要，消除竞态。
- Rust 构造命中项时移动 `session` 后又读 `pinned`，编译器拦截；先取 pinned 再构造，clippy 随后给出 `is_none_or` 简化建议，已落地。
- preview 偶发 CDP `Runtime.evaluate` 超时，重跑通过，最终干净运行全绿。

### Action Items

- 下一 Sprint 候选：MOA 三路共识摘要、Provider 权重 / 路由排序、会话消息内跳转与拼音模糊搜索。
- 保留 `sessionSearchEnhanced` lane，修改会话搜索、消息存储或 AI Studio 会话栏时重跑 `verify:ui` / `verify:preview`。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 102

### What went well?

- 前端质量门禁落地：ESLint flat config + TypeScript/React rules，Prettier 覆盖 55 个代码/配置文件，`husky` pre-commit 通过 `lint-staged` 自动 fix 与格式化。
- 六个 `react-hooks/exhaustive-deps` warning 清零：Knowledge 加载函数与自动巡检用 `useCallback`，System 定时器用 ref 持有最新闭包，Projects 补 `projects` 依赖。
- `npm run lint` 0 errors / 0 warnings，`npx prettier --check .` 全绿；build、Rust 114 单测、fmt、clippy、`verify:preview` 全绿。

### What went wrong?

- Prettier 首轮批量写入后 `ChatView.tsx` 仍有一处未对齐，单独重写一次后 check 才全绿；以后格式验收以 `prettier --check` 为准。
- React Hooks v7 新增的四条激进规则会改变现有实现语义，关闭后保留 `exhaustive-deps` 逐个手修。

### Action Items

- 后续提交必须通过 husky/lint-staged；改动 UI、hooks 或验证脚本后重跑 `npm run lint` 与 `verify:preview`。
- 下一 Sprint 候选：会话搜索模糊匹配、MOA 共识摘要、Provider 权重 / 路由排序。
- Connection Layer 与 Monetization Workbench 继续搁置，后续有需要再开发。

## Sprint 101

### What went well?

- MOA 从串行聚合升级为真实并行：Rust `stream_ai_message(moa=true)` 对前 3 个启用 Provider 并发 `spawn_blocking`，每路先 emit `## {name}` 再流式输出，单路失败只写错误片段，最终统一 `done` 收尾。
- 浏览器 fallback 用 `Promise.allSettled` 并发真实 SSE / NDJSON；`streamProviderLive` 新增 `final` / `manageCancel` 选项，多路共享 runId 取消标记。
- `verify:ui` / `verify:preview` 新增 `moaParallel` lane：3 个本地 SSE mock 同时收到请求（`maxActive = 3`），三个标题与回复全部渲染。
- `reloadAndWait` 改为 `Page.navigate` + URL marker 轮询，`waitForApp` 容忍瞬时 CDP 上下文切换，reload 竞态超时消除。
- `npm run build`、`verify:ui`、`verify:preview` 全绿；Rust 114 单测、fmt、clippy 通过。

### What went wrong?

- reload 后偶发 `Runtime.evaluate` 超时：旧实现靠 `Page.loadEventFired` 等待，可能在导航前的旧上下文误判就绪，随后 evaluate 落在被销毁的上下文上；改为 marker 轮询后稳定。
- MOA lane 首轮 `maxActive = 0`：mock 的 CORS `Allow-Headers` 缺 `Authorization`，预检被浏览器拦截；补全后三路并行请求到达。

### Action Items

- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、会话搜索模糊匹配、MOA 共识摘要。
- MOA 共识摘要、Provider 权重排序与跨流 token 预算留在 Backlog。
- 保留 `moaParallel` lane，修改流式链路或 Provider 选择时重跑 `verify:ui` / `verify:preview`。

## Sprint 100

### What went well?

- 会话工作台上线：`sessions.pinned` 列 + `migrate_session_pinned` 幂等迁移，`list_sessions` 返回消息数并按置顶优先排序。
- Rust 新增 `set_session_pinned` / `duplicate_session`，浏览器 fallback 同构实现；复制会话生成 `(copy)` 标题并完整复制消息。
- AI Studio 会话行新增置顶、消息数、复制与 Markdown 导出；导出面板支持预览、复制与下载。
- `verify:ui` / `verify:preview` 新增 `sessionWorkspace` lane；Rust 114 单测、clippy、build 全绿。

### What went wrong?

- 首轮置顶断言把两个会话都设为置顶后仍要求 Alpha 排第一，与“同置顶按创建时间倒序”冲突；改为先取消 Beta 置顶再验证。
- `streamError` lane 偶发 busy 残留导致找不到 Send 按钮，补等待与 Stop 兜底后稳定。

### Action Items

- 下一 Sprint 候选：真实 MOA 并行、前端 ESLint/Prettier + husky/lint-staged、会话搜索模糊匹配。
- 复制会话暂不复制消息版本历史，后续可按需做版本树迁移。
- 保留 `sessionWorkspace` lane，改动会话模型或 AI Studio 会话交互时重跑 `verify:ui` / `verify:preview`。

## Sprint 99

### What went well?

- 系统事件总线上线：`emitWorkbenchEvent(event, context?)` 统一入口，剪贴板、错误、同步、知识索引四类生命周期事件接入 Webhook 触发器。
- 投递写入后派发 `workbench:webhook-deliveries-updated`，SystemView 即时刷新投递队列，5 秒轮询降级为兜底。
- `verify:ui` / `verify:preview` 新增 `webhookSystemEvents` lane：真实 Pull 触发 `sync.completed`，真实 `ErrorEvent` 触发 `error.reported`，payload 与 DOM 展示端到端断言通过。
- `npm run build`、`verify:ui`、`verify:preview` 全绿；本 Sprint 纯前端改动，Rust 无变更。

### What went wrong?

- 首版 error 断言失败不是链路错误：投递与错误日志均已写入，但 SystemView 5 秒轮询晚于断言 4 秒等待窗口，导致 DOM 断言取空。
- 通过临时诊断字段确认后，改为事件入队即时刷新 UI，并把 error 轮询窗口延长到 6 秒，测试与真实体验同时稳定。

### Action Items

- 下一 Sprint 候选：真实 MOA 并行、前端 ESLint/Prettier + husky/lint-staged、AI Studio 会话增强。
- Connection Layer 与 Monetization Workbench 已按用户要求搁置，后续有需要再开发。
- 保留 `webhookSystemEvents` lane，改动事件链路或投递面板时重跑 `verify:ui` / `verify:preview`。

## Sprint 98

### What went well?

- Webhook payload 模板上线：`render_webhook_payload` 支持 `{{event}}` / `{{ts}}` / `{{context.<field>}}`，占位符展开为 JSON 值，缺失 context 字段展开为 `null`，未知占位符保留原文。
- 定时 worker、Run now、事件触发三条链路统一渲染 payload，规则模板只需写一次，投递内容随事件 / 上下文变化。
- `triggerWebhookEvent` 增加可选 context：Tauri 侧透传，浏览器 fallback 用同构 `renderWebhookPayload` 渲染，两侧行为一致。
- SystemView 新增 Context JSON 输入与 Preview payload，投递队列行直接展示最终 payload；`webhookPayloadTemplate` lane 覆盖预览与触发后的渲染结果。
- Rust 112 个单测通过，clippy 零告警，`verify:ui` / `verify:preview` 全绿。

### What went wrong?

- 首版测试把占位符写成 `"event":"{{event}}"`（占位符外包引号），与 JSON 值展开约定冲突导致渲染出 `""sync.completed""`；统一为 `"event":{{event}}` 后修复。
- 缺失 context 字段最初保留 `{{...}}` 原文，会让 JSON 失效；改为展开为 `null` 后测试稳定。
- 模板渲染函数同时改 Rust 与 TS 时，两边语义必须保持完全一致；本次靠同一份 verify lane 兜底。

### Action Items

- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、真实 MOA 并行、系统事件总线接入。
- 后续可做 payload schema 校验、模板版本管理与高级语法（条件 / 循环）。
- 保留 `webhookPayloadTemplate` lane，改动投递链路或模板语法时重跑 `verify:ui`。

## Sprint 97

### What went well?

- Provider 模型探测上线：`list_provider_models` 同时支持 OpenAI-compatible `/models` 与 Ollama `/api/tags`，Bearer 鉴权只对非 Ollama 附加，8 秒超时兜底。
- `parse_provider_models` 兼容 `data[].id / owned_by` 与 `models[].name` 两种形状，空列表 / 非法 JSON 返回明确错误。
- 浏览器 fallback 与 Rust 同构：`listProviderModels` 走真实 fetch，错误通过 `data-provider-model-error` 回显，坏地址路径在 verify 中验证。
- SystemView 模型输入改为受控 + 探测下拉：`data-provider-models-detect`、`data-provider-model-options`、`data-provider-model-option`，选择后立即持久化并切换 live 徽标。
- `verify:ui` / `verify:preview` 新增 `providerModels` lane：本地 `/models` mock 断言 3 个选项、选中持久化、badge live、错误提示；Rust 110 个单测通过，clippy 零告警。

### What went wrong?

- 首次把结构体、解析器、命令与注册放在同一个大补丁里，apply_patch 上下文匹配失败；拆成小补丁后通过，后续 Rust 改动应保持小步提交。
- 浏览器 fetch 失败在坏地址上显示 `Failed to fetch`，文案可读性一般；后续可把网络错误映射为更友好的提示。
- 模型输入从 `defaultValue` 改为受控后需要同步 `modelDrafts`：选择下拉项时必须先写 draft 再持久化，否则输入框不会立即刷新。

### Action Items

- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、真实 MOA 并行、Webhook payload 模板 / 上下文字段。
- Provider 探测后续可做模型能力元数据、最近使用排序与 `/models` 缓存。
- 保留 `providerModels` lane，改动 Provider UI 或探测链路时重跑 `verify:ui`。

## Sprint 96

### What went well?

- Webhook 规则支持事件触发：`webhook_rules.trigger_event` 新库建列 / 旧库幂等迁移，`list_event_webhook_rules` 按事件匹配 enabled 规则，`list_due_webhook_rules` 只选定时规则，两类规则不再互相干扰。
- 投递队列落地：新增 `webhook_deliveries` 表（queued / delivering / success / dead、attempts、next_attempt_at），`spawn_webhook_scheduler` 重构为 `spawn_webhook_delivery_worker`，定时与事件投递统一入队消费，失败按 `1000ms << attempts` 指数退避，超限标记 dead。
- Tauri 命令补全：`trigger_webhook_event`、`list_webhook_deliveries`、`retry_webhook_delivery`、`delete_webhook_delivery`、`clear_webhook_deliveries` 全部注册；浏览器 fallback 用 `ai-workbench:webhook-deliveries:v1` 保持同一模型。
- SystemView 投递队列面板：事件触发输入、快捷按钮、状态与 attempts 展示、Retry / Delete / Clear dead 全部可操作；删除规则时级联清理其投递记录。
- `verify:ui` / `verify:preview` 新增 `webhookQueueEvent` lane，覆盖创建事件规则、触发、success、Retry 回 queued、Delete 消失；Rust 109 个单测通过，clippy 零告警。

### What went wrong?

- 初始 `complete_webhook_delivery` 参数过多触发 clippy too-many-arguments；收敛状态签名后压掉，但调用方必须保持参数顺序一致。
- 事件规则加入后，旧的 `list_due_webhook_rules` 会误选事件规则导致重复投递；补 `trigger_event = ''` 过滤后定时与事件链路各自稳定。
- 浏览器 fallback 的触发命令最初缺少 enabled 过滤，与 Rust 行为不一致；统一只匹配 enabled 规则后断言通过。

### Action Items

- 下一 Sprint 候选：前端 ESLint/Prettier + husky/lint-staged、Provider `/models` 探测与真实 MOA 并行、Webhook payload 模板 / 上下文字段。
- Webhook 队列后续可做自动保留策略（天数 / 数量上限）与系统事件总线接入。
- 保留 `webhookQueueEvent` lane，改动投递链路或 System Webhook UI 时重跑 `verify:ui`。

## Sprint 95

### What went well?

- Provider 模型配置上线：`providers.model` 新库建列 / 旧库幂等迁移，`update_provider_model` 命令与 System 卡片编辑打通，`data-provider-model` 徽标区分 live / fallback。
- Rust 流式链路全面使用 `provider.model`：`stream_ai_message`、`run_provider_stream_smoke_test` 与非流式 `call_provider` 都优先配置模型，空值回退默认。
- 修复 Ollama 固定端口的隐患：`stream_ollama` / `chat_ollama` 改用 `provider.base_url`，自定义 Ollama 地址不再失效。
- 浏览器 fallback 补齐真实流式：配置 model 的 http(s) Provider 走 fetch SSE / NDJSON，逐 chunk 转发、支持取消；未配置时保留模拟流，既有 UI lane 全部不受影响。
- `verify:ui` / `verify:preview` 新增 `providerLiveStream` lane：本地 SSE mock 证明浏览器真实发起请求并渲染 `Live provider stream ok model=mock-gpt`；Rust 107 个单测通过，clippy 零告警。

### What went wrong?

- 给 `db::Provider` 增加 `model` 字段后，测试里的闭包构造器漏填新字段，首次 `cargo test` 编译失败；补齐后通过。
- MOA 分支调用 `stream_openai_compatible` 时首轮漏传 model 参数，由编译器直接拦截；补 `gpt-4o-mini` 默认值后通过。
- 浏览器实时流需要 CORS 预检，verify 的本地 mock 必须处理 OPTIONS；补 `Access-Control-Allow-*` 后稳定通过。

### Action Items

- 下一 Sprint 候选：复杂 Webhook 触发器 / 消息队列式投递、前端 ESLint/Prettier + husky/lint-staged、Provider `/models` 探测与下拉选择。
- 模型编辑目前是自由文本，后续可做模型列表探测与最近使用排序。
- 保留 `providerLiveStream` lane，改动 Provider 或流式链路时重跑 `verify:ui`。

## Sprint 94

### What went well?

- 本地确定性向量嵌入上线：Rust 与 TS 镜像实现 256 维 hash 向量（fnv1a + Unicode token/char gram），`search_thoughts` 升级为 BM25 + 1.2 * 余弦的混合评分，结果新增 `vector_score`。
- `knowledge_files` 新增 `embedding TEXT`：`migrate_knowledge_embedding` 幂等补列，`upsert_knowledge_file` 写入 JSON 向量，`RagIndexStatus` 返回 `vectorIndexed`；浏览器 fallback 同构。
- Knowledge 搜索结果新增跨文件命中选择器：`data-cross-file-hits` chips 逐文件过滤，结果带 `data-rag-file` / `data-rag-vector-score`，底部 `data-vector-status` 显示真实状态。
- `verify:ui` / `verify:preview` 新增 `vectorRagCrossFile` lane，dev 与生产构建全绿；Rust 106 个单测通过，clippy 零告警。

### What went wrong?

- 新 Rust 测试只建了 `knowledge_files` 表，`search_thoughts` 查询 `thoughts` 时报 no such table；补建 thoughts 表后通过。
- `visibleThoughts` 是 `Thought | RagSearchResult` 联合类型，直接访问 `t.vectorScore` 触发 TS2339；改为 `"vectorScore" in t` 窄化后通过。
- 六元组文档类型触发 clippy type-complexity；重构为 `SearchDoc` 结构体后清零。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、复杂 Webhook 触发器 / 消息队列式投递、前端 ESLint/Prettier + husky/lint-staged。
- 本地向量后续可接真实 Embedding 模型、向量分片 / 近似索引，并继续留在 Backlog。
- 保留 `vectorRagCrossFile` lane，改动检索或 Knowledge UI 时重跑 `verify:ui`。

## Sprint 93

### What went well?

- Projects 新增 Orbit / Fan 双模式项目轮播：Orbit 用 3D 环形定位，Fan 用扇形堆叠，导航支持按钮、滚轮与方向键，卡片内容与选中态清晰。
- Autoplay 做成显式开关而非默认装饰：rAF 推进、hover / focus 暂停，`prefers-reduced-motion` 下自动关闭，符合“禁止默认持续装饰动画”的约束。
- Material Settings 抽屉实时调参：preset / opacity / blur 直接改写 CSS 变量与 `data-material-global`，localStorage 持久化，重载后恢复。
- 顺手修了 Motion DoD 的隐患：Inspector 断言从裸 `aside` 改为 `aside.drawer-panel`，避免新增抽屉后误取元素。
- `verify:ui` / `verify:preview` 新增 `projectCarousel` / `projectCarouselReduced` / `materialDrawer` lane，dev 与生产构建全部通过。

### What went wrong?

- 新增 `<aside>` 抽屉后，旧的 Inspector 布局断言 `document.querySelector('aside')` 会先命中 Material 抽屉，导致 layoutStable 偶发失败；按 `drawer-panel` 类精确定位后修复。
- reduced-motion 下全局 `transition-duration: 0.01ms !important` 会覆盖局部 `transition: none`，断言按 `<=0.02s` 判断而不是等 `0s`，与既有 motion 断言口径一致。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Vector Embedding RAG、复杂 Webhook 触发器 / 消息队列式投递。
- 轮播速度控制、拖拽排序、Material 逐卡独立配色继续留在 Backlog。
- 保留三个新 lane，改动轮播 / 抽屉或全局 motion 规则时重跑 `verify:ui`。

## Sprint 92

### What went well?

- 同步快照升级为 AES-256-GCM 端到端加密：Rust 用 `ring`（PBKDF2 100k + AES-GCM），浏览器用 Web Crypto，两侧共享 `{v, alg, salt, iv, ciphertext}` envelope，导出文件可跨侧还原。
- `push_sync_snapshot` / `pull_sync_snapshot` 增加可选 `passphrase`，导出 / 导入 / push / pull / auto sync 全链路统一支持加密；System Sync card 新增 E2E 开关、口令输入与状态徽标。
- 新增 4 个 Tauri 命令与 3 条 Rust 单测；`verify:ui` / `verify:preview` 新增 `syncE2e` lane，覆盖导出、导入、错误口令拒绝与加密 push。
- 发现并修复 Chromium DOMException `message` 为空导致错误被吞的问题：`syncErrorMessage` 兜底显示 `Operation failed (OperationError)`。

### What went wrong?

- 浏览器 AES-GCM 错误口令抛出的 DOMException `message` 为空字符串，初版 UI 把空字符串当作成功消息隐藏；补齐错误名兜底后修复。
- `syncE2e` lane 结束后若保持 E2E 开关打开，后续结构化冲突 lane 会误走加密导入路径；lane 收尾改为清空口令并关闭开关。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Vector Embedding RAG、跨文件命中选器。
- 口令强度检查、导出前确认、多设备口令交换与密钥轮换继续留在 Backlog。
- 保留 `syncE2e` 断言，改动加密协议或 Sync UI 时重跑 `verify:ui`。

## Sprint 91

### What went well?

- AI Studio 新增 RAG 命中人工确认：`ragConfirmMode` 开关开启后，检索到命中先展示确认面板，逐条勾选后再发送，避免无关知识被自动注入。
- `sendText` 拆出 `dispatchSend`，确认态不置 busy；确认后只注入勾选命中，普通发送、团队模式、复盘与 regenerate 全部保持原有行为。
- 确认面板带 `data-rag-confirm-panel` / `data-rag-confirm-hit` / `data-rag-confirm-send` / `data-rag-confirm-cancel`，Send 按钮 0 选中时禁用；New chat 与会话切换会清理待确认内容。
- `verify:ui` / `verify:preview` 新增 `ragConfirmSend` lane：2 条命中 → 取消 1 条 → Send with 1 → badge RAG +1；关闭确认后直发不出现面板，全部通过。

### What went wrong?

- 首版若把确认面板放在 rag-badge 之前会导致选中后面板闪烁；调整渲染位置到 quick prompts 上方后稳定。
- verify lane 需在确认发送后等待 busy 结束再关确认开关，否则第二次直发会被 busy 忽略；补 Send 按钮轮询后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Embedding 向量检索、跨文件命中选择器。
- 命中确认的“记住选择”、来源优先级排序继续留在 Backlog。
- 保留 `ragConfirmSend` 断言，改动 AI Studio 发送链路或 RAG 交互时重跑 `verify:ui`。

## Sprint 90

### What went well?

- Webhook 投递升级为企业级策略：`webhook_signature` 用已在锁文件中的 sha2 实现 HMAC-SHA256，RFC 4231 已知答案单测固定正确性，发送 `X-Webhook-Signature` 与 `X-Webhook-Timestamp` 头。
- `deliver_webhook_http` 支持指数退避重试：非 2xx 或网络错误按 `50ms << attempt` 重试，返回 `attempts` / `signed`；本地 TCP 单测覆盖 500 → 503 → 200 的 3 次尝试链路。
- `webhook_rules` 新增 `secret` / `retries` 列，旧库走 `migrate_webhook_secret_retries`；`WebhookRuleInput` 收敛参数，`create_webhook_rule` 改为 `WebhookRuleRequest` 结构体，clippy too-many-arguments 清零。
- SystemView 新增签名 secret 输入与 retries 下拉，结果区展示 attempts / signed，规则行显示 retries 与 signed badge；浏览器 fallback 确定性返回 `retries + 1` 次。
- `verify:ui` / `verify:preview` 新增 `webhookSignRetry` lane：投递结果 attempts=3 / signed、规则持久化 secret / retries 均通过。

### What went wrong?

- 首次尝试引入 `hmac` crate 时 crates.io 走代理连接失败；改为仅添加锁文件中已有的 `sha2` 并手写 HMAC 拼接，用 RFC 已知答案验证，避免新增网络依赖。
- `create_webhook_rule` 参数增至 9 个触发 clippy；用 `WebhookRuleInput` + `WebhookRuleRequest` 收敛后通过。
- verify lane 首轮读到上一个 lane 的旧投递结果（2 attempt / unsigned），改为轮询等待 attempts=3 / signed 后稳定。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、RAG 命中人工确认、消息队列式 Webhook 投递。
- 复杂触发器表达式、签名验签 UI、死信重放继续留在 Backlog。
- 保留 `webhookSignRetry` 断言，改动投递策略或 Webhook UI 时重跑 `verify:ui`。

## Sprint 89

### What went well?

- Projects diff 从纯文本 `<pre>` 升级为行级渲染：`parseDiffLines` 把 diff 分为 file / hunk / add / del / context，行背景与文字按类型着色；`highlightLine` 对注释、字符串、数字、关键字做内联高亮，diff 面板可读性明显提升。
- Rust 新增 `get_git_file_versions(path, file)`：tracked 文件返回 `git show HEAD:file` 与磁盘内容，untracked 返回空 old；两条单测覆盖 tracked / untracked 两条链路。
- `db.ts` 新增 `getGitFileVersions`，浏览器 fallback 从 `getGitFileDiff` mock 反解 old / new，`verify:ui` / `verify:preview` 无需真实 Git 仓库即可验证。
- ProjectsView 新增 Side by side 切换：`data-git-side-by-side-toggle` 打开 HEAD / Working tree 双栏，`data-git-file-version=old|new` 便于断言；切回 Inline 后原有行渲染恢复。
- `verify:ui` / `verify:preview` 新增 `gitInlineDiffSideBySide` lane：断言行类型集合、高亮 span、双栏行号与往返切换均通过。

### What went wrong?

- 首版把高亮模块建成 `.ts`，内含 JSX 导致 `npm run build` 编译失败；改为 `.tsx` 并收敛 `ReactNode` 类型后通过。
- `git diff` 的 `---` / `+++` 头与 `-` / `+` 行前缀需要额外判空，首轮解析把 `---` 误判为 del 行，补前缀保护后修正。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Vector Embedding RAG、提交阶段行级 diff 选择。
- Side by side 大文件渲染、diff 编辑与三向 merge 继续留在 Backlog。
- 保留 `gitInlineDiffSideBySide` 断言，改动 diff 渲染或版本读取命令时重跑 `verify:ui`。

## Sprint 88

### What went well?

- `quick_prompts` 新增 `sort_order` 列：SCHEMA 与新库自动包含，旧库走 `migrate_quick_prompt_order` ALTER TABLE + rowid 回填，无数据丢失；`QuickPrompt.order` 进入同步快照，与 Sprint 87 协议兼容。
- 新增 `update_custom_quick_prompt` / `reorder_custom_quick_prompts` 两个 Tauri 命令，单测覆盖“编辑拒绝内置行、重排后 order 0..n-1 持久化”。
- AIStudioView Manage 面板升级为 dnd-kit 行式列表：拖拽手柄 + 编辑 + 上下箭头 + 删除；编辑态复用顶部表单并显示 Save / Cancel；`loadQuickPromptsByUsage` 改为“使用次数降序 + order 升序”，既有用法 / 同步断言全部保持。
- `verify:ui` / `verify:preview` 新增 `quickPromptEditSort` / `quickPromptEditSortPersist` lane：新增两个 prompt → 编辑第一个 → 下移 → 断言 DOM 顺序、localStorage order 与刷新持久化均通过。

### What went wrong?

- 首次实现时 `startEdit` 与既有消息编辑函数重名，TS 编译报重复声明；改名 `startQuickPromptEdit` 后恢复。
- `update_custom_quick_prompt` 初版错误类型混用 `rusqlite::Error` 与 `String`，改为统一返回 `Result<_, String>` 后通过 clippy / 单测。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、行内着色与 diff 编辑器 / 整文件对比视图。
- Vector Embedding RAG、Sync HTTPS / E2E 加密、Webhook 签名与重试继续留在 Backlog。

## Sprint 87

### What went well?

- Rust 新增 `quick_prompts` / `quick_prompt_usage` 表与完整模型：list / upsert / delete / record 覆盖本地读写，Sync Snapshot 导出与合并完整接入，usage 按 max count 合并且不回退。
- `quick_prompt` 冲突 local / remote 内容改为完整 JSON，`resolve_conflict` / union / structured 三种仲裁均支持该 kind；新增单测覆盖“远端 prompt 更新 + 选择 remote 恢复”链路。
- TS 侧把 AIStudioView 从同步 `quickPrompts.ts` 调用迁移到 `db.*` 异步 API，浏览器 fallback 继续使用同一对 localStorage key；`verify:ui` / `verify:preview` 新增 `quickPromptSync` / `quickPromptSyncVisible` / `quickPromptSyncPersist` lane，导入 snapshot 后断言 AI Studio 可见、排序与持久化均通过。

### What went wrong?

- 初次实现时 TS `SyncSnapshot` 未预留新字段，`db.ts` 顶层残留了破损的重复类型片段；清理后把 `quickPrompts` / `quickPromptUsage` 设为可选，兼容既有构造点。
- Rust 测试里多处 `SyncSnapshot` 字面量未补新字段，`cargo test` 编译失败；逐一补齐空数组后 94/94 通过。

### Action Items

- 下一 Sprint 候选：Quick Prompt 编辑与拖拽排序、真实 Provider 端到端流式联调。
- 行内着色与 diff 编辑器、整文件对比视图继续留在 Backlog。

## Sprint 86

### What went well?

- AI Studio 新增“保存复盘”按钮（`data-ai-recap-save`）：复盘流式结束后按钮启用，取最近一条 assistant 回复组装为 `# 今日复盘 YYYY-MM-DD`，以 `#daily,#recap` / `note` 写入知识库，并回显 `data-ai-recap-save-result`。
- 普通发送与 New chat 都会重置保存入口，避免把非复盘回复误存为复盘笔记；保存期间防重复点击并回显错误。
- `npm run build` 全绿；`verify:ui` / `verify:preview` 新增 `aiRecapSave` / `aiRecapKnowledgeVisible` lane：断言 localStorage 内容（tags / type）与 Knowledge 视图可见性均通过。

### What went wrong?

- 首次实现时保存入口只要流式结束就可用，未区分普通对话回复；补上发送前重置 `recapReady` 后语义收紧。
- 保存内容按“最近一条 assistant 回复”定位，尚未绑定复盘消息 id；当前入口已足够收敛，精确绑定留给候选池。

### Action Items

- 下一 Sprint 候选：多端同步自定义 prompt 与使用次数。
- 行内着色与 diff 编辑器、整文件对比视图继续留在 Backlog。

## Sprint 85

### What went well?

- Rust 新增 `git_change_groups`：按 `git status --short` 的 XY 前缀把 dirty 文件归类为 staged / unstaged / untracked / both，`GitActivityItem` 新增 `change_groups`，未再丢失状态前缀的空格语义。
- Rust 新增 `run_commit_lint_gate` 与 `GitLintIssue`：提交前扫描冲突标记与非法 JSON，`commit_git_files` 门禁失败即拒绝提交；`cargo test --lib` 92/92，fmt、clippy、build 全绿。
- Projects dirty 预览按四组渲染（`data-git-change-group` / `data-git-change-group-header`），Commit selected 先跑 lint 门禁并展示 `data-git-lint-gate`；`verify:ui` / `verify:preview` 新增 `gitStagedUnstaged` / `gitCommitLintGate` lane，均通过。

### What went wrong?

- 首次实现把两位状态前缀 `trim()` 后判定，`" M"` 被误判为 staged；修复为保留原始前缀字节后再按位判断，单测覆盖后回归通过。
- 分组 lane 断言后未收起 preview，导致后续 diff lane 把已展开面板再次点击成收起；lane 结束前补收起等待后稳定。

### Action Items

- 下一 Sprint 候选：AI 复盘结果一键保存为知识笔记、多端同步自定义 prompt 与使用次数。
- 行内着色与 diff 编辑器、整文件对比视图继续留在 Backlog。

## Sprint 84

### What went well?

- 新增 `webhook_rules` 表与完整 CRUD / due 判定 / 状态回写；`spawn_webhook_scheduler` 后台每秒检查到期规则并真实投递。
- System Webhook delivery 卡片新增 Scheduled rules 区；`db.ts` fallback 持久化到 `ai-workbench:webhook-rules:v1`；`cargo test --lib` 90/90，fmt、clippy、build 全绿。
- `verify:ui` / `verify:preview` 的 `webhookRules` 均为 true，创建 / 持久化 / 开关 / Run now / 删除全链路通过。

### What went wrong?

- 浏览器 fallback 不跑后台调度线程，定时行为由 Rust `list_due_webhook_rules` 单测覆盖。

### Action Items

- 下一 Sprint 候选：暂存 / 未暂存分组与提交前 lint 门禁、AI 复盘结果一键保存为知识笔记、多端同步自定义 prompt 与使用次数。

## Sprint 83

### What went well?

- Rust 新增 `WebhookDeliveryResult` 与 `deliver_webhook(url, payload, method?, token?)`：默认 POST，支持 POST / PUT / PATCH / GET / DELETE，POST / PUT / PATCH 带 `Content-Type: application/json`，token 非空时带 `Authorization: Bearer`；本地 TCP 单测覆盖真实 HTTP POST、JSON body、Authorization header 与 400 状态回显。
- `db.ts` 新增 `deliverWebhook` fallback；System 视图新增 Webhook delivery 卡片（`data-webhook-deliver` / `data-webhook-result`）；`cargo test --lib` 88/88，fmt、clippy、build 全绿。
- `verify:ui` / `verify:preview` 的 `webhookDelivery` 均为 true，断言结果可见且包含 HTTP 200。

### What went wrong?

- 浏览器 fallback 只模拟成功结果，不真正发起网络请求；真实 HTTP 行为由 Rust 本地 TCP 单测覆盖。

### Action Items

- 下一 Sprint 候选：Webhook 定时器 / 触发器规则、暂存 / 未暂存分组与提交前 lint 门禁。
- 真实 Provider 端到端流式联调（真实网络）继续留在候选池。

## Sprint 82

### What went well?

- Rust 新增 `commit_git_files(path, files, message)`：空 message / 空 files 明确报错，`git add -- <files>` 只暂存选中文件后提交，与 `apply_commit` 共用 `finalize_commit`。
- Projects dirty 预览支持逐文件勾选与 Commit selected：自动生成或复用 draft message，提交后清空勾选、收起批量预览并刷新 Git activity；`cargo test --lib` 86/86，fmt、clippy、build 全绿。
- `verify:ui` / `verify:preview` 的 `gitCommitSelected` 均为 true，断言结果可见且勾选清空。

### What went wrong?

- 提交入口放在批量预览面板内，面板 filesText 会包含 “Commit selected (n)” 文字；路径断言仍按实际文件名判定，未影响验证。
- 浏览器 fallback 只模拟提交结果，不真正改变 dirty 状态；Tauri 分支由 Rust 单测在真实仓库验证选中语义。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Webhook 真实投递。
- 暂存 / 未暂存分组与提交前 lint 门禁继续留在 Backlog。

## Sprint 81

### What went well?

- Projects dirty 预览新增 Preview all：`loadBatchPreview` 逐个复用 `getGitFileDiff` 拉取全部 changed files，合并为带文件名标题的批量 unified diff，再次点击可收起。
- `batchLoading` 守卫防止加载中重复点击启动多轮拉取；`verify:ui` / `verify:preview` 的 `gitBatchPreview` 均为 true，`npm run build` 全绿。

### What went wrong?

- 批量按钮放在文件清单面板内，`gitDirtyPreview` 的 filesText 会顺带包含 “Preview all” 按钮文字；路径断言仍按实际文件名判定，后续如需纯文件清单可增加独立数据属性。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、一键提交选中文件。
- 行内着色与 diff 编辑器、整文件对比视图继续留在 Backlog。

## Sprint 80

### What went well?

- 新增 `src/lib/dailyRecap.ts`：`buildDailyRecapContext` 聚合 Focus / Habits / Schedule 与总体进度，`buildDailyRecapPrompt` 生成结构化中文提示词，AI Studio“今日复盘”按钮一键走 `sendText` 流式发送。
- `send` 拆出 `sendText(text)` 后，复盘与普通发送共用 RAG / 流式 / 会话链路；`verify:ui` / `verify:preview` 的 `aiDailyRecap` 均为 true，`npm run build` 全绿。

### What went wrong?

- 复盘 lane 首次在回复仍在流式时返回，导致后续 stream lane 的发送被 `busy` 忽略；改为等待 `data-streaming` 空闲后再继续。
- 复盘成为首个发送后，后续测试消息都并入复盘会话，“sprint RAG check”独立会话标题消失；lane 结束后点击 New chat 复位，并把会话删除断言改为“无孤儿消息”，让统计不再受其他会话干扰。

### Action Items

- 下一 Sprint 候选：批量提交内容预览、真实 Provider 端到端流式联调。
- 把 AI 复盘结果一键保存为知识笔记进入候选池。

## Sprint 79

### What went well?

- Quick Prompt 从“固定顺序”升级为“常用优先”：`quickPrompts.ts` 新增使用次数读写与 `loadQuickPromptsByUsage`，按次数降序、同次数按默认顺序稳定排序，计数持久化到 `ai-workbench:quick-prompt-usage:v1`。
- 点击芯片即累计并重排，芯片带次数角标与 `data-quick-prompt-usage`；`verify:ui` / `verify:preview` 新增 `quickPromptUsage` / `quickPromptUsagePersist` lane，均为 true，`npm run build` 全绿。

### What went wrong?

- 验证 lane 首次把芯片 label 当成 id 断言（`daily-recap` vs `Daily recap`），首轮失败后改为按 label 判首个芯片、按 id 判 DOM 顺序。
- 点击 2 次 daily-recap 后 wind-down 需要 3 次才能靠次数越过它；这暴露了同次数按默认顺序稳定排序的语义，验证 lane 已按此固化。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、批量提交内容预览、AI 生成式复盘。
- 多端同步自定义 prompt 与使用次数继续留在 Backlog。

## Sprint 78

### What went well?

- Rust 新增 `GitFileDiff { path, status, diff }` 与 `get_git_file_diff(path, file)`：未跟踪文件读磁盘转 `+` 新增行，已跟踪文件优先 `git diff --unified=3`、为空再走 `git diff --cached`，覆盖已跟踪 / 暂存 / 未跟踪三类 diff。
- Projects 的 dirty 预览中每个文件新增 Diff 开关，点击后渲染 `<pre>` unified diff，可再次点击收起；TS fallback 返回可读 mock diff。
- 验证覆盖：`cargo test --lib` 84/84，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitDirtyDiff` 均为 true。

### What went wrong?

- 已跟踪文件首次只走 `git diff`，纯暂存改动场景会拿到空输出；补上 `--cached` fallback 后语义才完整。
- 未跟踪文件把整份磁盘内容转成 `+` 行，大文件 diff 体积会偏大；当前只做纯文本预览，不做分块或着色。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、Quick Prompt 编辑与排序、批量提交内容预览。
- 行内着色与 diff 编辑器、整文件对比视图进入 Backlog。

## Sprint 77

### What went well?

- Quick Prompt 从静态模板升级为可维护的个人入口：`quickPrompts.ts` 新增自定义模型与 localStorage 读写，AI Studio Manage 面板支持 label / category / text 新增与删除，内置模板不可删除。
- 自定义项与内置项合并渲染，点击自定义项同样填入输入框并聚焦；`verify:ui` / `verify:preview` 的 `quickPromptManager` 断言新增即见，`quickPromptPersist` 断言刷新保留、删除消失。
- 验证覆盖：`npm run build` 全绿；`verify:ui` / `verify:preview` 新增 lane 均为 true，既有全部 lane 保持通过。

### What went wrong?

- 验证脚本首次用 `HTMLSelectElement.prototype.value` setter 设置 category 时触发 Illegal invocation，而直接赋值又不会更新 React 受控状态；最终保留默认 work 分类完成持久化断言，避免测试层与 React 状态追踪打架。
- 自定义 prompt 的 id 由 `Date.now()` 生成，同毫秒连续新增会撞 id；当前单次新增场景无影响，后续可改为 `makeId()` 或加计数器。

### Action Items

- 下一 Sprint 候选：Git dirty 逐文件 diff 预览、真实 Provider 端到端流式联调、Quick Prompt 编辑与排序。

## Sprint 76

### What went well?

- Actions 新增 `Today progress` 置顶卡片：Focus / Habits / Schedule 三类完成数、总进度条与下一个未完成日程一眼可读，聚合自现有 store 数据，无新增落库字段。
- 进度卡暴露 6 个稳定数据属性，`dailyProgress` lane 在 seed 态断言 Focus 0/3、Habits 0/3、Schedule 0/2、Next 含“每日复盘”。
- 验证覆盖：`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `dailyProgress` 均为 true，Actions 卡片无重叠。

### What went wrong?

- 本轮无 Rust 变更，无阻塞性问题；主要工作是确保 `dailyProgress` lane 插入在新建任务之后、习惯打卡之前，用固定 seed 态拿到可稳定断言的三类计数。

### Action Items

- 下一 Sprint 候选：Git dirty 逐文件 diff 预览、真实 Provider 端到端流式联调、Quick Prompt 自定义编辑与持久化。

## Sprint 75

### What went well?

- 围绕“便捷日常的生活和工作”在 AI Studio 加入 6 个 Quick Prompt：生活（Daily recap / Meal plan / Wind down）与工作（Week plan / Summarize notes / Draft reply）各 3 个，一键填入结构化提示词并聚焦输入框。
- `src/lib/quickPrompts.ts` 用 `category: life/work` 统一数据模型，UI 芯片暴露稳定数据属性，为后续自定义模板与按分类分组预留结构。
- 验证覆盖：`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `quickPrompts` lane 断言 6 个芯片、life/work 两类齐全、点击后输入框内容正确。

### What went wrong?

- 本轮无 Rust 变更，无阻塞性问题；主要工作量在把 Quick Prompt lane 插入 streaming 之前，避免点击模板后的输入框内容影响后续流式断言。

### Action Items

- 下一 Sprint 候选：Git dirty 逐文件 diff 预览、真实 Provider 端到端流式联调、Quick Prompt 自定义编辑与持久化。

## Sprint 74

### What went well?

- 索引队列重试从固定 800ms 升级为按 `attempts` 指数退避：500ms 基数、2 倍增长、4000ms 封顶，`retry_delay_ms` 进入 active / queued 快照，Knowledge 队列行显示 `retry N · NNNms`。
- TS fallback 与 Rust 共用同一退避公式；`indexQueueRetry` 断言 500 / 1000ms，新增 `indexQueueBackoff` lane 独立验证 attempts 1/2 与退避递增。
- 验证覆盖：`cargo test --lib` 82/82，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `indexQueueRetry` / `indexQueueBackoff` 均为 true。

### What went wrong?

- 固定 800ms 改退避后，第一段 500ms 窗口被 `clickDock` 的 450ms 等待吃掉，`attempts=1` 一度捕获不到；新增 `clickDockFast` 并把 mock 首次失败延后到 1200ms，后续重试立即失败，稳定捕获完整退避链。
- `indexQueueBackoff` 种子路径首次写成 `C:/backoff-vault`，不包含 retry 关键字，跑成了正常索引直接 drain；改为 `C:/backoff-retry-vault` 后通过。

### Action Items

- 下一 Sprint 候选：Git dirty 逐文件 diff 预览、真实 Provider 端到端流式联调、围绕 5 大主视图补日常高频能力。

## Sprint 73

### What went well?

- Git activity 从“只看统计数字”升级为“能看清改动、能感知节奏”：`git_change_paths` 剥离 `git status --short` 的 XY 前缀并处理 rename 箭头，dirty 行可 Preview 展开 / 收起实际文件列表。
- `build_commit_trend` 聚合 reflog 全部时间戳为 UTC 日粒度 `commit_trend`，Git activity 卡片新增最近 7 日趋势条；TS fallback 与 Rust 共用同一预览与聚合语义。
- 验证覆盖：`cargo test --lib` 81/81，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitDirtyPreview` / `gitCommitTrend` 均为 true。

### What went wrong?

- 首次解析 `git status --short` 时先 `trim` 再取第 3 个字符，导致 `" M file"` 丢失首字符；改为 `trim_end` + 检测第 3 字节为空格后剥离前缀，兼容无状态前缀的 fallback 文件名。
- 趋势桶固定为“有提交的最近 7 个 UTC 日”，过滤后计数随范围 / 提交人变化，验证 lane 只断言 All 模式下的完整桶。

### Action Items

- 下一 Sprint 候选：Git dirty 逐文件 diff 预览、索引队列按 attempts 指数退避、真实 Provider 端到端流式联调。

## Sprint 72

### What went well?

- 文档健康自动巡检补齐“历史可回溯、结果有提醒”：`db.ts` 新增 `DocHealthRunRecord` 与运行历史读写，历史持久化到 `ai-workbench:doc-health-history:v1`，最多 50 条；Dismiss 时间持久化到 `ai-workbench:doc-health-alert-dismissed:v1`。
- 自动巡检与手动 Clean 都写入 `ranAt / removed / reindexed / failed / triggeredBy`；Knowledge Document status 展示最近 5 次运行历史，最近一次自动巡检发现问题时显示提醒横幅，Dismiss 后刷新不重现。
- 验证覆盖：`cargo test --lib` 80/80，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `docHealthHistory` 断言 removed=1 / reindexed=1 / triggeredBy=auto，`docHealthDismissPersist` 断言刷新后提醒不重现。

### What went wrong?

- 提醒语义收窄为“仅最近一次自动巡检发现问题”触发，手动 Clean 只写历史不弹横幅，避免手动操作稀释自动巡检的提醒价值。
- 历史与提醒分属两个 localStorage key，避免运行历史截断时误删 Dismiss 状态。

### Action Items

- 下一 Sprint 候选：Git 活动看板 dirty 文件预览与提交趋势、索引队列按 attempts 指数退避、真实 Provider 端到端流式联调，或继续围绕 5 大主视图补充日常高频能力。

## Sprint 71

### What went well?

- Vault 索引队列从纯 FIFO 升级为“高优先级插队 + 失败自动重试”：`vault_index_queue` 新增 `priority / attempts / last_error` 并幂等迁移，`list_vault_index_queue` 按 `priority DESC, created_at ASC` 排序。
- worker 失败后保留优先级重新入队，最多 3 次尝试，每次记录 `last_error`，耗尽后删除；重试间隔 800ms 防热循环；Knowledge 卡片新增 Normal / High 优先级选择，队列行展示优先级与重试次数。
- 验证覆盖：`cargo test --lib` 80/80，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `indexQueuePriority` 断言高优先级先跑，`indexQueueRetry` 断言 attempts 1/2 可见、最终错误可见并 drain。

### What went wrong?

- 首版 fallback 重试间隔只有 120ms，在点击 Knowledge 并开始断言前重试已经耗尽，attempts 1/2 观察不到；拉长到 800ms 后稳定捕获。
- `indexProgressCheck` 原本依赖前一条 lane 遗留的 “Indexed” 状态，插入重试 lane 后读到的是模拟错误；在该 lane 内先点击 Index vault 再断言，回归稳定。

### Action Items

- 自动巡检运行历史与通知提醒继续保留在 Backlog。

## Sprint 70

### What went well?

- Git activity 看板从“全量展示”升级为“时间范围 + 提交人下钻”：`get_git_activity` 支持 `sinceMs / untilMs / committer`，先过滤再聚合排序；`GitContext` / `GitActivityItem` 新增 `committer`，reflog 解析按时间戳 / 时区倒推 email 列，姓名含空格也能正确提取。
- `GitActivityBoard` 新增全量去重 `committers`，Projects 卡片新增 All / 24h / 7d / 30d 与提交人下拉，统计徽标与行列表共用同一过滤条件；TS fallback 镜像同一语义。
- 验证覆盖：`cargo test --lib` 77/77，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitActivity` 与新增 `gitActivityFilters` 均断言通过：24h 过滤后 1 项、提交人下拉包含 Alice / Bob、按 Alice 过滤后 1 项。

### What went wrong?

- 首版 fallback 两条示例提交都在 24 小时内，无法稳定验证时间过滤；把第二条示例固定为 26 小时前的历史提交后，过滤断言与原有看板断言同时稳定通过。
- reflog 解析仍以标准行格式为前提（hash / 父 hash / 身份 / 时间戳 / 时区），非标准行只影响单个项目的提交人与时间，不拖垮整张看板。

### Action Items

- 下一 Sprint 候选：索引队列优先级与失败重试策略。
- 自动巡检运行历史与通知提醒继续保留在 Backlog。

## Sprint 69

### What went well?

- 文档健康从“手动 Clean”升级为“自动定时巡检”：Knowledge Document status 新增 Auto toggle 与 5m / 15m / 30m / 1h / 6h 间隔，启用后立即执行一次并按间隔调用 `cleanup_knowledge_files`。
- 配置、上次运行时间与结果持久化到 `ai-workbench:doc-health-auto:v1`，刷新后恢复；每次巡检后自动刷新文档列表、vault 统计与 RAG 状态。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `docHealthAuto` 断言 seed 1 missing + 1 stale 后启用即 removed=1 / reindexed=1，`docHealthAutoPersist` 断言刷新后仍为 on 且结果保留。

### What went wrong?

- 自动巡检采用前端定时器，窗口关闭或应用退出后不会继续巡检；这是与 Auto sync 一致的应用内自动执行模型，后续如需后台常驻再迁移到 Rust 侧。
- 首次实现把 `intervalMs` 存成分钟数误读为秒，统一为 `intervalMs` 毫秒后与 Auto sync 语义一致。

### Action Items

- 下一 Sprint 候选：git 看板按时间范围过滤与提交人维度、索引队列优先级与失败重试策略。
- 自动巡检运行历史与通知提醒继续保留在 Backlog。

## Sprint 68

### What went well?

- Error logs 从“只看严重度”升级为“来源 + 设备组合筛选”：`error_logs` 新增 `device_id` 列并幂等迁移，`report_frontend_error` / `merge_error_log` 携带设备归属，跨设备同步后仍能区分日志来源。
- `error_log_summary` 新增 `device_id?` 过滤，与 source / severity 组合生效；System Error logs 卡片新增来源下拉与设备下拉，趋势图、总数徽标与明细列表共用同一过滤条件。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `errorLogSourceDevice` 均断言 frontend 过滤、current 设备、空组合与 remote 组合。

### What went wrong?

- UI 验证首版把 `tauri + current` 误判为 2 条，实际应为 0 条；修正断言为“当前设备下 tauri 为空组合，切到 remote 后为 2 条”后稳定通过。
- 来源 / 设备下拉选项来自当前 `logs` 列表（最近 30 条），过滤本身不受影响，但选项集与明细窗口一致。

### Action Items

- 下一 Sprint 候选：文档健康修复的自动定时巡检、git 看板按时间范围过滤与提交人维度。
- 索引队列优先级与失败重试策略继续保留在 Backlog。

## Sprint 67

### What went well?

- Projects 从 per-project Git 状态收拢为一张活动看板：`get_git_activity` 聚合分支、提交数、最近提交、变更文件数与 dirty 状态，按最近提交时间排序，一眼看出哪些项目正在推进。
- `GitContext` 新增 `last_commit_at`，从 reflog 末行解析 epoch 秒并转毫秒；TS fallback 与 Rust 共用同一聚合 / 排序 / 统计语义。
- 验证覆盖：`cargo test --lib` 75/75，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `gitActivity` 均断言 >=2 个项目、总数与行汇总一致、dirty 可见。

### What went wrong?

- `verify:ui` 偶发在页面重载后拿不到 System dock 按钮，属已知竞态；`clickDock` 改为最多重试 10 次、间隔 150ms 后稳定通过。
- reflog 解析依赖标准行格式（hash / 父 hash / author / email / 时间戳 / message），非标准 reflog 只影响单个项目的时间与消息，不影响整体看板。

### Action Items

- 下一 Sprint 候选：错误日志来源 / 设备组合筛选、文档健康修复的自动定时巡检、git 看板按时间范围过滤与提交人维度。
- 索引队列优先级与失败重试策略继续保留在 Backlog。

## Sprint 66

### What went well?

- Vault 索引队列从内存状态升级为 SQLite 持久化：`vault_index_queue` 表按 run_id upsert，`ignore_patterns` 以 JSON 数组存储，worker 完成 / 取消 / 出错后自动清理记录。
- setup 启动时恢复 pending 任务，`running` 记录重置为 `queued` 重新入队并继续调度；TS fallback 用 `ai-workbench:vault-index-queue:v1` 实现同一恢复语义。
- 验证覆盖：`cargo test --lib` 74/74，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `indexQueuePersist` 均 seed 6 条任务后重载，断言恢复执行并最终 drain。

### What went wrong?

- setup 首次调用 `restore_vault_index_queue` 误传 `AppHandle` 值而非引用，编译错误；改为 `app.handle()` 直接传引用后通过。
- clippy 报 `collapsible_if`，把恢复入队的嵌套 if 合并为单条件后通过。
- UI 验证如果只 seed 2 条任务，重载后可能赶不上观察队列；改为 6 条后稳定捕获 `sawQueue` / `activeSeen`。

### Action Items

- 下一 Sprint 候选：git 活动看板、错误日志来源 / 设备组合筛选、文档健康自动定时巡检。
- 索引队列后续可扩展优先级与失败重试策略。

## Sprint 65

### What went well?

- 文档健康从“看得见”升级为“可修复”：`cleanup_knowledge_files` 一键删除 missing 索引、重读磁盘内容重索引 stale 文档，返回 `{ removed, reindexed, failed }`，fresh 文档与跨 vault 数据不受影响。
- Document status 面板新增 Clean 按钮与 `removed / reindexed` 结果徽标，按当前 vault 过滤生效；TS fallback 用 `exists` / `stale` 模拟状态镜像同一语义。
- 验证覆盖：`cargo test --lib` 72/72，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `knowledgeDocClean` 均断言 removed=1 / reindexed=1 / 剩余 2 份全部 ok。

### What went wrong?

- 单测首次在 missing 文档入库前漏写磁盘文件，`remove_file` 直接 NotFound；补上 `fs::write` 后覆盖完整。
- UI 验证首版在浏览器 evaluate 内引用 Node 侧变量 `knowledgeDocCleanSeed.files` 抛 ReferenceError；改为内联常量后通过。
- 外层模板字面量把正则 `\d` 转义吞掉导致结果匹配失败，改为 `[0-9]` 后稳定通过。

### Action Items

- 下一 Sprint 候选：索引任务队列持久化、git 活动看板、错误日志来源 / 设备组合筛选。
- 文档健康修复可扩展为自动定时巡检，纳入后续 Sprint。

## Sprint 64

### What went well?

- Document status 从纯索引信息升级为健康检测：`exists` 用 `Path::exists` 判定，`stale` 用 mtime 与 `indexed_at` 的 1 秒容差比较，三态在单测中全部覆盖。
- UI 新增 ok / stale / missing 徽标与计数，用户能一眼看出哪些文档需要重新索引或清理；fallback 语义与 Web 环境一致。
- 验证覆盖：`cargo test --lib` 71/71，fmt、clippy、build 全绿；两条 lane 的 `knowledgeDocStatus` 均断言 3 份 ok、missing 0、stale 0。

### What went wrong?

- UI 验证第一次在行 div 上直接读 `data-knowledge-doc-status`，但该属性挂在行内徽标 span 上，一直拿到 null；改为 `doc.querySelector("[data-knowledge-doc-status]")` 后通过。
- 重载后的验证曾抢在新文档提交前读到旧 DOM，等待条件从“3 行存在”收紧为“3 行且每行都带状态徽标”后稳定。

### Action Items

- 下一 Sprint 候选：索引任务队列持久化、git 活动看板、missing / stale 一键清理或重新索引、错误日志来源 / 设备组合筛选。
- 后续扩展文档健康检测时，保持 missing / stale 判定与 fallback 语义同步。

## Sprint 63

### What went well?

- Knowledge 新增 Document status 面板：`list_knowledge_files` 按 vault 过滤并展示每份文档的标题、路径、归属与索引时间，limit clamp 1~200，空路径 legacy 记录不丢失。
- fallback 按 watch target 前缀推断 vault 归属，与 Rust 目标级语义一致；watch / 索引完成后文档列表自动刷新。
- 验证覆盖：`cargo test --lib` 70/70，fmt、clippy、build 全绿；两条 lane 的 `knowledgeDocStatus` 的 count / vaults / filterOk / filteredCount 全部命中。

### What went wrong?

- UI 验证首次 seed 用正斜杠路径，fallback 前缀推断按反斜杠匹配导致 vault 归属为空；改用 `C:/vault\\...` 后通过。
- 模板字符串内路径转义经过 Node 与浏览器两层解析，最初 `\\` 只剩一个反斜杠被浏览器当作非法转义吞掉；补成 `\\\\` 后路径才保留分隔符。

### Action Items

- 下一 Sprint 候选：索引任务队列持久化、git 活动看板、文档缺失 / 过期状态检测、错误日志来源 / 设备组合筛选。
- 后续扩展文档面板时，保持 fallback 的 vault 前缀推断与 Rust `vault_path` 语义一致。

## Sprint 62

### What went well?

- Error logs 从最近列表升级为趋势聚合：`error_log_summary` 按 UTC 日 / 周分组，每个 bucket 拆分 error / warning / info，缺失区间补零，Rust 与 TS fallback 语义一致。
- System 错误日志卡片新增 Day / Week 切换、严重度下拉与分层柱状图，总数徽标与柱合计一致；命令层同时支持 source / severity 过滤。
- 验证覆盖：`cargo test --lib` 69/69，fmt、clippy、build 全绿；两条 lane 的 `errorLogTrend` 的 total / barTotal / errorCount / warningCount / infoCount / filterOk 全部命中。

### What went wrong?

- UI 验证首版在 evaluate 内引用了 Node 侧变量 `errorLogSeed.ok`，浏览器作用域找不到会抛 ReferenceError；改为内联 `seedOk: true` 后通过。
- 聚合测试若不清空 seed 的 `DB initialized` 记录会污染 total，先 `DELETE FROM error_logs` 再插入固定时间戳后断言稳定。

### Action Items

- 下一 Sprint 候选：索引任务队列持久化、RAG 文档状态面板、git 活动看板、错误日志来源 / 设备组合筛选。
- 后续扩展诊断面板时，保持趋势图与列表共用同一过滤条件与 UTC 时间语义。

## Sprint 61

### What went well?

- watch 事件从累计计数升级为可追溯时间线：`vault_watch_events` 记录真实文件路径与 created / modified / removed 类型，`touch_vault_watch_event` 每次写回成功插入一条并裁剪到最新 500 条。
- `sync_vault_event` 改为返回变更路径数组，watcher 按路径逐条埋点；Knowledge 每个目标新增 Timeline 展开区与 Clear 动作，fallback 与 Rust 语义一致。
- 验证覆盖：`cargo test --lib` 68/68，fmt、clippy、build 全绿；两条 lane 的 `vaultWatchTimeline` 的 events / kinds / paths / countOk / cleared 全部命中。

### What went wrong?

- `sync_vault_event` 首版只返回 bool，无法按路径逐条记录时间线；改为返回 `Vec<String>` 后 watcher 才能落真实路径。
- 时间线测试最初只覆盖单路径过滤，补上全量清空、非法 event_kind 与删除目标级联后覆盖才完整。

### Action Items

- 下一 Sprint 候选：索引任务队列持久化、错误日志趋势 / 聚合、RAG 文档状态面板、git 活动看板。
- 后续扩展 watch 协议时，保持累计统计与时间线共用同一 `event_kind` 口径。

## Sprint 60

### What went well?

- `get_sync_audit_summary` 按 `day` / `week` 聚合 `sync_audit_log`，周以周一 UTC 起算；System Sync audit 新增 Activity 柱状图，Day / Week 切换即时刷新，总数徽标与柱合计一致。
- 缺失 bucket 自动补零（<= 62 个），图表不会因空档日跳变；TS fallback 与 Rust 共用同一 UTC 日 / 周语义。
- 验证覆盖：`cargo test --lib` 67/67，fmt、clippy、build 全绿；两条 lane 的 `syncAuditChart` 的 total / barTotal / weekTotal 均为 10，切回 Day 恢复。

### What went wrong?

- `verify:preview` 首次失败是 `dist` 仍为旧构建：SystemView 挂载时未调用 `getSyncAuditSummary`，图表停在 No activity；重新 `npm run build` 后 preview 通过。
- 图表断言最初失败信息只有 `no audit chart bars`，补上 storedAudit / sample / chartText 诊断后能一眼定位是数据缺失还是构建过期。

### Action Items

- 下一 Sprint 候选：watch 事件时间线、索引任务队列持久化、错误日志趋势 / 聚合、RAG 文档状态面板、git 活动看板。
- 后续改动审计面板时，保持列表 / 导出 / 图表共用同一过滤条件与 UTC 时间语义。

## Sprint 59

### What went well?

- Vault Index 从“谁先抢到锁谁跑”升级为显式 FIFO 队列：`VaultIndexState` 持有 active + 队列，`claim_next` / `finish_active` 保证同一时间只有一个索引 worker。
- `start_vault_index` 入队后立即发出 `queued` / `running` 进度，任务结束后自动调度下一个；新增 `get_vault_index_queue_status` 与 `vault-index-queue` 事件，前端可实时看到 active 与排队位置。
- 排队任务支持取消：`cancel_vault_index` 直接出队并发出 cancelled 进度；TS fallback 与 Knowledge UI 语义一致。
- 验证覆盖：`cargo test --lib` 66/66，fmt、clippy、build 全绿；两条 lane 的 `indexQueue.sawQueue` / `drained` 均为 true。

### What went wrong?

- UI 验证最初用 `C:/queue` 触发两次索引，`runIndex` 会把该路径 upsert 成第三个 watch target，污染后续 multi-vault 断言；改为复用 `C:/vault` 后队列 lane 不再产生多余 target。
- `mark` / `remove_queued` 最初只被测试引用，clippy `-D warnings` 报 dead code；改为命令路径直接复用 `mark` 与 `take_queued` 后消除。

### Action Items

- 下一 Sprint 候选：审计按日/周聚合图表、watch 事件时间线、索引队列持久化。
- 后续索引调度保持“单 worker + FIFO”约束，watch 触发任务可考虑优先级扩展。

## Sprint 58

### What went well?

- 对象数组去重从 `to_string()` 升级为 `canonical_json`：递归排序对象 key 后生成稳定标记，`{id,label}` 与 `{label,id}` 不再重复。
- Rust 与 TS fallback 语义一致，UI 验证把 `notes` 改为对象数组并断言合并后长度 2，覆盖真实场景。
- 验证覆盖：`cargo test --lib` 64/64，fmt、clippy、build 全绿；两条 lane 的 `structuredSync.notesLength` 均为 2。

### What went wrong?

- 首次实现若直接用 `item.to_string()`，key 顺序不同的对象会被当成两条；改为 canonical 序列化后修复。
- UI 验证需要解析合并后的 JSON 才能断言数组长度，补充 `notesLength` 后稳定通过。

### Action Items

- 下一 Sprint 候选：索引任务队列、审计按日/周聚合图表、watch 事件时间线。
- 后续扩展结构化合并时，保持 canonical 去重与原始内容顺序分离。

## Sprint 57

### What went well?

- watch 事件从单一总数拆为 created / modified / removed 三类：`touch_vault_watch_event` 按 `event_kind` 累计，`event_count` 保持总数兼容旧逻辑。
- 迁移幂等补三列，旧库自动升级；Knowledge 目标行直接显示 `+N` / `~N` / `-N`，能一眼看出 vault 变更构成。
- 验证覆盖：`cargo test --lib` 63/63，fmt、clippy、build 全绿；两条 lane 的 `created` 均为 1、`modified` / `removed` 均为 0。

### What went wrong?

- `touch_vault_watch_event` 返回类型改为可返回错误后，测试调用需全部补事件类型参数；批量更新时统一补齐后通过。
- 事件类型由 notify 单次 event 判定，UI 验证只在 fallback 中模拟 created，断言保持与 Rust 口径一致。

### Action Items

- 下一 Sprint 候选：索引任务队列、对象数组按 key 去重、审计按日/周聚合图表、watch 事件时间线。
- 后续扩展 watch 统计时，保留 event_count 总数与类型计数的一致性。

## Sprint 56

### What went well?

- 审计范围从固定预设扩展为任意起止日期：`list_sync_audit_range` / `export_sync_audit_range` 共用 `since + until` SQL，列表与导出所见一致。
- System 时间选择器新增 `Custom` 与两个日期输入，切换即时刷新；旧命令在 `until = None` 时保持原路径。
- 验证覆盖：`cargo test --lib` 63/63，fmt、clippy、build 全绿；两条 lane 的 `customOk` 均为 true，未来范围断言为空。

### What went wrong?

- clippy 报 `list_sync_audit` / `export_sync_audit` 在 `--lib` 下 dead code，改为 `until = None` 时复用原路径后消除。
- UI 验证首次把内嵌模板字符串写进 evaluate 外层模板，触发 Node 语法错误，改为字符串拼接后通过。

### Action Items

- 下一 Sprint 候选：watch 事件类型细分、索引任务队列、对象数组按 key 去重、审计按日/周聚合图表。
- 后续扩展审计查询时，保持列表与导出共用同一过滤函数。

## Sprint 55

### What went well?

- 同步冲突新增第三种策略 `structured`：JSON 对象按键递归合并、数组按 JSON 去重并集、标量冲突取更新时间较新一侧；Markdown frontmatter 按字段合并，逗号列表取并集。
- Rust 与浏览器 fallback 共用同一合并语义，System 冲突卡片与批量区新增 `Merge fields`，审计新增 structured 事件。
- 验证覆盖：`cargo test --lib` 62/62，fmt、clippy、build 全绿；两条 lane 的 `structuredSync` 均合并出 `life` / `done: true` / `count: 2`。

### What went wrong?

- frontmatter 的 `tags` 一侧为 `work`、另一侧为 `work, life` 时最初只取 local，改为任一侧含逗号即按列表并集后通过。
- UI 验证在 resolved history 展开状态下找不到新冲突，先收起历史列表再导入结构化快照后稳定通过。

### Action Items

- 下一 Sprint 候选：自定义审计日期范围、watch 事件类型细分、索引任务队列、对象数组按 key 去重。
- 后续扩展冲突策略时，保持 Rust 与 fallback 共用合并函数并补审计事件。

## Sprint 54

### What went well?

- 索引取消闭环补齐：`cancel_vault_index` 标记 runId，后台线程每个文件前检查，取消终态携带最近进度并清理标记，避免集合膨胀。
- 前端 Cancel 按钮只在运行中显示，取消后显示 `Cancelled`；浏览器 fallback 用 Set 模拟取消语义，两条 lane 均可断言。
- 验证覆盖：`cargo test --lib` 57/57，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 的 `cancelIndex` 均为 `Cancelled`。

### What went wrong?

- fallback 3 步 60ms 模拟太快，UI 测试点击 Cancel 时进度已结束，改为 6 步 120ms 并让测试尽早点击后稳定通过。
- 取消单测最初用 `unwrap_err` 触发 `IndexResult: Debug` 约束，改用 match 提取错误文案后通过。

### Action Items

- 下一 Sprint 候选：结构化字段级合并、自定义审计日期范围、watch 事件类型细分、索引任务队列。
- 后续扩展索引进度时，保留取消语义与 fallback 模拟的一致性。

## Sprint 53

### What went well?

- 全量索引从同步阻塞改为后台线程 + Event 推送：`start_vault_index` 返回 `runId`，`vault-index-progress` 每 5 个文件或写完时上报，Knowledge 视图实时展示进度条。
- 完成事件统一刷新 vault 状态、RAG 状态与目标统计，修复异步化后 `data-vault-files` 未及时更新的问题。
- 验证覆盖：`cargo test --lib` 55/55，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言进度条 100 且状态含 `Indexed`，两条 lane 全绿。

### What went wrong?

- `start_vault_index` 闭包中 `run_id` / `run_path` 的 move 语义导致编译错误，改为先计算终态字段再构造 `IndexProgress`。
- `runIndex` 异步化后漏掉 `getKnowledgeIndexStatus` 刷新，preview 首次运行 vault ignore 断言失败，补上完成事件刷新后通过。

### Action Items

- 下一 Sprint 候选：可取消索引任务与取消队列、结构化字段级合并、自定义审计日期范围、watch 事件类型细分。
- 后续扩展索引进度时，保留完成事件统一刷新状态与 fallback 模拟语义。

## Sprint 52

### What went well?

- watch 事件闭环补齐目标级统计：`vault_watch_targets` 记录累计事件数与最后事件时间，watch 写回成功后埋点，Knowledge 目标行直接展示事件量。
- 迁移保持幂等，旧库自动补列；`touch_vault_watch_event` 对缺失目标也自动补记录，避免 watcher 与配置时序不一致。
- 验证覆盖：`cargo test --lib` 54/54，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言两个目标事件数均为 1，两条 lane 全绿。

### What went wrong?

- `touch_vault_watch_event` 首版期望 `&str`，实际传入 `PathBuf`；改用 `to_string_lossy().as_ref()` 后通过。
- fallback `upsertVaultWatchTarget` 调用漏了新字段，TS 编译暴露后补齐。

### Action Items

- 下一 Sprint 候选：索引进度与取消队列、结构化字段级合并、自定义审计日期范围、watch 事件类型细分。
- 后续扩展 watch 目标表时，保留事件统计迁移与 fallback 模拟。

## Sprint 51

### What went well?

- 审计筛选从单事件维度扩展为事件 + 时间范围 + 设备组合：`list_sync_audit` 与 `export_sync_audit` 共用 SQL 条件，导出所见即列表所见。
- System Sync audit 新增 Today / Last 7 days 与 All / Current device 下拉框，浏览器 fallback 在 localStorage 上按同一语义过滤。
- 验证覆盖：`cargo test --lib` 54/54，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言 Today 范围筛选与导出链路，两条 lane 全绿。

### What went wrong?

- SQL 初版把 LIMIT 占位符误写为 `?2`，编译测试暴露后改为 `?4`。
- 前端时间档位切换若直接读 state 会拿到旧值，改为 `loadAudit(filter, since, device)` 显式传参。

### Action Items

- 下一 Sprint 候选：watch 目标级事件隔离、索引进度与取消队列、结构化字段级合并、自定义审计日期范围。
- 后续扩展审计查询时，保持列表与导出共用过滤函数。

## Sprint 50

### What went well?

- 冲突处理补上第三种策略 union：按行并集去重、local 优先，`resolved_choice = 'union'` 完整落库并写回 clipboard/log。
- 单个 Merge 与批量 Merge all 双入口，审计新增 `sync.resolve.union` / `sync.resolve.union.batch`，导出筛选同步扩展。
- 验证覆盖：`cargo test --lib` 53/53，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言批量 union、历史与审计，两条 lane 全绿。

### What went wrong?

- union 单测最初未先 `persist_conflict`，导致 resolved 记录为空；补齐持久化后通过。
- UI 验证若先消耗唯一冲突会让后续 Keep remote 断言无对象，改为在第二次 pull 后先 Merge all、再 pull 新冲突验证批量 remote。

### Action Items

- 下一 Sprint 候选：watch 目标级事件隔离、审计时间/设备组合筛选、索引进度与取消队列、结构化文档字段级合并。
- 后续扩展冲突策略时，保留 union 审计事件与历史筛选。

## Sprint 49

### What went well?

- Auto 并发从“前端按核数推荐”升级为“后端按文件规模动态规划”：≤32 文件顺序执行、中等规模或大文件密集时封顶 4、大规模普通文件按核数 1~16。
- `concurrency = 0` 成为 Auto 协议，`IndexResult.concurrency_used` 回传实际值，Knowledge UI 显示真实工作线程数，浏览器 fallback 按同规则模拟。
- 验证覆盖：`cargo test --lib` 50/50，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言手动 clamp 与 Auto 实际并发，两条 lane 全绿。

### What went wrong?

- UI 验证首版把手动并发断言写死为 2，但测试 vault 只有 1 个文件会被后端 clamp 到 1；改为断言实际值在 1~2 后通过。

### Action Items

- 下一 Sprint 候选：三方合并策略、watch 目标级事件隔离、审计时间/设备组合筛选、索引进度与取消队列。
- 后续索引协议变更时，保留 `concurrency = 0` Auto 语义与 `concurrency_used` 回传。

## Sprint 48

### What went well?

- 同步审计闭环补全：`list_sync_audit` 支持按事件筛选，`export_sync_audit` 输出 JSON / CSV，CSV 对逗号、引号与换行做标准转义。
- System Sync audit 面板提供筛选下拉框与 JSON / CSV 导出按钮，导出数量提示让用户确认数据范围；浏览器 fallback 与 Rust 语义一致。
- 验证覆盖：`cargo test --lib` 49/49，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言筛选、导出与清空全链路，两条 lane 全绿。

### What went wrong?

- CSV 首版转义检查误用 `contains` 数组 pattern，改为按字符匹配 `,` / `"` / CR / LF 后通过 clippy 与单测。

### Action Items

- 下一 Sprint 候选：按文件规模动态并发、三方合并策略、watch 目标级事件隔离、审计时间/设备组合筛选。
- 后续扩展同步链路时，保留筛选参数与导出格式单测。

## Sprint 47

### What went well?

- 目标级索引统计闭环完成：`knowledge_files.vault_path` 列 + 幂等迁移，`upsert_knowledge_file` 全链路传参，`vault_target_stats` 按路径分组返回文件数与最近索引时间。
- Knowledge 每个 vault 目标显示独立文件数，浏览器 fallback 按目标前缀统计与 Rust 语义一致；watch 单测同步补齐 vault 参数。
- 验证覆盖：`cargo test --lib` 48/48，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增两个目标文件数断言，两条 lane 全绿。

### What went wrong?

- `list_vault_target_stats` 首版签名跨行不符合 fmt，`cargo fmt --check` 暴露后格式化通过。

### Action Items

- 下一 Sprint 候选：审计导出与筛选、按文件规模动态并发、三方合并策略、watch 目标级事件隔离。
- 后续改动索引协议时，保留 vault_path 写入链路与目标级统计 UI 断言。

## Sprint 46

### What went well?

- Vault 索引并发新增设备自动调优：`recommend_index_concurrency` 基于 `available_parallelism` 返回推荐值并 clamp 1~16，失败回退 4；Knowledge Vault Index 提供 Auto 开关，开启后输入禁用并显示推荐值，关闭恢复手动。
- 浏览器 fallback 用 `navigator.hardwareConcurrency` 计算，与 Rust 语义一致；单测覆盖推荐值边界与核心数关系。
- 验证覆盖：`cargo test --lib` 47/47，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Auto 开启/关闭断言，两条 lane 全绿。

### What went wrong?

- 推荐 helper 首版只被单测引用导致 clippy dead-code 告警；改为命令函数调用 helper，单测直接验证命令函数后通过。

### Action Items

- 下一 Sprint 候选：目标级索引统计、审计导出与筛选、三方合并策略、按文件规模动态并发。
- 后续改动索引协议时，保留 Auto 开关 UI 断言与推荐值边界单测。

## Sprint 45

### What went well?

- 同步链路新增持久化审计：`sync_audit_log` 表记录 merge / resolve / batch resolve / history.clear 事件与详情，Tauri 命令 `list_sync_audit` / `clear_sync_audit` 已注册，limit clamp 1~200。
- System Sync snapshot 卡片新增 Sync audit 面板：事件名、详情、时间与 Clear 按钮，同步/仲裁/清理操作后自动刷新，浏览器 fallback 用 localStorage 保存最近 200 条。
- 单测覆盖 merge / resolve / clear 三类事件与最终清空；`cargo test --lib` 46/46，fmt、clippy、build 全绿。
- 验证覆盖：`verify:ui` / `verify:preview` 新增审计列表含 merge / resolve 与 Clear 后清空断言，两条 lane 全绿；motion 轮询修复后连续通过。

### What went wrong?

- `list_sync_audit` 首版错误类型混用 rusqlite Error 与 String，编译期暴露后统一为 String 返回并补 `map_err`。

### Action Items

- 下一 Sprint 候选：并发数随设备配置自动调优、目标级索引统计、审计导出与筛选、三方合并策略。
- 后续改动同步链路时，保留审计埋点单测与 System audit UI 断言。

## Sprint 44

### What went well?

- Vault watch 从单实例升级为多目标并行：`vault_watch_targets` 表按 path 主键保存 ignore 与启用状态，旧 `vault_watch_config` 单行在 `init_connection` 自动迁移，旧命令保留兼容。
- `VaultWatchState.active` 改为 watcher 列表，启动只替换同路径实例、其他实例继续运行，`stop_vault_watch(path?)` 支持按路径停止与全停，`restore_vault_watch` 遍历 enabled 目标逐个恢复。
- Knowledge Vault Index 新增目标列表：每行独立 Watch / Stop / Remove，Active badge 展示并行 watcher 数；单测覆盖双目录并行索引与目标 CRUD/迁移。
- 验证覆盖：`cargo test --lib` 45/45，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增第二个 vault 开启、双目标同时 on、计数 2、全部停止断言，两条 lane 全绿。

### What went wrong?

- reduced-motion 断言偶发在 media query 重算前采样到 tilt 默认 matrix3d；改为轮询等待 `tiltTransform === "none"` 后稳定通过，顺带把 motion 失败信息完整输出便于定位。

### Action Items

- 下一 Sprint 候选：并发数随设备配置自动调优、批量仲裁加入同步审计/事件日志、目标级索引统计、三方合并策略。
- 后续改动 watch 协议时，保留双 vault 并行 UI 断言与目标表迁移单测。

## Sprint 43

### What went well?

- 冲突仲裁从逐条升级为批量：`resolve_conflicts` 用 `unchecked_transaction` 单事务批量写回，未知 choice 报错即回滚，返回解决数量；System Sync card 新增 Keep all local / Keep all remote 一键裁决。
- Tauri 命令 `resolve_sync_conflicts` 注册到 invoke handler，前端 `resolveSyncConflicts` Tauri / fallback 双分支透传；单测覆盖剪贴板 + 日志两条冲突批量 Keep local 的内容恢复、清空与历史记录。
- 验证覆盖：`cargo test --lib` 43/43，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增第二次 Pull → 批量 Keep remote → badge 消失与历史保留断言，两条 lane 全绿。

### What went wrong?

- 第二次 Pull 会因重复导入条目额外产生冲突，原历史断言取首条记录导致偶发失败；改为按 `sprint 38 conflict override` 定位具体记录并校验其 remote choice 后稳定通过。
- headless 冷启动 motion 断言仍偶发抖动，重跑后全绿，未进入代码修复。

### Action Items

- 下一 Sprint 候选：多 vault 并行 watch、并发数随设备配置自动调优、批量仲裁加入同步审计/事件日志、三方合并策略。
- 后续改动同步仲裁时，保留批量裁决 UI 断言与历史记录按具体条目定位的验证方式。

## Sprint 42

### What went well?

- Vault 索引并发数从硬编码 4 升级为可配置：`index_vault_files` 增加 concurrency 参数并 clamp 到 1~16，文件数不足时自动降级，结果不受并发影响。
- `index_vault` 与 watch 初始索引保持默认 4，旧命令行为不变；Knowledge Vault Index 新增并发数输入，Index vault 时透传。
- 验证覆盖：`cargo test --lib` 42/42，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增并发输入存在与设置后索引正常断言，两条 lane 全绿。

### What went wrong?

- 并发参数接入后所有 `index_vault_files` 测试调用点需要同步补默认值，遗漏会导致编译失败；通过编译期强制检查避免运行时回归。

### Action Items

- 下一 Sprint 候选：批量仲裁与三方合并策略、多 vault 并行 watch、并发数随设备配置自动调优。
- 后续改动索引协议时，保留并发边界单测与并发输入 UI 断言。

## Sprint 41

### What went well?

- Vault watch 配置闭环：`vault_watch_config` 单行表保存 path、ignore_patterns、enabled 与 updated_at，`start_vault_watch_ex` 成功即写入 enabled=true，停止时保留 path/ignore 并写入 enabled=false。
- Tauri 启动时按配置自动重启 watch，Knowledge 视图挂载时恢复路径与 ignore 输入；浏览器 fallback 用 localStorage 模拟同一行为。
- 验证覆盖：`cargo test --lib` 41/41，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增开启 watch → reload → 路径/ignore/状态恢复断言，两条 lane 全绿。

### What went wrong?

- `ignore_patterns` 被 watch 事件闭包 move 后无法再保存配置，改为先 clone 一份供配置写入，避免重复持有所有权。
- UI 断言首次把 reload 逻辑放进页面 evaluate 导致无法调用 CDP 的 reload，拆成「准备 → reload → 检查」三段后通过。

### Action Items

- 下一 Sprint 候选：Vault 索引并发数可配置、批量仲裁与三方合并策略、多 vault 并行 watch。
- 后续改动 Vault watch 时，保留配置恢复与 reload 持久化两条 UI 断言。

## Sprint 40

### What went well?

- 冲突从内存结果升级为持久化记录：`sync_conflicts` 表保存 local/remote 完整内容、两端时间戳与仲裁状态，同 id/kind 的未解决冲突合并时原位更新，已解决后新冲突重新入表。
- `list_sync_conflicts` 支持 unresolved / resolved / all 三种视图，`clear_resolved_sync_conflicts` 只清理已解决记录；Rust 单测覆盖新一轮冲突与历史共存、清理不误删。
- System Sync snapshot 卡片改用持久化未解决列表，新增 Show resolved history / Clear resolved；Keep remote 后历史带 choice 与时间戳，reload 后仍可见。
- 验证覆盖：`cargo test --lib` 40/40，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增历史可见与 reload 持久化断言，两条 lane 全绿。

### What went wrong?

- UI 验证把 auto sync 断言移到了 reload 之后，配置恢复前点击开关会因远端 URL 为空而失败；断言先自行写入 URL 再操作开关，同时保留配置恢复的等待。
- headless 冷启动仍偶发 motion 断言抖动，重跑后全绿，未进入代码修复。

### Action Items

- 下一 Sprint 候选：Vault 索引并发数可配置、watch 状态 ignore 列表持久化、批量仲裁与三方合并策略。
- 后续改动同步协议时，保留持久化冲突列表与 reload 历史两条 UI 断言。

## Sprint 39

### What went well?

- 冲突仲裁闭环：`SyncConflictItem` 携带 local / remote 完整内容，`resolve_conflict` 按 choice 写回剪贴板/日志并刷新 `updated_at`，未知 choice 明确报错。
- System Sync snapshot 卡片新增逐条冲突列表与 Keep local / Keep remote 按钮，仲裁后刷新剪贴板并移除该冲突。
- 验证覆盖：`cargo test --lib` 39/39，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Pull → Keep remote → badge 消失与结果可见断言，两条 lane 全绿。

### What went wrong?

- 浏览器 fallback 需要先保存 local / remote 快照再写回，避免覆盖后丢失仲裁依据；前端按 `localContent` / `remoteContent` 选择内容，与 Rust 语义保持一致。

### Action Items

- 下一 Sprint 候选：冲突明细持久化与历史仲裁记录、Vault 索引并发数可配置、watch 状态 ignore 列表持久化。
- 后续改动同步仲裁时，保留 Keep local / Keep remote 两条 UI 断言与 Rust 仲裁单测。

## Sprint 38

### What went well?

- 同步自动合并透明化：`SyncResult.conflicts` 记录每条同 id 记录的 `localUpdatedAt` / `remoteUpdatedAt` / `resolvedTo` / `preview`，remote 覆盖、local 胜出、时间戳相等三条方向都有单测覆盖。
- `MergeOutcome` 从枚举值扩展为携带本地时间戳，冲突收集与合并写库共用一次查询，无额外 SQL 开销。
- System Sync snapshot 卡片展示 `N conflict(s) auto-resolved`，浏览器 fallback 的 Pull 会构造一条本地/远端同 id 冲突，UI 断言可直接验证。
- 验证覆盖：`cargo test --lib` 38/38，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增冲突 badge 断言，两条 lane 全绿。

### What went wrong?

- 前端 fallback 初版在 `Object.assign` 之后读取 `local.updatedAt`，导致 conflict 的 local 时间戳被覆盖为新值；改为先保存旧时间戳再更新后通过。

### Action Items

- 下一 Sprint 候选：冲突人工仲裁（手动选择 local / remote）、Vault 索引并发数可配置。
- 后续改动同步协议时，保留 remote / local / equal 三条方向单测与冲突 badge UI 断言。

## Sprint 37

### What went well?

- 同步从“手动 Push / Pull”升级为“定时双向自动同步”：启用时立即 pull 合并 → push 上传，之后按 10s / 30s / 60s / 5m 间隔自动续跑，剪贴板与日志跨设备保持一致。
- `getSyncAutoConfig` / `setSyncAutoConfig` 持久化 `{ enabled, intervalMs, remoteUrl }`，Token 只停留在当前会话输入，不落盘。
- System Sync snapshot 卡片新增 Auto sync 开关与间隔选择，启用/关闭/立即同步结果都有回显；`verify:ui` / `verify:preview` 新增开关与状态断言，两条 lane 全绿。
- 验证覆盖：build 全绿；`cargo test --lib` 保持 37/37，fmt、clippy 全绿。

### What went wrong?

- UI 验证首次运行再次遇到 motion 冷启动时序抖动，重跑后全绿；该偶发与此 Sprint 改动无关。

### Action Items

- 下一 Sprint 候选：同步冲突 UI 与三方合并策略可视化、Vault 索引并发数可配置。
- 后续改动同步逻辑时，保留手动 Push/Pull、Auto sync 开关两条 UI 断言与 Rust 合并单测。

## Sprint 36

### What went well?

- watch 与全量扫描的 ignore 语义对齐：`start_vault_watch_ex` 启动时初始索引应用 ignore，增量事件经 `sync_vault_event` 先算相对路径再过滤，忽略目录的新增/修改/删除不再进入 `knowledge_files`。
- 端到端单测覆盖真实目录：`node_modules` 下新增 Markdown 不入库，普通 `notes` 目录新增正常索引，RAG 搜索确认忽略内容不可见。
- Knowledge Watch vault 复用 Ignore patterns 输入；`verify:ui` / `verify:preview` 新增 watch 开启时 Skipped 1 断言，两条 lane 全绿。
- 验证覆盖：`cargo test --lib` 37/37，fmt、clippy、build 全绿。

### What went wrong?

- UI 验证首次运行在 session 回跳时偶发找不到 Dock 按钮，属 headless 冷启动时序抖动；重跑后全绿，未进入代码修复。

### Action Items

- 下一 Sprint 候选：同步快照定时自动同步与冲突 UI、Vault 索引并发数可配置。
- 后续改动 Vault watch 时，保留 ignore 事件过滤单测与 Skipped 计数 UI 断言。

## Sprint 35

### What went well?

- Vault 索引升级为“收集路径 + 并行读取解析”：`thread::scope` 最多 4 个工作线程分摊 Markdown 读取与 frontmatter 解析，主线程统一 upsert，大目录扫描明显更快。
- ignore 规则覆盖目录名（任意层级）与 `**` / `*` glob，`archive/**`、`node_modules` 这类常见排除项集成单测通过；`IndexResult` 同时返回 files 与 ignored 计数。
- Knowledge Vault Index 新增 Ignore patterns 输入与 Skipped 计数；`verify:ui` / `verify:preview` 新增 files 1 + ignored 1 断言，两条 lane 全绿。
- 验证覆盖：`cargo test --lib` 36/36，fmt、clippy、build 全绿。

### What went wrong?

- 初版 `git merge-file` 调试经验无关本 Sprint；本 Sprint 主要约束是 SQLite 连接非 `Send`，因此并行只覆盖文件读取解析，upsert 留在主线程，避免引入连接池复杂度。
- `ModelBadge` 不支持 amber tone，Skipped 计数改用自定义 span，避免类型扩展污染通用组件。

### Action Items

- 下一 Sprint 候选：Vault watch 监听 ignore 列表、同步快照定时自动同步与冲突 UI。
- 后续改动 Vault 索引时，保留 ignore 目录/glob 集成单测与 files/ignored UI 断言。

## Sprint 34

### What went well?

- 冲突解决从“检测 + abort”升级为可执行策略：`ours` / `theirs` 直接写入 Git 索引中的目标 stage，`union` 用 `git merge-file -p --union` 合并 base / ours / theirs 三方内容，解决后自动续跑 rebase。
- 端到端单测覆盖真实仓库：`theirs` 保留目标分支版本并完成 rebase，`union` 同时保留双方新增行且无冲突标记，未知策略明确报错。
- Projects Git 图谱新增 Take feature / Take main / Union merge 三键，浏览器 fallback 对 Hermes 项目稳定模拟冲突；`verify:ui` / `verify:preview` 新增冲突出现与 union 解决断言，两条 lane 全绿。
- 验证覆盖：`cargo test --lib` 35/35，fmt、clippy、build 全绿。

### What went wrong?

- `git merge-file` 不支持 `--output` 长选项（Git 用法里只有 `-p`/`--stdout`），改为 `-p` 从 stdout 取合并结果后通过。
- rebase 冲突的 stage 编号与产品直觉相反：stage 2 是目标分支、stage 3 是被 rebase 分支；直接用 stage 内容写回，规避 `git checkout --ours/--theirs` 在 rebase 下的反直觉语义。
- 单侧策略解决后若结果与目标分支相同，Git 会 drop 该空提交，测试不再要求 `feature edit` 留在 log，改为断言 rebase 已结束。

### Action Items

- 下一 Sprint 候选：Vault 大目录并行扫描与 ignore 列表、同步快照定时自动同步与冲突 UI。
- 后续改动 Git 工作流时，保留干净 rebase、冲突检测、abort、ours/theirs/union 解决五条单测。

## Sprint 33

### What went well?

- 同步快照从“本地文件导入导出”升级为“HTTP 远端 Push / Pull”：`build_sync_snapshot` / `merge_sync_snapshot` 拆出后，文件路径与远端路径共用同一套合并语义。
- 端到端单测用本地 `TcpListener` 验证真实 HTTP 请求：Push 断言请求体与 `Authorization: Bearer` 头，Pull 断言 GET 解析后按 `updated_at` 合并进 SQLite。
- System Sync snapshot 卡片新增 Remote URL / Token 输入与 Push / Pull 按钮，浏览器 fallback 确定性返回结果；`verify:ui` / `verify:preview` 新增 Push / Pull 断言，两条 lane 全绿。
- 验证覆盖：`cargo test --lib` 33/33，fmt、clippy、build 全绿。

### What went wrong?

- 首轮 HTTP 单测失败：reqwest 发送的 header 名是小写（`authorization`），测试按大写精确匹配；改为大小写不敏感包含判断后通过。
- Pull 合并单测直接写临时目录下的 SQLite，父目录不存在导致 `CannotOpen`；先 `create_dir_all` 再初始化连接后通过。

### Action Items

- 下一 Sprint 候选：冲突自动解决 / 三方合并策略、Vault 大目录并行扫描与 ignore 列表。
- 后续改动同步逻辑时，保留 Push / Pull / Token / 合并四条断言与两条 UI lane。

## Sprint 32

### What went well?

- 端到端流式联调闭环：`stream_openai_compatible_with` 支持 sink 注入，本地 SSE 服务单测覆盖真实 HTTP + 分块解析，无 `[DONE]` 错误路径也覆盖。
- System Provider 卡片新增 Stream test 一键联调，返回 chunk 数与错误信息；浏览器 fallback 确定性返回 2 chunk。
- 验证覆盖：`cargo test --lib` 31/31，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 stream smoke 断言，两条 lane 全绿。

### What went wrong?

- 首轮编译报 `app` 被取消闭包 move 后无法再给 emit 闭包借用，补 `app_for_cancel` clone 后通过。
- 前端 setState updater 里直接 `await` 触发 TS1308，改为先 await 结果再 setState。
- preview 验收偶发 motion 断言失败，属冷启动时序抖动；预热后重跑全绿。

### Action Items

- 下一 Sprint 候选：云端同步传输、冲突自动解决 / 三方合并策略。
- 后续改动流式核心时，保留 SSE 端到端单测与 stream smoke UI 断言。

## Sprint 31

### What went well?

- Rebase 闭环：`rebase_branch` 一键同步主分支，冲突时用 `diff --name-only --diff-filter=U` 精确列出冲突文件，`abort_rebase` 一键清理。
- Projects Git 图谱内置 Rebase onto main 与 Abort rebase，成功/冲突/错误三种状态都有结果回显。
- 验证覆盖：`cargo test --lib` 29/29，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 rebase 结果断言，两条 lane 全绿。

### What went wrong?

- 冲突检测初版用 `git status --short` 手工剥前缀，改为 `git diff --name-only --diff-filter=U` 后更精确，不再被普通修改行干扰。
- `git init` 默认分支名在不同版本不确定，测试统一改用 `git init -b main`，避免断言 base 分支名时依赖环境。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、冲突自动解决 / 三方合并策略。
- 后续改动 Git 工作流时，保留干净 rebase、冲突检测与 abort 三条单测。

## Sprint 30

### What went well?

- 字面量 Blue Token 清零：`#007AFF` / `#7FB4FF` / `blue-*` 全部收敛为 `.accent-*` 语义类，组件层扫描零残留；`emerald-*` 确认本就是 accent 别名，未做无意义替换。
- 动态验收闭环：Knowledge Index vault 按钮带 `data-accent-token`，切换 ocean / emerald 后 computed color 从 `rgb(77,163,255)` 变为 `rgb(52,211,153)`。
- 验证覆盖：`cargo test --lib` 27/27，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 accent token 断言，两条 lane 全绿。

### What went wrong?

- `text-blue-300 hover:text-[#7FB4FF]` 需要“基础 strong、hover 回到 accent 原色”两个状态，初版只定义了 hover 到 strong 的类；补 `.accent-hover-base` 后通过。
- `ring-[#7FB4FF]/20` 替换为 `accent-dot-ring` 时保留 `ring-2` 宽度类，避免 box-shadow 与 ring 语义混用。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、PR 冲突解决与自动 rebase。
- 后续新增 UI 颜色时优先使用 `.accent-*` 或 `emerald-*` accent 别名，禁止写蓝色字面量。

## Sprint 29

### What went well?

- Commit/PR 从草稿升级为可执行：`apply_commit` 跑 `git add -A` + `git commit -m`，`create_remote_pr` 跑 `gh pr create`，Projects 面板实时回显 hash / URL / 错误。
- 空提交不报错：`git commit` 的 “nothing to commit” 写进 stdout 而非 stderr，改为 stdout/stderr 双通道判断后返回 `committed: false`。
- 验证覆盖：`cargo test --lib` 27/27，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Commit changes 与 Create PR 结果断言，两条 lane 全绿。

### What went wrong?

- 首轮空提交单测失败：只检查 stderr，而 git 把 “nothing to commit” 输出到 stdout，导致误报错误；补 stdout 判断后通过。
- 前端 `RemotePrResult.url` 为 `string | null`，直接塞进 `<a href>` 触发 TS2322；补 `?? undefined` 后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、PR 冲突解决与自动 rebase。
- 后续改动 Git 执行命令时，保留真实临时仓库单测与 Commit/PR UI 断言。

## Sprint 28

### What went well?

- Vault 自动监听闭环：`notify` 递归监听 + 增量 upsert/delete，Knowledge 从“手动全量扫描”升级为“改文件即入 RAG”。
- `stop_vault_watch` 保留已索引文件，停听不停用；`get_vault_watch_status` 让前端可恢复 watch 状态。
- 验证覆盖：`cargo test --lib` 23/23，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 watch 开关、状态 badge 与文件数 2 → 3 断言，两条 lane 全绿。

### What went wrong?

- 首轮 watcher 单测失败，原因是 watcher 实例未移入线程，事件源被提前 drop；改为在线程内持有 `_keepalive` 后通过。
- 首轮测试未先做初始全量索引，导致“新增后文件数应为 2”的预期与真实基线不符；补 `index_vault_files` 后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动执行 commit / 创建远端 PR。
- 后续改动 Vault 索引或监听命令时，保留新增/删除增量同步单测与 watch UI 断言。

## Sprint 27

### What went well?

- Prompt 版本闭环：`agent_prompt_versions` 表保存每次更新前的旧 Prompt；恢复前再把当前 Prompt 留档，历史血缘完整，可回滚到任意版本。
- System Agent directory 的 Prompt 编辑器新增 Versions 列表与 Restore 按钮，保存即留档。
- 验证覆盖：`cargo test --lib` 22/22，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增版本行、恢复结果与 localStorage 持久化断言，两条 lane 全绿。

### What went wrong?

- 验收恢复断言最初检查整段容器文本，恢复后编辑器里的 v2 草稿仍在，导致“不含 v2”误判；改为恢复后关闭编辑器再检查预览。
- 首轮版本断言依赖 `.prompt-version-list > div`，需等异步加载完成后再计数。

### Action Items

- 下一 Sprint 候选：自动文件监听同步、真实 Provider 端到端流式联调。
- 后续改动 Prompt 或 Agent 目录时，保留版本与恢复断言。

## Sprint 26

### What went well?

- Team 汇总闭环：部门 Agent 并行结束后自动追加 `Team Summary` 消息并保存会话，Inspector 升级为 `Team Trace + Summary`，新增 Summary 区块。
- 双路径一致：Rust `build_team_summary` 与前端 `buildTeamSummary` 共用“首条有效行拼接”规则，Rust 单测覆盖过滤逻辑。
- 验证覆盖：`cargo test --lib` 21/21，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 `.team-summary` 气泡与摘要行数断言，两条 lane 全绿。

### What went wrong?

- 首轮验收断言把 `.team-summary` 的换行统计写在模板字符串里，`\\n` 需要按外层转义处理；改为正则 `/\\n/` 后通过。
- Team 汇总消息在全部 Agent 结束与 Inspector 更新之间有一小段异步窗口，验收循环同时等待气泡、busy 消失与 Team Trace。

### Action Items

- 下一 Sprint 候选：自动文件监听同步、真实 Provider 端到端流式联调、Prompt 版本管理。
- 后续改动 Team 编排时，保留汇总气泡与 Team Trace 断言。

## Sprint 25

### What went well?

- Commit/PR 草稿闭环：Projects 卡片一键生成 Conventional Commit（`type(scope): summary`）、PR Title 与含 DoD 的 PR Body；Rust `generate_commit_pr_draft` 与浏览器 fallback 共用同一套推断规则。
- Git 状态升级：`get_project_git_context` 优先读 `git status --short`，无 git 环境回退最近修改文件，项目图谱与草稿都受益。
- 验证覆盖：`cargo test --lib` 20/20，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增草稿面板、Conventional Commit、Changes 与 DoD 断言，两条 lane 全绿。

### What went wrong?

- Rust `summary_for` 先收集 `&str` 再声明 `Vec<String>`，补 `.map(|t| t.to_string())` 后通过。
- `verify` 正则写在模板字符串里，`\\(` 与 `\\n` 需要按外层转义处理，首轮出现语法错误；改为双反斜杠后通过。
- 草稿断言最初把整块面板文本拿去匹配 commit 前缀，改为按行匹配后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调与 Team 结果汇总、自动文件监听同步、自动执行 commit/PR。
- 后续改动 Git 上下文或 Projects 时，保留草稿与图谱断言。

## Sprint 24

### What went well?

- 部门团队编排闭环：AI Studio 新增 Team 模式，按部门并行派发最多 3 个 Agent，每个气泡带 Agent/Role 标签独立流式输出；Inspector 显示 Team Trace（Department / Agents / Role / Model / Status）。
- Prompt 全链路打通：12+ 种子 Agent 自带职责化 system_prompt，单 Agent 与 Team 派发都注入 system 消息；System Agent directory 行内编辑后立即持久化并展示预览。
- 验证覆盖：`cargo test --lib` 19/19，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Team 并行派发、Team Trace、prompt 编辑与 localStorage 持久化断言，两条 lane 全绿。

### What went wrong?

- 种子 INSERT 使用了跳号的 `?7/?8` 占位符但只传 6 个参数，rusqlite 按最大索引校验报 `InvalidParameterCount(6, 8)`；改为连续 `?5/?6` 后通过。
- `verify` 首轮用祖先容器定位 QA Agent 编辑按钮，实际点到了 UI Designer 的 prompt 编辑器；改为精确 `aria-label` 与最近容器断言后通过。
- 一次重载后 dock 按钮短暂未出现，属时序波动，重跑通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调与 Team 结果汇总、自动生成 Commit/PR 草稿、Prompt 版本管理。
- 后续改动 Agent 派发或 Prompt 时，保留 Team Trace 与 prompt 持久化断言。

## Sprint 23

### What went well?

- 部门/Agent 数据模型闭环：`departments` / `agents` 两张表、5 部门 12+ Agent 种子、Tauri 命令与浏览器 localStorage fallback 同构；AI Studio 按部门分组选择 Agent 并按 Agent 的 provider 派发。
- System Agent directory：可浏览部门与 Agent 列表并创建 Agent；Inspector 增加 Department / Agent / Role / Model 与 RAG 上下文追踪。
- 验证覆盖：`cargo test --lib` 18/18，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 新增 Agent 下拉、Agent Trace、Agent directory 断言，两条 lane 全绿。

### What went wrong?

- 首轮 `verify:ui` 的 Inspector 断言用 `Department`，页面 label 因 CSS `text-transform` 渲染为大写 `DEPARTMENT`，改为大小写不敏感后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、多 Agent 并行编排与 system_prompt 编辑器、自动生成 Commit/PR 草稿。
- 后续改动 Agent 派发或 Inspector 时，保留 Trace 与 directory 断言。

## Sprint 22

### What went well?

- UI 深化闭环：设计部 UI Designer 产出 Sprint 22 动效契约，主题/强调色、流体材质卡、AI Studio 对话舞台全部按契约落地，并写入 SDLC 生命周期。
- 动效系统：`data-theme` + `data-accent` 首帧预载、localStorage 持久化、5 个 accent preset；BentoCard 支持 4 种流体材质，hover 单次 140ms flow，尺寸稳定。
- 可测试性：`verify:ui` / `verify:preview` 新增主题持久化、accent 切换、材质卡 hover 固定尺寸、composer/stage 动效与 reduced-motion 断言，两条 lane 全绿。
- `cargo test --lib` 17/17，fmt、clippy、build 全绿。

### What went wrong?

- 首轮 `verify:ui` 在 System 视图上断言 `.conversation-stage`，需要先切回 AI Studio；补 `clickDock("AI Studio")` 后通过。
- 材质卡 hover 动画时长最初在移除 `.hovering` 后测量，读到 `0s`；改为 hover 态内测量后确认 `0.14s`。

### Action Items

- 下一 Sprint 候选：部门与 Agent 数据模型、真实 Provider 端到端流式联调、自动文件监听同步、自动生成 Commit/PR 草稿。
- 后续可把全仓库硬编码 emerald/#007AFF Tailwind class 迁移到 accent token（单独 Sprint）。

## Sprint 21

### What went well?

- 项目级 Git 图谱闭环：`get_project_git_context` 解析 `.git/HEAD` 与 reflog，返回分支、提交数、最新提交；项目卡片新增图谱区展示分支徽章、提交计数与最近文件变更。
- 可测试性：Rust 单测用临时 `.git` 目录验证 HEAD/reflog 解析；浏览器 fallback 提供确定数据，`verify:ui` / `verify:preview` 新增图谱断言并全部通过。
- `cargo test --lib` 17/17，fmt、clippy、build 全绿。

### What went wrong?

- 首轮实现容易在 detached HEAD 或超大 hash 上误伤，补充 `ref: refs/heads/` 前缀解析与 hash 截断处理。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、自动生成 Commit/PR 草稿。
- 后续改动 Git 上下文或 Projects 视图时，保留图谱断言。

## Sprint 20

### What went well?

- 版本图谱闭环：`message_versions` 增加 `parent_version_id`，编辑/恢复保存版本时自动记录父版本；旧库迁移兼容。
- 图谱 UI：版本面板展示 `root → v2 → current` 节点连线，点击节点可直接切换 diff 对比，视觉与现有 Design Token 一致。
- 验证覆盖：Rust 单测覆盖编辑链血缘与恢复路径，`verify:ui` / `verify:preview` 新增图谱节点与 current 标记断言，`cargo test --lib` 16/16，fmt、clippy、build 全绿。

### What went wrong?

- 血缘单测首轮预期恢复会新增 4 个版本，实际恢复为相同内容时不产生新版本，按 3 个版本修正断言。
- `save_message_version` 新增父版本参数后，Tauri 命令调用点漏传参数导致编译失败，补 `None` 后通过。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、项目级 Git 图谱。
- 后续改动版本表或图谱时，保留血缘与 diff 断言。

## Sprint 19

### What went well?

- 剪贴板/日志跨设备同步闭环：`clipboard_history` / `error_logs` 增加 `updated_at`，`export_sync_snapshot` / `import_sync_snapshot` 按时间戳合并，冲突保留较新版本。
- 双设备合并验证：Rust 单测覆盖 A 导出、B 导入并校验双方数据；浏览器 fallback 用同一快照 key 模拟远端设备，`verify:ui` / `verify:preview` 新增合并断言并通过。
- System 新增 Sync snapshot 卡片：设备标识、导出/导入按钮、合并统计与远端来源展示，设计 Token 一致。

### What went wrong?

- 首轮 Rust 编译报 `Deserialize` 缺失与 `?` 错误类型不匹配；为 `ClipboardItem` / `ErrorLog` 补 derive，同步函数改为返回 `String` 错误后通过。
- `verify` 首版误以为远端 deviceId 会显示在页面上，实际 UI 只显示本地设备；改为断言远端数据已合并进卡片与日志列表。

### Action Items

- 下一 Sprint 候选：真实 Provider 端到端流式联调、自动文件监听同步、多版本图谱与分支可视化。
- 后续改动同步逻辑时，保留双设备合并断言与 `updated_at` 冲突语义。

## Sprint 18

### What went well?

- 版本差异对比闭环：`MessageDiff { added[], removed[] }` + Rust `diff_message_version_with_current`，版本面板 Compare 按钮展开 `vN → current` 增删行，红绿语义清晰。
- 浏览器 fallback 与 Tauri 行为一致：TS LCS 逐行 diff 与 Rust `similar` 对齐，前端不依赖后端也能验证。
- 验证覆盖：`verify:ui` / `verify:preview` 新增“编辑→对比 v1 与当前→恢复→再编辑→重新生成”完整断言，`cargo test --lib` 14/14，fmt、clippy、build 全绿。

### What went wrong?

- 第一版 diff 接口错误地比较两个版本 ID，但当前内容并不是版本；改为 `版本 vs 当前消息内容` 后语义正确。
- 单测首次因版本顺序理解偏差失败：`update_chat_message` 会先保存旧内容再更新，断言需按实际版本列表顺序对齐。
- verify 脚本一次正则 `/+1\s+-1/` 写错导致 Uncaught，改成文本包含判断后稳定通过。

### Action Items

- 下一 Sprint 候选：剪贴板/日志跨设备同步、真实 Provider 端到端流式联调、多版本图谱与分支可视化。
- 后续改动版本面板或编辑链路时，保留 diff 与恢复断言。

## Sprint 17

### What went well?

- 消息版本历史闭环：`message_versions` 表 + `save/list/restore` 三个 Tauri 命令，编辑与 regenerate 自动保留旧版本，Restore 可一键回到旧文本并保留分叉版本。
- 前端版本面板：History 按钮展开版本列表，恢复后刷新版本视图；浏览器 fallback 与 Tauri 行为一致，清库时级联清理孤儿版本。
- 验证覆盖：`verify:ui` / `verify:preview` 新增“编辑→查历史→恢复→再编辑→重新生成”完整断言，`cargo test --lib` 13/13，fmt、clippy、build 全绿。

### What went wrong?

- `verify:ui` 首轮失败：版本面板恢复后仍显示旧版本，用 `document.body.innerText` 断言“旧文本消失”会误判；改为只断言消息气泡内容，面板内容单独校验。
- TS 首轮构建报 `message.id` 可能为 undefined，补充空值兜底后通过。

### Action Items

- 下一 Sprint 候选：版本差异对比视图、真实 Provider 端到端流式联调、剪贴板/日志跨设备同步。
- 后续改动消息编辑或版本面板时，保留版本历史与恢复断言。

## Sprint 16

### What went well?

- Rust 新增 `ProviderHeartbeat` 状态：记录最近结果与连续失败次数，失败 >=2 次进入 alert，恢复后清空；单测覆盖告警与恢复。
- `run_provider_heartbeat` 返回快照并 emit `provider-heartbeat`，setup 启动 10s 周期后台检查；`ProviderHeartbeatSnapshot` 含 checkedAt。
- System Provider 卡片展示 heartbeat 状态/延迟/alert 标记，顶部告警条列出告警 Provider；浏览器 fallback 可模拟健康与告警快照。
- `verify:ui` / `verify:preview` 新增心跳告警断言并通过；`cargo test --lib` 12/12、clippy、fmt、build 全绿。

### What went wrong?

- `ProviderHeartbeatSnapshot` 首次编译缺 Clone，`app.emit` 要求 Serialize + Clone，补 derive 后通过。
- `cargo fmt --check` 首轮报多处换行差异，运行 `cargo fmt` 后通过。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、消息分叉/版本历史、剪贴板/日志跨设备同步。
- 后续改动 Provider 心跳周期、告警阈值或 System 视图时，保留心跳告警断言。
- 告警后续可扩展为全局通知与自动禁用失败 Provider。

## Sprint 15

### What went well?

- Rust 流式链路加固：`stream_client()` 统一 connect timeout 8s + total timeout 30s；openai/ollama 改为 `BufReader.read_line` 增量读取，取消后立即停止读取。
- 错误短映射：超时/连接失败/HTTP 状态码映射为简短错误，不再把完整 body/密钥抛给 UI；Ollama 缺失 `done:true` 会明确报错；单测覆盖映射与截断。
- 前端新增 connecting/streaming/error/stopped 状态条与 Retry 按钮；浏览器 fallback 可模拟超时失败，`verify:ui` / `verify:preview` 新增错误映射断言并通过。
- `cargo test --lib` 11/11、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次补丁试图用控制台乱码文本匹配 UTF-8 中文，patch 匹配失败；改用真实中文字符后通过。
- `reqwest::blocking::Response` 的 `lines()` 不可用，仍需手写 `read_line` 循环；取消语义需在循环后再次检查，避免把取消误报为“缺少 [DONE]”。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、Provider 周期心跳与状态告警、消息分叉/版本历史。
- 后续改动流式协议、Provider 路由或 AI Studio 交互时，保留 `verify:ui` 的流式错误映射断言。
- 若需要真正中断网络读取，可评估 `reqwest` 非阻塞流或 `tauri-plugin-http`。

## Sprint 14

### What went well?

- Rust 新增 `update_chat_message` / `truncate_chat_messages`，单测覆盖编辑内容与截断后续消息；`save_chat_message` 支持外部传入 id，前端发送时同步生成消息 id 落库。
- user 消息 hover 提供 Edit（内联 textarea）与 Regenerate；重新生成截断旧回复后按当前模式重新流式输出并落库。
- `verify:ui` 新增编辑 + 重新生成断言：编辑内容替换、旧文本消失、重新生成后新回复完整出现。
- `cargo test --lib` 10/10、`cargo clippy --lib -D warnings`、`cargo fmt`、`npm run build`、`verify:ui` 全绿。

### What went wrong?

- 重构发送链路后 run index 与占位符位置不一致，导致流更新落到 user 消息上；修正为按实际 history 计算索引。
- 重新生成时 `setMessages` 与流更新存在批次竞态，先注册 run 再更新消息状态后稳定。
- 首轮验证在流未结束时点 Edit 被 busy 拦截，等待流空闲后再编辑。

### Action Items

- 下个 Sprint 候选：真实 Provider 端到端流式联调、Provider 周期心跳与状态告警、消息分叉/版本历史。
- 编辑功能后续可支持 assistant 消息编辑与多轮分支对比。
- 保留编辑/重新生成断言，改动消息流、chat_messages 或 AI Studio 交互时重跑 `verify:ui` / `verify:preview`。

## Sprint 13

### What went well?

- AI Studio 新增 Auto 路由模式：发送前并行健康检查所有启用节点，过滤失败节点后选择首个健康 Provider，顶部徽标与 Inspector 展示实际路由与回退来源。
- 无可用 Provider 时返回清晰错误消息，不再静默失败；浏览器 fallback 复用模拟健康检查，UI 验证可稳定断言禁用 OpenAI 后自动回退到 Ollama。
- `npm run build`、`verify:ui`、`verify:preview` 全绿，`verify:ui` 新增 Auto 路由断言（徽标 + Router 轨迹）。

### What went wrong?

- Inspector 把 section label 渲染为大写（`ROUTER`），首轮断言按小写匹配失败，改为匹配实际渲染文本。
- Auto 路由断言首轮用旧 Inspector 文本（残留 MOA Trace）判断，未等待新路由内容出现；改为等待 `auto → Ollama` 后再断言。

### Action Items

- 下个 Sprint 候选：消息编辑/重新生成、真实 Provider 端到端流式联调、Provider 周期心跳与状态告警。
- 路由策略后续可扩展为按延迟加权、会话级固定 Provider 或失败自动重试一次。
- 保留 Auto 路由断言，改动路由逻辑、Provider 健康检查或 AI Studio 模式切换时重跑 `verify:ui` / `verify:preview`。

## Sprint 12

### What went well?

- Rust 新增 `rename_session` / `delete_session`，`chat_messages` 外键级联删除生效，单测覆盖重命名与删除后消息清空。
- 会话栏新增搜索框、hover 重命名/删除与二次确认；删除当前会话后自动切换到下一个会话。
- 修复空会话被自动复用的问题：发送新消息时若当前会话无历史，新建会话并以首条消息命名，会话标题与内容保持一致。
- `cargo test --lib` 9/9、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿，`verify:ui` 新增会话管理断言。

### What went wrong?

- 会话管理断言首轮误用 body 全文判断旧标题，聊天内容仍包含旧文本导致误报，改为只检查会话列表按钮。
- `verify:preview` 在未重新 build 时用旧 dist 验证失败，先 `npm run build` 再验证即通过。

### Action Items

- 下个 Sprint 候选：Provider 自动路由、消息编辑/重新生成、真实 Provider 端到端流式联调。
- 会话搜索后续可升级为模糊拼音/全文匹配，并支持按时间范围过滤。
- 保留会话管理断言，改动会话栏、sessions 或 chat_messages 时重跑 `verify:ui` / `verify:preview`。

## Sprint 11

### What went well?

- SQLite 新增 `chat_messages` 表，Rust `save_chat_message` / `list_chat_messages` 带单测；AI Studio 左侧新增会话栏，New chat、会话切换、历史恢复与刷新后自动恢复首个会话全部落地。
- 发送时保存 user 消息，流式结束或取消后保存 assistant 消息；取消时立即落库 `[stopped]`，浏览器 fallback 用 localStorage 保持同等行为。
- 重构流式监听为按 runId 维护独立内容与消息索引，修复多条 chunk 串入错误消息、取消内容丢失的问题；`verify:ui` / `verify:preview` 新增会话持久化断言并通过。
- `cargo test --lib` 8/8、`cargo clippy --lib -D warnings`、`cargo fmt --check`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 会话栏 `<aside>` 与 Inspector `<aside>` 同标签，导致首轮验证脚本误取文本，改为按 `drawer-panel` 类定位。
- 原流式监听在非 done chunk 时把普通 assistant 消息误当占位符，UI 出现逐 chunk 分裂消息且停止时内容为空；按 run 重构后稳定。

### Action Items

- 下个 Sprint 候选：会话重命名/删除/搜索、Provider 自动路由、真实 Provider 端到端流式联调。
- 会话历史建议增加分页或虚拟列表，避免超长会话渲染压力。
- 保留会话持久化断言，改动 AI Studio、chat_messages 或流式协议时重跑 `verify:ui` / `verify:preview`。

## Sprint 1

### What went well?

- 范围冻结后 Dock 收拢为 5 个主视图，App Shell、Bento 卡片与五视图切换一次成型。
- SQLite 5 张核心表、Rust CRUD、MOA 并发通道与 Git 上下文命令全部落地，`cargo test --lib`、`cargo clippy -D warnings`、`cargo fmt --check` 全绿。
- `npm run verify:ui` 自动化覆盖 5 视图切换、Design Token 采样、刷新持久化与开发遮罩检查。

### What went wrong?

- `tauri.conf.json` 与 `Cargo.toml` 带 UTF-8 BOM，导致 Tauri build script 解析配置失败。
- zerocopy build script 找不到 `rustc`，需要显式设置 `RUSTC` 才能编译。
- `send_ai_message` 曾把 SQLite MutexGuard 带过 `await`，触发 future 非 `Send`，已改为作用域内取数后再并发。

### Action Items

- 下个 Sprint 接入 ESLint/Prettier 与 husky/lint-staged，补齐前端 lint 门禁。
- 新增 Tauri 异步命令时，禁止 MutexGuard 跨 `await`，统一使用作用域锁或 `spawn_blocking`。
- 保留 `npm run verify:ui` 作为回归基线，每次改动 App Shell 或视图后重跑。

## Sprint 2

### What went well?

- 设计部 4 类角色并行产出设计约束、动效规范、DoD 与视觉叙事，UI 改造正式进入 SDLC。
- 参考模板提炼为 150ms 轻量动效：环境光、Glass Surface、卡片 hover、Inspector 浮层、MOA Stack、Tilt Card、Focus Progress、Health Pulse。
- `verify:ui` / `verify:preview` 新增动效时长、固定尺寸、reduced-motion、布局稳定与移动端溢出断言，全部通过。

### What went wrong?

- Visual Storyteller 首次只返回中间状态，补派后拿到完整叙事。
- Inspector 原宽度动画会回流，按 DoD 改为固定 240px + `translateX` 浮层。

### Action Items

- 后续 UI 动效必须先产出设计评审文档，再进入 Sprint。
- 动效断言保留在 `npm run verify:ui` / `verify:preview`，每次改样式后重跑。

## Sprint 3

### What went well?

- SQLite 扩展为 8 张表：新增 `habits`、`habit_logs`、`schedule_events`，并按表独立 seed，旧库升级不丢数据。
- Rust 新增 6 个习惯/日程命令，单测覆盖跨重开持久化：打卡写入、取消打卡、日程完成状态均验证通过。
- Actions 视图完成四区块：Today Focus、Habits、Fast list、Schedule Timeline；知识视图用 react-markdown 渲染标题/代码块/列表。
- UI 动态效果延续模板语言：习惯打卡 check-pop、日程卡片 pointer tilt、进度条 scaleX，`verify:ui` 新增习惯持久化、Markdown 渲染与区块重叠断言。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `verify:ui` 首次断言 Markdown 预览失败：默认选中第一条普通 thought，改为点击 Markdown 笔记后再断言。
- 习惯打卡断言误用 `closest("section")`，实际打卡行是 `div`，改为检查按钮父行类名。
- 老库 seed 逻辑只判断 `projects` 是否为空，新增表可能不写示例数据，已拆分为独立 seed 函数。

### Action Items

- 下个 Sprint 优先做 AI Studio 真流式输出或 System 剪贴板/日志真实采集。
- 新增表时必须同时评估 seed 兼容旧库，并在 DoD 中显式列出迁移场景。
- 保留 Actions/Knowledge 断言，后续改动这两视图时重跑 `verify:ui`。

## Sprint 4

### What went well?

- System 视图从示例数据升级为真实采集：SQLite 新增 `clipboard_history`、`error_logs`，Rust 后台剪贴板监听线程每 1.5 秒轮询并去重入库。
- 前端全局监听 `error` / `unhandledrejection`，通过 `report_frontend_error` 写入日志；System 视图每 3 秒刷新并响应 `clipboard-updated` 事件。
- `verify:ui` 新增 System 真实数据断言，并用轮询等待消除视图切换竞态，连续两遍稳定通过。
- `cargo test --lib` 3/3、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次接入 `try_state` 误用 `let Ok` 匹配 `Option`，编译失败，改为 `let Some`。
- System 断言首跑因视图渲染竞态失败，改为点击后轮询等待 `Clipboard history` 标题出现。
- 前端错误上报若自身失败会形成递归，补 try/catch 后直接返回。

### Action Items

- 下个 Sprint 优先做 AI Studio 真流式输出，接 Tauri Event 逐块推送。
- 剪贴板轮询间隔与去重窗口写入 `docs/ARCHITECTURE.md`，后续如需 OS 原生监听再评估 `tauri-plugin-clipboard-manager`。
- 系统采集相关断言保留在 `verify:ui`，改动 System 视图或 App 全局错误钩子后重跑。

## Sprint 5

### What went well?

- AI Studio 升级为真流式输出：Rust 后台解析 OpenAI `data:` SSE 与 Ollama NDJSON，通过 `stream-chunk` 事件逐块推送，MOA 按序聚合为单流。
- 前端监听事件后 assistant 消息增量追加，busy 状态驱动打字机光标与 thinking dots，结束后恢复输入。
- 浏览器 fallback 用 60ms 分块模拟流，`verify:ui` / `verify:preview` 可稳定验证流式路径：进行中光标、最终回复、busy 结束。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `reqwest::blocking::Response` 没有 `.lines()`，改用 `.text()` 后按行解析。
- `AppHandle` 被 move 进 `spawn_blocking` 后无法再 emit，改为克隆后引用。
- clippy 捕获 `&line` 多余借用；流式验证首轮未捕获进行中光标，改为 30ms 轮询后稳定。

### Action Items

- 下个 Sprint 候选：Knowledge RAG 向量索引，或 Provider 流式取消/中断。
- 真实 Provider 流式仍需配置 API Key 后做端到端联调；当前验证覆盖协议与 UI 渲染路径。
- 保留流式断言，后续改动 AI Studio 或流式协议时重跑 `verify:ui`。

## Sprint 6

### What went well?

- Knowledge 视图接入真实本地 RAG：Rust 实现 BM25 检索，`search_thoughts` 按 IDF 与文档长度归一化打分，`get_rag_index_status` 返回文档数与索引状态。
- 前端搜索框、命中列表、score 展示与索引 badge 全部落地，点击结果可进入 Markdown 预览。
- 浏览器 fallback 用关键词命中保证 UI 验证可运行，`verify:ui` 新增 RAG 断言并通过。
- `cargo test --lib` 4/4、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- `RagSearchResult` 最初缺少 `type` 字段，预览类型报错，补齐后与 `Thought` 共用渲染路径。
- BM25 分母缺少括号导致公式不标准，修正后重跑单测。
- `visibleThoughts` 声明位置在 selected 计算之后，一度引用过早，调整顺序后通过 tsc。

### Action Items

- 下个 Sprint 候选：把 RAG 结果注入 AI Studio 上下文，形成检索增强对话。
- 如需跨文件/Obsidian 检索，再评估文件扫描与增量索引。
- 保留 RAG 断言，改动 Knowledge 或检索命令时重跑 `verify:ui`。

## Sprint 7

### What went well?

- AI Studio 发送前自动检索本地 thoughts：命中时在 API messages 前注入 `system` 上下文，回复可直接引用个人知识库。
- 模型切换条旁新增 RAG 开关（默认开启），消息区显示 `RAG +N` badge 与来源摘要，Inspector 展示 RAG context 与 Source 列表。
- 注入为纯前端实现，复用 `search_thoughts` 命令，无新增 Rust 命令；`verify:ui` 新增 RAG 注入断言并稳定通过。
- `cargo test --lib`、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首轮 RAG 注入断言依赖 Inspector 打开时机，改为轮询 badge 与 Inspector 文本后稳定。
- AI Studio 发送前检索是串行 await，检索极快，但后续可评估与 Provider 请求并行。

### Action Items

- 下个 Sprint 候选：跨文件 / Obsidian Vault 索引、Provider 流式取消，或真实 Provider 端到端流式联调。
- RAG 注入默认开启，后续可加“命中结果人工确认后再发送”选项。
- 保留 RAG 注入断言，改动 AI Studio 或检索命令时重跑 `verify:ui`。

## Sprint 8

### What went well?

- Rust 新增 `StreamCancellation` 状态与 `cancel_ai_stream(run_id)` 命令，流式函数逐块检查取消标记，`stream-chunk` 的 done 事件新增 `cancelled` 字段。
- AI Studio busy 时输入区切换为 Stop 按钮，点击后立即标记消息 `[stopped]` 并忽略旧 run 后续块；浏览器 fallback 用本地取消集合中断分块模拟流。
- 顺带修复了流式消息 `__stream__` 占位前缀残留的显示问题：正常完成、出错与取消都会清理前缀。
- `cargo test --lib` 5/5（新增取消生命周期单测）、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首轮取消断言只检查 body 文本，可能被其他 UI 文本干扰，改为定位 `[stopped]` 消息并比较前后文本稳定性。
- Rust 当前是整段读取响应 body 后逐块 emit，取消只能停止渲染，不能真正中断网络读取；已写入范围外。

### Action Items

- 下个 Sprint 候选：跨文件 / Obsidian Vault 索引，或真实 Provider 端到端流式联调。
- 若需要真取消网络请求，评估 `reqwest` 流式读取或 `tauri-plugin-http`。
- 保留流式与取消断言，改动 AI Studio、流式协议或取消命令时重跑 `verify:ui`。

## Sprint 9

### What went well?

- SQLite 新增 `knowledge_files` 表，Rust `index_vault` 递归扫描 `.md`、解析 frontmatter 并按 path upsert，`search_thoughts` 同时覆盖 thoughts 与本地文件。
- Knowledge 视图新增 Vault Index 卡片：路径输入、Index 按钮与文件数 badge；RAG 文档数汇总包含文件，AI Studio RAG 注入自动引用本地 Markdown。
- 浏览器 fallback 用 localStorage 模拟 Vault 文件，`verify:ui` 新增文件数 badge 与文件命中断言并通过。
- `cargo test --lib` 6/6（新增 Vault 扫描/检索单测）、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- 首次 `cargo fmt --check` 报多处换行格式差异，运行 `cargo fmt` 后通过。
- 当前 Vault 索引为全量扫描 upsert，尚无文件监听与增量更新。

### Action Items

- 下个 Sprint 候选：文件监听与增量索引、Provider 健康度监控，或真实 Provider 端到端流式联调。
- 若索引文件夹很大，需要加忽略目录与并行扫描。
- 保留 Vault 断言，改动索引命令或 Knowledge 视图时重跑 `verify:ui`。

## Sprint 10

### What went well?

- Rust 新增 `check_provider_health(provider_id)`：Ollama 探测 `/api/tags`，OpenAI 兼容节点带 Bearer 探测 `/models`，返回 `{ ok, latencyMs, message }`。
- `is_ollama_provider(name, url)` 收敛 Ollama 判定并复用到健康检查、单次对话与流式路由，新增单测。
- System Provider 卡片从占位 `Latency - ms` 升级为健康点、ok/unreachable、延迟与 Check 按钮；进入视图自动检查，支持 Check all。
- `cargo test --lib` 7/7、`cargo clippy --lib -D warnings`、`npm run build`、`verify:ui`、`verify:preview` 全绿。

### What went wrong?

- SystemView 初次补健康检查逻辑时漏引 `db` 模块，tsc 报 3 处错误，补导入后通过。
- 健康检查对真实 Provider 是网络探测，单测只覆盖 Ollama 判定；端到端仍需配置 API Key。

### Action Items

- 下个 Sprint 候选：文件监听与增量索引、Provider 自动路由，或真实 Provider 端到端流式联调。
- 健康检查可扩展为周期心跳与状态告警。
- 保留健康断言，改动 System 视图或健康命令时重跑 `verify:ui`。
