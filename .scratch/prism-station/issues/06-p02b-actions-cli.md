# 06 — P0-2b: Actions 全键盘 c/v + 📎 关联知识 + CLI 模板

**What to build:** Actions 扩展键盘（c 派发 CLI、v 健康检查）、`📎 关联知识` 弹窗（选 Knowledge 卡片注入 CLI 命令模板）、CLI 模板预览。

**Blocked by:** 05 (P0-2a spawn_cli_process)

**Status:** completed

- [ ] 键盘扩展：`c` 派发（选任务 → CLI 模板预览）、`v` 健康检查（复用 Quality Gate）
- [ ] `📎 关联知识` 弹窗（`data-link-knowledge`）：Knowledge 卡片列表，选中 → `.md` 路径注入模板
- [ ] CLI 命令模板：`claude "请读取 <path>，实现 Task <title>"`（`data-cli-template-preview`）
- [ ] `🚀 唤醒本地 CLI`（`data-cli-run`）→ `spawn_cli_process` + 流式日志区（`data-cli-log`）
- [ ] 健康检查 `v` → 弹结果（复用 `run_quality_gate`）
- [ ] verify lane：关联知识 → 模板刷入 → 唤醒 → 日志流 + exit

**Definition of Done:** c/v 键盘 + 关联知识注入 + CLI 模板 + 真实拉起。Sprint 4 DoD-1/2。
