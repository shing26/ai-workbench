# 2026-08-05 Accent Token 迁移评审

## 结论

- `index.css` 新增 `.accent-bg-*`、`.accent-text*`、`.accent-border*`、`.accent-ring`、`.accent-dot*` 与 hover 变体，全部基于 `--color-accent` / `--color-accent-strong` / `--color-accent-soft`。
- Actions、AI Studio、Knowledge、Projects、System、ModelBadge、StatPill 中的 `#007AFF` / `#7FB4FF` / `blue-*` 字面量已全部替换；`rg` 扫描组件层零残留。
- `emerald-*` 类确认已经通过 `--color-emerald-*` 随 accent 重映射，本次只处理真正硬编码的蓝色字面量。
- 两条 UI 验收 lane 新增 accent token 动态断言：切换 ocean / emerald 后 Knowledge Index vault 按钮 computed color 从 `rgb(77,163,255)` 变为 `rgb(52,211,153)`。

## 风险与后续

- `color-mix` 依赖现代 WebView，Tauri 2 默认 WebView2 支持；后续若需要旧内核需提供 fallback。
- violet / amber / rose 等二级语义色暂未 token 化，保留为 Team 模式与错误/警告语义色。
- 下一 Sprint 候选：真实 Provider 端到端流式联调、PR 冲突解决与自动 rebase。
