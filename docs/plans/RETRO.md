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
