# 07 — S1-2: CommandPalette universal entry (LUI)

**What to build:** 重写死代码 CommandPalette 为 LUI 万能入口（实体搜索 + 动作执行 + 最近使用排序）。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] 删除死代码 `CommandPalette.tsx`（旧实现引用已死 `appStore`）
- [ ] 新建 `components/CommandPalette/`：`registry.ts` + `index.tsx`
- [ ] `lib/commands.ts`：CommandRegistry，静态命令 + 实体命令（从 workbenchStore 派生）
- [ ] `lib/commandUsage.ts`：localStorage 使用计数（`{id,count,lastAt}`），排序 = weight + usage
- [ ] AppHeader 的 Search 挂载此组件，收敛双 Ctrl+K（移除 inline search）
- [ ] 实体激活语义：选 thought → 切 Knowledge + 预置选中；选动作 → 直接执行

**Definition of Done:** Ctrl+K 唯一入口；能搜 sessions/thoughts/tasks/projects/providers + 动作；按最近使用排序；80% 日常操作 3 次按键内。
