# 2026-08-05 五大主视图范围冻结对齐会议

## 会议目标

针对已经冻结的 5 大主视图，对齐产品范围、用户路径、组件树、Design Token、SQLite Schema、AI 注入点与 Sprint 1 DoD，彻底拒绝范围蠕变。

## 参会部门与 Agent

- 产品与用户体验部：Product Manager、Sprint Prioritizer、UX Architect
- 前端与交互设计部：Frontend Developer、UI Designer、UI Finish-Gate Reviewer
- 后端与系统架构部：Backend Architect、Data Engineer、Software Architect
- AI 策略与引擎部：AI Engineer、Prompt Engineer、Multi-Agent Systems Architect
- 质量与工程效能部：Test Automation Engineer、Reality Checker、Workflow Optimizer、DevOps Automator

## 决议 1：范围冻结（产品与用户体验部）

- Dock 只保留 5 个主视图：AI Studio、Projects、Knowledge & Inbox、Actions & Schedule、System & Automation。
- 5 大主视图已获正式批准，冻结期间不新增任何新模块。
- 任何新想法先进入 Backlog 需求池，评估后进入下一个 Sprint，绝不在当前 Sprint 中临时加项。
- 用户路径、交互入口、次要面板形态按下方决议锁定。

### 冻结用户路径

| 主视图 | 核心用户行为 | 关键交互入口 |
|---|---|---|
| AI Studio | 通用对话、多模型切换、MOA 深度推理 | 顶部 Model/MOA 切换条 + 中央 Stream 聊天框 + 右侧 Inspector |
| Projects | 项目进度看板 + Vibe Coding 代码上下文绑定 | 项目卡片矩阵 + AI Coding 浮窗（自动带入当前项目路径/Git Diff） |
| Knowledge | 闪念捕获 + 个人 Markdown 知识管理 | 顶部 Command+N 闪念输入框 + 左侧标签树 + 右侧预览 |
| Actions | 今日 Focus 待办 + 极简时间线 | 顶部“今日 3 件事”大卡片 + Linear 风格极速列表（Enter 快速新建） |
| System | Provider 运维 + 剪贴板历史 + 日志 | Provider 节点卡片（Latency/Health）+ 剪贴板历史列表 |

### UX 硬性规则

- 页面切换动画控制在 150ms 内。
- 所有次级面板统一采用右侧 Drawer（抽屉），严禁堆叠居中 Modal 遮罩层。
- 卡片、按钮、输入框等状态必须覆盖 default/hover/active/focus/disabled/loading/empty/error。

## 决议 2：组件树与 Design Token（前端与交互设计部）

### App Shell 逻辑组件树

```text
src/
├── components/
│   ├── layout/
│   │   ├── AppDock           # 左侧 60px 极简 Icon 导航
│   │   ├── AppHeader         # 顶部 56px 状态与 Command+K 唤醒条
│   │   ├── AppInspector      # 右侧 240px 属性与细节抽屉
│   │   └── BentoContainer    # 12 列响应式 Bento 网格保护壳
│   └── ui/
│       ├── BentoCard         # 统一卡片容器（1px 边框与微光）
│       ├── ModelBadge        # 模型/状态指示器
│       └── StatPill          # 指标数值组件
```

实现文件后缀待最终确认：当前仓库为 React + TypeScript（.tsx），会议草案提到 .vue。逻辑组件树一致，Sprint 1 建议沿用现有 .tsx 栈。

### 强制全局样式 Token

- Canvas Base：`bg-[#101014] text-slate-200`
- Dock / Header Surface：`bg-[#16161A]/80 backdrop-blur-2xl border-white/[0.06]`
- Bento Card Surface：`bg-[#18181C] border border-white/10 rounded-2xl p-4 shadow-xl`
- Active Accent Green：`bg-emerald-500/20 text-emerald-400 border-emerald-500/30`
- Active Accent Blue：`bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/25`

禁止纯黑黑洞背景；禁止内联样式叠写；所有组件必须消费上述 Token。

## 决议 3：SQLite Schema（后端与系统架构部）

- Local-first：数据全部留在本地 SQLite，前端只关心 State 绑定。
- Sprint 1 只落地 5 张核心表，不引入复杂数据关系。
- 启动时执行 `CREATE TABLE IF NOT EXISTS` 迁移，并写入示例数据用于验收。
- API Key 不落明文：`providers.api_key` 只保存 OS Keyring 引用名，密钥本体继续使用现有 `keyring` 方案。

5 张核心表见 `docs/DATABASE.md`。

## 决议 4：AI 能力下沉（AI 策略与引擎部）

- 不新增复杂 AI 模块，LLM 调度只注入两个位置：AI Studio 与 Projects。
- AI Studio 普通请求：直连 `providers` 表中默认启用节点。
- MOA 模式：Rust 后台使用 `tokio::join!` 并发请求前 3 个启用 Provider，合并流式输出，并在右侧 Inspector 展示每路 Trace。
- Projects Vibe Coding：触发项目内 AI 对话时，Rust 读取 `project.path` 下的 `.git/HEAD` 或最近修改文件摘要，无感注入 System Prompt。
- 每个 Prompt 必须有版本号和至少 3 个测试用例（happy path / edge case / failure mode）。

## 决议 5：Sprint 1 DoD（质量与工程效能部）

正式 DoD 检查单：

- [ ] 界面完整性：左侧 5 个 Icon 能够平滑切换 5 个主视图，没有内联样式叠写 Bug。
- [ ] 视觉对齐：卡片样式完全符合 `#18181C` 底色 + `border-white/10` + `rounded-2xl`，背景无纯黑黑洞。
- [ ] 数据贯通：Rust 端 SQLite 能初始化并读取示例数据（例如创建一条 Today Task，刷新后依然存在）。
- [ ] 环境隔离：生产与开发环境遮罩隔离，界面无乱入的 Dev Issues 浮标。

扩展验收：

- `cargo check`、前端 build、lint 全部通过。
- 5 视图切换测试 + 数据库持久化测试有自动化证据。
- Reality Checker 默认结论为 NEEDS WORK，直到截图与测试证据覆盖上述 DoD。

## 决策记录（Sprint 1 已确认）

1. 前端实现栈：沿用当前 React + TypeScript（`.tsx`），会议草案中的 `.vue` 命名只作逻辑组件树参考。
2. 数据层：采用 5 张核心表基线，不引入 15 表草案，复杂关系进入 Backlog。
3. 右侧 Inspector 抽屉：Sprint 1 实现 App Shell 骨架与 Projects/AI Studio 触发入口，完整字段编辑进入下一个 Sprint。
4. 质量门：Sprint 1 以 `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib`、`npm run build` 与 `npm run verify:ui` 作为自动化验收；ESLint/Prettier 与 husky/lint-staged 接入列入 Backlog。
