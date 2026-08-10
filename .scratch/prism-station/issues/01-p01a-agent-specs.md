# 01 — P0-1a: Agent 规约解析器 (.hermes/agents/)

**What to build:** 解析 `.hermes/agents/` 下的高管 Agent 规约 Markdown（含 YAML Frontmatter：id/name/role/kpi/system_prompt），载入 Rust 端供辩论调度。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Rust `load_agent_specs(project_path)`：递归扫描 `.hermes/agents/*.md`，解析 YAML Frontmatter + body（system prompt）
- [ ] `AgentSpec` 结构：id/name/role/kpi/prompt/active
- [ ] `list_agent_specs` Tauri 命令 + 浏览器 fallback（localStorage mock）
- [ ] 内置 3 个示例规约（cto / cdo / ciso）落盘 `.hermes/agents/`
- [ ] Rust 单测：Frontmatter 解析、缺失字段容错、非法 YAML 跳过

**Definition of Done:** 前端可枚举在席高管；prompt 可注入辩论引擎。Sprint 2 DoD-1 基础。
