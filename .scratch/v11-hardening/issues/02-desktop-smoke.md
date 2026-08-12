# 02 — 桌面环境实测冒烟

**What to build:** 一个可重复执行的桌面冒烟脚本：盘点本地白名单 CLI 与 Obsidian 协议可用性，运行 Rust 单测，并输出结构化报告，供 CPO 在真实 `tauri dev` 环境核对交付终端能力。

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] 脚本列出白名单 CLI（claude / aider / codex / gemini / opencode / qwen / cursor / windsurf）的已安装状态
- [ ] 脚本检查 Obsidian 协议处理器可用性并给出结论
- [ ] 脚本运行 Rust 单测并汇总通过数
- [ ] 缺少 CLI 或 Obsidian 时输出降级说明而不是崩溃

## Comments

2026-08-13：`scripts/desktop-smoke.mjs` 实跑通过；检测到 codex/opencode，Obsidian 协议已注册，cargo test 133/133。
