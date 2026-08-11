# 05 — P0-2a: spawn_cli_process（Tokio 子进程 + SSE 流式日志）

**What to build:** Rust 端 `spawn_cli_process`：Tokio 线程唤醒系统 `claude`/`aider` 子进程，逐行捕获 stdout/stderr 并通过 Tauri Event 流式 emit，回显 Exit Code。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Rust `spawn_cli_process(project_path, command, args, cwd)`：
  - `tokio::process::Command` 或 `spawn_blocking` + 逐行读
  - 每行 emit `CLI_LOG_LINE`（{ projectPath, line }）
  - 进程结束 emit `CLI_EXITED`（{ exitCode }）
- [ ] Scope 校验：cwd 必须在 project_path 内；禁止 `rm -rf` / shell 注入字符（`;` `&&` `|`）
- [ ] Tauri 命令 + 浏览器 fallback（mock 流式行 + exit 0）
- [ ] `run_codex` 旧死命令移除或迁移
- [ ] Rust 单测：spawn 成功、exit code、路径越权拒绝

**Definition of Done:** 真实拉起 claude/aider + 逐行流式日志 + Exit Code。Sprint 4 DoD-2。
