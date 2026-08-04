# Sprint Retrospective

## Sprint 1

### What went well?

- 范围冻结后 Dock 收敛为 5 个主视图，App Shell、Bento 卡片与五视图切换一次成型。
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

- 设计部 4 类角色并行产出设计契约、动效规格、DoD 与视觉叙事，UI 改造正式进入 SDLC。
- 参考模板提炼为 150ms 轻量动效：环境光、Glass Surface、卡片 hover、Inspector 浮层、MOA Stack、Tilt Card、Focus Progress、Health Pulse。
- `verify:ui` / `verify:preview` 新增动效时长、固定尺寸、reduced-motion、布局稳定与移动端溢出断言，全部通过。

### What went wrong?

- Visual Storyteller 首次只返回中间状态，补派后拿到完整叙事。
- Inspector 原宽度动画会回流，按 DoD 改为固定 240px + `translateX` 浮层。

### Action Items

- 后续 UI 动效必须先产出设计评审文档，再进入 Sprint。
- 动效断言保留在 `npm run verify:ui` / `verify:preview`，每次改样式后重跑。
