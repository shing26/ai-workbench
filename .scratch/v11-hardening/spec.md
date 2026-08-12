# v11 Hardening — Spec

**Status:** done

## Problem Statement

v1.0 旅程闭环已落地，但三个关键候选仍缺自动化与真实环境证据：归档旅程缺少端到端 UI 验证；CLI 自动识别与 Obsidian 联动只在浏览器 fallback 验证过；验证矩阵没有前端单元测试层，且 `verify:matrix` 尚未接入 npm scripts。CPO 无法在无人值守时确认“归档后 Knowledge 一定出现卡片”“桌面端真实 CLI 可用”“L2 覆盖逻辑回归”。

## Solution

在既有验证契约上补三条 vertical slice：归档旅程端到端 UI 自动化、桌面环境实测冒烟脚本、vitest 单元测试与验证矩阵接线。全部复用现有验证入口，不新增产品功能，不改动 Rust 后端边界。

## User Stories

1. As a CPO, I want the UI automation to create, archive, and verify a journey in one pass, so that I can prove the archive loop works without manual clicks.
2. As a CPO, I want a desktop smoke report that lists installed CLI tools and Obsidian protocol availability, so that I know what the delivery terminal can actually dispatch.
3. As a CPO, I want frontend unit tests to run as part of the verification matrix, so that store and helper regressions are caught before UI verification.

## Implementation Decisions

- 归档 E2E 复用现有 CDP 无头浏览器 harness，只扩展一条 archive lane，不新建浏览器框架。
- 桌面冒烟脚本独立于浏览器运行：探测 PATH 白名单 CLI、检查 Obsidian 协议处理器、执行 Rust 单测并输出结构化报告；缺失项降级为警告，不阻断报告生成。
- vitest 只测纯前端 helper/store seam，不测 DOM；作为 L2 的一环接入 `verify:matrix`。
- `verify:matrix` 与 `test:unit` 暴露为 npm scripts，质量门保持一致。

## Testing Decisions

- 好的归档 E2E 测试只断言用户可见结果：项目进入 archived、Knowledge 出现对应归档卡片。
- 好的单元测试只断言纯函数返回值与 store 状态迁移，不触碰渲染实现。
- prior art：`scripts/ui-verify.mjs` 的 CDP lane、`src/lib/tokenBudget.ts` 纯函数、Zustand store 状态流转。

## Out of Scope

- Connection Layer 与 Monetization Workbench。
- 完整 L4 AI 语义审查（保持 MOCK 降级）。
- 修改 Rust 后端实现（只运行测试与探测）。
- 新增产品功能或视觉改动。

## Further Notes

- 用户脏文件约束：`src-tauri/Cargo.toml` 不提交；修改 `package.json` 以加入 scripts/devDependency 属于本轮明确范围。
- 每条 ticket 完成后都必须保持 `lint`、`build`、`verify:preview` 全绿。
