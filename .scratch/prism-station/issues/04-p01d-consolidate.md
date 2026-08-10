# 04 — P0-1d: 📌 固化为知识 + Trade-off / ADR 回溯

**What to build:** 辩论共识后一键「固化为知识」落盘 Markdown 卡片（YAML Frontmatter + [[WikiLinks]]），右侧抽屉展示 Trade-off 与历史 ADR。

**Blocked by:** 02 (P0-1b roundtable)

**Status:** completed

- [ ] 「固化为知识」按钮（`data-consolidate-knowledge`）：共识摘要 + 观点 + Trade-off → 生成 Markdown（frontmatter: id/tags/status/created_at）
- [ ] 写入 Knowledge 模块（复用 addThought → `#prism,#consensus`）或 `docs/knowledge/`
- [ ] SQLite `knowledge_cards` 表同步（新表 + 迁移）
- [ ] 右侧抽屉：Pros/Cons/Security 分区（`data-tradeoff`），匹配历史 ADR（按主题相似检索 `docs/adr/`）
- [ ] verify lane：固化 → Markdown 生成 → Knowledge 可见 → Trade-off 抽屉展示

**Definition of Done:** 📌 固化知识生成结构化 Markdown + Frontmatter + Trade-off 回溯。Sprint 2 DoD-3。
