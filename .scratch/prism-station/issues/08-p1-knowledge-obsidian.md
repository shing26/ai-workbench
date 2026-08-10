# 08 — P1-2: 知识覆盖率 + 知识活性 + Obsidian 联动

**What to build:** Projects 知识覆盖率警告；Knowledge F 型布局 + 活性标记（🔥/❄️/⚠️）+ Hover 快捷行动栏 + Obsidian `obsidian://open?path=` 绝对路径联动。

**Blocked by:** None — backlog（P0 优先项完成后）

**Status:** ready-for-agent

- [ ] 知识覆盖率：`已文档化模块 / 总模块` <50% 黄警告，点击直达 Knowledge 过滤
- [ ] Knowledge F 型布局 + 分类 Filter Tabs
- [ ] 活性标记（last_referenced_at → 🔥/❄️/⚠️）
- [ ] Hover 快捷行动栏：`⚡ 注入 Context` / `🧩 拆解 DoD` / `💬 论证` / `🔮 Obsidian`
- [ ] Rust `open_obsidian(project_path, file)`：`obsidian://open?path={encodeURIComponent}` + 浏览器 fallback mock
- [ ] 图谱 Graph View / 田字格 Grid View 秒切

**Definition of Done:** Sprint 3 DoD-1/2/3 + 覆盖率。
