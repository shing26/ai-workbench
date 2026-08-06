# Sprint 118 计划：Knowledge 标签分类视图

目标：在 Knowledge 新增 Tag Library 分类视图：标签云展示每个标签的笔记数与类型分布，点击标签后联动侧栏过滤器并展示该标签下的笔记预览，让个人知识库按主题快速归类。

## Sprint 118 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 标签云卡片 | Knowledge 新增 `data-knowledge-tag-library` 卡片：标签 chip（`data-knowledge-tag`）含计数（`data-knowledge-tag-count`），支持 All / 单选，选中态 `data-knowledge-tag-active` |
| R2 | 类型分布 | 标签卡片展示 `#work` / `#life` / `#daily` / `#recap` 等标签的类型分布（inbox / note / doc）与总标签数 |
| R3 | 联动过滤 | 点击标签 chip 同步侧栏 `filter` 并展示该标签下的笔记预览列表（`data-knowledge-tag-notes`），点击 All 恢复全部 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `knowledgeTagLibrary` lane：断言标签计数、选中联动、预览列表过滤与 All 恢复 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Knowledge 提供标签云、类型分布与联动过滤的 Tag Library。
- [x] 点击标签可过滤笔记预览，All 恢复全部。
- [x] `knowledgeTagLibrary` lane 双端覆盖计数、联动与恢复。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
