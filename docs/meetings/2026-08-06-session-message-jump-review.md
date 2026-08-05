# 2026-08-06 会话消息跳转评审

## 结论

- `SessionSearchHit` 新增 `messageId`：Rust `search_sessions` 的消息查询改为 `SELECT id, content`，命中时返回消息 ID；标题 / 模型命中返回 `None`。
- `db.ts` 浏览器 fallback 同步携带 `message.id`，`SessionSearchHit` 类型与 Rust 同构。
- AI Studio 搜索结果行新增 `data-session-message-id`，消息命中时点击 Open session 会加载会话、`scrollIntoView` 定位并添加 `message-jump-highlight`。
- 消息气泡外层新增 `data-message-id`，高亮样式使用短暂边框辉光动画，不改变布局。
- `verify:ui` / `verify:preview` 的 `sessionSearchEnhanced` lane 新增 `jumpSeen` / `jumpMessageId` / `highlightedMessageId` 断言，三者在 preview 中一致。

## 排查记录

- `AIStudioView.tsx` 已导入 `@dnd-kit/utilities` 的 `CSS`，全局 `CSS.escape` 被遮蔽导致 `tsc` 报错；改用 `window.CSS.escape` 后构建通过。
- 跳转后 aside 的 DOM 可能重渲染，验证 lane 在点击跳转后重新获取 `data-session-fulltext` 引用，避免后续空态断言操作陈旧节点。

## 风险与后续

- 高亮不会自动消失，切换会话或新建会话时清除；后续可增加时长自动淡出。
- Provider 权重 / 路由排序、拼音模糊搜索、搜索历史与聚合统计仍在 Backlog。
- Connection Layer 与 Monetization Workbench 按用户要求继续搁置。
