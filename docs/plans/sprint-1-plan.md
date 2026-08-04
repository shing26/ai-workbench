# Sprint 1 计划：App Shell + SQLite 数据底座 + 5 大主视图骨架

目标：交付可运行的 App Shell、5 视图切换、SQLite 初始化与持久化示例，全部通过 Sprint 1 DoD。

## Sprint 1 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| T1 | 工程基线：文档树、Git 分支、Husky/lint-staged、cargo fmt/clippy | 新分支 `feature/sprint-1-baseline` 可提交，提交信息符合 Conventional Commits |
| T2 | App Shell：AppDock 5 Icon、AppHeader、AppInspector、BentoContainer | 5 个视图可平滑切换，切换动画 <=150ms，次级面板走右侧 Drawer |
| T3 | UI 基础组件与 Token：BentoCard、ModelBadge、StatPill | 样式全部使用冻结 Token，无内联样式叠写，无纯黑背景 |
| T4 | SQLite：5 张核心表迁移、示例数据、Rust 命令 | 启动自动建表；创建 Today Task 后刷新仍存在；providers.api_key 存 Keyring 引用 |
| T5 | AI Studio 视图 | 顶部 Model/MOA 切换条、中央流式聊天 Canvas、右侧 Inspector 占位 |
| T6 | Projects 视图 | 项目卡片矩阵、AI Coding 浮窗入口、读取 project.path Git 摘要注入 System Prompt |
| T7 | Knowledge & Inbox 视图 | 顶部 Command+N 闪念框、标签树、右侧 Markdown 预览、RAG 状态占位 |
| T8 | Actions & Schedule 视图 | 今日 Focus 大卡片、Linear 风格任务列表、Enter 快速新建 |
| T9 | System & Automation 视图 | Provider 节点卡片（Health/Latency）、剪贴板历史、错误日志列表 |
| T10 | QA 与 DoD 验收 | 自动化测试 + 截图证据，覆盖 5 视图切换、视觉 Token、数据持久化、环境隔离 |

## 范围外（进入 Backlog）

- RAG 索引真实执行。
- Webhook 真实投递。
- 云同步、登录、移动端。
- Monetization 收入自动聚合。

## DoD 检查单

- [ ] 界面完整性：5 个 Icon 平滑切换 5 个主视图。
- [ ] 视觉对齐：卡片符合 `#18181C` + `border-white/10` + `rounded-2xl`。
- [ ] 数据贯通：SQLite 初始化并读取示例数据，刷新后持久化。
- [ ] 环境隔离：生产/开发遮罩隔离，无 Dev Issues 浮标。
- [ ] build、lint、测试全绿，PR 已合并到 develop。

