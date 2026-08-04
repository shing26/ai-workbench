# 04 — Chat Center: thread list + message area + input + model routing
**What to build:** 对话中枢：线程列表、消息区域、输入框、模型路由选择器（云 API / Codex / 本地 Ollama / 自动）、预算指示器。
**Blocked by:** 02-app-shell.md
**Status:** completed
- [ ] Zustand stores for threads[] and settings (selectedModel, budgetUsed, budgetLimit)
- [ ] Thread list panel: scrollable, create-new button, active highlight
- [ ] Message area: scrollable, user/assistant bubbles, auto-scroll to bottom
- [ ] Input box: textarea, Shift+Enter newline, Enter send, send button icon
- [ ] Model selector: segmented control with Cloud API / Codex / Ollama / Auto options
- [ ] Budget indicator in top bar
- [ ] Mock response: add user message, simulate assistant response after short delay
- [ ] Verify: create thread, send messages, switch threads, select model, budget visible
