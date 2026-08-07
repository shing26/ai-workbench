# 14 — S2-3: SystemDrawer config drawer

**What to build:** 新建可交互配置抽屉承载 Webhook/Sync/Event bus/Agent/Clipboard/Error logs。

**Blocked by:** S2-2（表单平移）

**Status:** open

- [ ] 新建 `components/system/SystemDrawer.tsx`：右抽屉 w-[420px]，tab 分区（Webhook / Sync / Event bus / Agent / Clipboard / Error logs）
- [ ] 复用既有卡片表单逻辑（状态用 `useViewState` 兜底，P0-2/S1-3）
- [ ] Stage 顶部"配置"按钮 / CommandPalette 动作打开对应 tab；Esc 关闭 + 焦点归还
- [ ] 抽屉内滚动 vs 外层滚动处理；打开时 Stage 仍实时更新不遮挡 HITL 行
- [ ] AppInspector 保持只读原职（AI Studio trace / Projects AI coding）

**Definition of Done:** 配置不占主网格；默认折叠；可交互、可访问。
