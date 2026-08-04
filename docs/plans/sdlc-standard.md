# 企业级开发生命周期标准（本项目基线）

## 阶段一：需求规范与架构设计

开发任何模块前先完成文档树并锁定范围：

- `README.md`：项目整体介绍、技术栈、本地运行与编译指南。
- `docs/ARCHITECTURE.md`：前后端架构、Tauri IPC 通信协议、分层设计。
- `docs/DATABASE.md`：SQLite 表结构与索引设计。
- `docs/meetings/`：范围冻结与决策记录。
- `docs/plans/`：Sprint 计划、任务清单、复盘记录。

原则：严禁开发中途临时加项。任何新想法先写入 Backlog，排期到下一个 Sprint。

### 阶段 1.5：UI 设计与动效规范

开发任何 UI 改造前，必须先完成设计评审并产出可验收的设计契约：

- `docs/meetings/*-ui-dynamics-design-review.md`：参考模板、视觉语言映射、设计部决议与风险清单。
- `docs/plans/sprint-*-ui-dynamics.md`：动效任务、验收标准与 DoD。
- 动效硬约束：主切换 <=150ms，只用 `transform`/`opacity`/`filter`，遵守 `prefers-reduced-motion`，不改动冻结 Design Token。
- 自动化验收：UI 改造必须扩展 `verify:ui` / `verify:preview`，覆盖动效时长、固定尺寸、reduced-motion 与布局稳定。

原则：任何“临时加动画”必须先写 Backlog，排入 Sprint 后再开发，禁止绕过设计评审直接堆效果。

## 阶段二：敏捷 Sprint 迭代与任务拆解

以 1 到 2 周为周期运行 Sprint，看板固定 4 列：

- Backlog：未来想做的功能。
- Todo：当前 Sprint 必须完成的任务。
- In Progress：同时进行任务不超过 2 个。
- Done：满足 DoD 的任务。

每个任务必须包含验收标准（AC）。示例：

```text
[Feature] 落地 AI Studio 多模型切换下拉框

AC 1：下拉框包含 OpenAI、Ollama、API Key 代理三个选项。
AC 2：切换选项后，Rust 后台更新 config 并返回状态 200。
AC 3：样式严格使用 Design Token（bg-[#18181C] border-white/10）。
```

## 阶段三：规范化编码与分支管理

### Git Flow 简化版

- `main`：稳定生产分支，只接受来自 `develop` 的 Release PR，禁止直接推送。
- `develop`：日常开发主集成分支。
- `feature/xxx`：功能开发分支。
- `fix/xxx`：Bug 修复分支。

### Conventional Commits

- `feat(ui): add bento card component`
- `fix(tauri): resolve sqlite connection leaks`
- `refactor(store): simplify task state`
- `docs(plans): add sprint 1 plan`
- `style(css): align design tokens`

### Lint 与 Format Hooks

- 前端：ESLint + Prettier，`husky` + `lint-staged` 在 commit 时自动格式化。
- Rust 后台：`cargo fmt` + `cargo clippy`。

## 阶段四：质量审查与 DoD 验收

个人项目也走 PR 流程：

1. 在 `feature/xxx` 上开发。
2. 提交 PR 到 `develop`。
3. 对照 Checklist 自检：变量命名、是否残留 console.log / println!、Token 是否一致。
4. 通过后 Squash and Merge。

DoD 检查单：

- [ ] 代码无报错、无 Console 警告。
- [ ] UI 严格还原 Design Token，无响应式截断。
- [ ] 涉及数据库变更已编写 Migration。
- [ ] PR 描述清楚写明改动内容。

## 阶段五：构建发布与迭代复盘

### Semantic Versioning

- `v0.1.0-alpha`：MVP App Shell + 基础架构。
- `v0.2.0`：5 大主视图基础交互。

### Sprint Retrospective

每个 Sprint 结束时回答三个问题并记录到 `docs/plans/RETRO.md`：

1. What went well？
2. What went wrong？
3. Action Items？
