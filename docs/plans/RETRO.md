# Sprint Retrospective

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
