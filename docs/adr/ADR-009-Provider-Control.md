# ADR-009: Provider Control Deep Module

- 状态：Accepted
- 日期：2026-08-14
- 决策者：用户（经 `/grill-with-docs` 有 codebase 决策流程）

## 背景

桌面端验收发现 Studio 无法连接 Provider，Provider 也不能自定义和测试；journey doc、四级验证与归档因此无法形成真实闭环。代码中已有 provider CRUD、健康检查和流式 smoke test，但没有用户可见的 Provider Control 入口，也没有跨视图共享的选中配置。

## 决策

1. 新增前端 `ProviderControlOrchestrator` deep module，统一管理 provider 列表、选中配置、健康结果、流式测试结果与 busy/error 状态；视图只消费 snapshot 和命令。
2. Provider 配置、健康检查和流式 smoke test 通过可注入 adapter 调用 `db.ts`；Rust 与浏览器 fallback 的语义差异收在 db adapter，不在组件中分支。
3. 新增 Provider Control modal，作为跨视图配置入口；Studio 与 Actions 共享当前选中 Provider Profile。
4. L4 验证展示并记录当前 Provider Profile 作为审计上下文；现有确定性语义审计保持不变，不把未实现的 AI L4 伪造成已完成。
5. 保留既有 `data-*` / `aria-label` 契约，新增 `data-provider-*` 锚点供 UI 验证。

## Considered Options

- 继续无管理 UI：实现量最小，但用户无法配置/测试 Provider，roundtable 在桌面端必然断链。
- 重建 System 视图：功能集中，但当前产品基线只有 5 个主视图，System 视图已被裁剪。
- Provider Control modal：Provider 是跨模块基础设施，不占主视图，可在 AI Studio / Header 直接进入；采用该方案。

## 后果

- 正面：Provider 成为可配置、可测试的公共底座；Studio 与验证链路可复用同一选择。
- 代价：新增一个 orchestrator、modal 与对应测试；需要保持 Rust/browser fallback 双端语义同构。
- 风险：真实 AI L4 仍依赖外部 agent/provider，本 ADR 只要求传递审计上下文，不承诺自动 AI 语义审计。
