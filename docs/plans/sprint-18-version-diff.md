# Sprint 18 计划：版本差异对比视图

目标：在消息版本历史基础上增加差异对比视图，用户可在版本面板中对比任意旧版本与最新版本的逐行增删，快速理解一次编辑改了什么。

## Sprint 18 任务

| ID | 任务 | 验收标准 |
|---|---|---|
| D1 | Rust diff 命令 | `MessageDiff { added[], removed[] }`；`diff_message_version_with_current` 按行 diff；单测覆盖增删与空版本 |
| D2 | 前端数据层 | `diffMessageVersionWithCurrent` 调用 Tauri 命令，浏览器 fallback 等价实现 |
| D3 | 差异 UI | 版本行新增 Compare 按钮，面板展开显示 `vN → 当前内容` 增删行；无版本时不显示按钮 |
| D4 | 动效约束 | diff 面板动画 <=150ms、仅 transform/opacity/filter、遵守 reduced-motion |
| D5 | 自动化验收 | `verify:ui` 新增“对比 v1 → v2 显示增删行”断言；完整验证链通过 |

## 范围外（进入 Backlog）
- 真实 Provider 端到端流式联调（需 API Key/本地模型）
- 剪贴板/日志跨设备同步
- 多版本图谱与分支可视化

## DoD 检查单

- [x] `diff_message_version_with_current` 单测覆盖增删行与空版本
- [x] `cargo fmt --check`、`cargo clippy --lib -D warnings`、`cargo test --lib` 通过
- [x] `npm run build`、`verify:ui`、`verify:preview` 通过
- [x] 动效仍遵守 150ms 与 reduced-motion
- [x] PR 合并到 develop，复盘更新
