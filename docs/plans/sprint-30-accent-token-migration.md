# Sprint 30 计划：字面量 Blue Token 迁移到 Accent 语义类

目标：全仓库把硬编码的 `#007AFF` / `#7FB4FF` / `blue-500` 类收敛为 accent 语义类。`emerald-*` 类已经通过 `--color-emerald-*` 随 accent 重映射，本次只处理真正不跟手的字面量蓝，保证换 accent 后整站统一跟随。

## Sprint 30 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Accent 语义类 | `index.css` 新增 `.accent-bg-*`、`.accent-text*`、`.accent-border*`、`.accent-ring`、`.accent-dot*`、hover 变体，全部基于 `--color-accent` / `--color-accent-strong` / `--color-accent-soft` |
| A2 | 视图替换 | Actions / AI Studio / Knowledge / Projects / System / ModelBadge / StatPill 中 `#007AFF`、`#7FB4FF`、`blue-*` 字面量替换为语义类 |
| A3 | 动态验收 | Knowledge Index vault 按钮标记 `data-accent-token`；`verify:ui` / `verify:preview` 断言切换 ocean / emerald 后 computed color 跟随变化 |
| A4 | 残留扫描 | `rg` 确认 `src` 下仅保留 accent 定义本身，组件层无 `#007AFF` / `#7FB4FF` 字面量 |

## DoD 检查单

- [x] `cargo test --lib` 27/27 全绿，fmt、clippy 全绿。
- [x] `npm run build` 通过，组件层无蓝色字面量残留。
- [x] 切换 accent 后代表元素颜色跟随变化。
- [x] `verify:ui` / `verify:preview` 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.30.0-alpha`。

## 范围外（Backlog）

- 真实 Provider 端到端流式联调。
- violet / amber / rose 等二级语义色的 token 化。
- 跨设备云端同步传输。
