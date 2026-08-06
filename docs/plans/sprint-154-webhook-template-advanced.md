# Sprint 154 计划：Webhook payload 高级模板、schema 校验与版本管理

目标：Webhook payload 从简单变量升级为条件分支 / 循环模板，提供 schema 校验与自动补全片段，并支持模板版本保存与回滚。

## Sprint 154 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| S1 | Rust 高级模板引擎 | 新增 `webhook_template.rs`：`{{event}} / {{ts}} / {{context.*}} / {{this.*}}` 变量，`{{#if}} / {{#else}} / {{/if}}` 条件，`{{#each}} / {{/each}}` 循环与 `{{@index}} / {{@first}} / {{@last}}` 元数据；未知变量保留原文；`render_webhook_payload` 走新引擎。 |
| S2 | 模板校验 | `validate_template` 返回 `{ ok, errors, variables, blocks, rendered, renderedJsonOk }`；Tauri 命令 `validate_webhook_payload_template` 接受可选 `contextJson` 并真正解析 JSON。 |
| S3 | 版本持久化 | `webhook_rules.template_version` + `webhook_template_versions` 表；创建规则自动写 v1；`next / save / list / restore_webhook_template_version` 提供完整生命周期；迁移函数幂等并加入 `init_connection`。 |
| S4 | 浏览器 fallback | `db.ts` 与 Rust 同构的高级渲染器与校验；版本保存到 `ai-workbench:webhook-template-versions:v1`；`readWebhookRules` 自动补 `templateVersion ?? 1`。 |
| S5 | SystemView 交互 | payload 编辑区模板片段按钮（event / ts / context / if / each）与 Validate schema；每条规则下方模板编辑器、保存版本、版本下拉与 Restore；锚点 `data-webhook-template-snippet` / `data-webhook-template-validation` / `data-webhook-rule-payload-input` / `data-webhook-rule-version-save` / `data-webhook-rule-version-count` / `data-webhook-rule-version-select` / `data-webhook-rule-version-restore` / `data-webhook-rule-version-note`。 |
| S6 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `webhookTemplateVersioning` / `webhookTemplateValidationUi` lane；Rust 单测覆盖条件、循环、未知变量、块收集与版本生命周期，总数增至 199。 |
| S7 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合并 develop。 |

## DoD 检查单

- [x] 高级模板支持条件分支与循环，Rust 与浏览器渲染结果一致。
- [x] Validate schema 返回变量 / 块 / 渲染预览 / JSON 合法性。
- [x] 模板版本可保存、列表展示并回滚，reload 后仍生效。
- [x] `verify:ui` / `verify:preview` 的 `webhookTemplateVersioning` / `webhookTemplateValidationUi` lane 双端通过；Rust 单测 199/199。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- AI Studio 会话复制与导出增强、Knowledge 向量分片 / 近似索引为后续 Sprint 候选。
- Connection Layer 与 Monetization Workbench 继续搁置。
