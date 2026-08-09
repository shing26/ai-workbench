# Sprint 117 计划：Projects 收益与进度汇总导出

目标：在 Projects 视图新增 Portfolio summary 卡片，聚合项目收益、状态、Git 提交与脏工作区统计；一键导出 Markdown 汇总报告并支持复制，方便日报、周报与项目复盘直接使用。

## Sprint 117 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | 汇总卡片 | Projects 新增 `data-portfolio-summary` 卡片：项目总数、总收益、活跃/暂停数、提交总数、脏项目数与周提交峰值 |
| R2 | 导出报告 | `data-portfolio-export` 生成 Markdown 报告：组合统计、项目表（名称/状态/收益/路径）、Git 活动表（提交数/分支/脏状态）与提交趋势摘要 |
| R3 | 复制与预览 | 报告在 `data-portfolio-export-preview` 展示；`data-portfolio-copy` 复制到剪贴板并显示成功状态 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `portfolioSummaryExport` lane：断言汇总数值、导出预览包含项目名与收益、复制状态 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] Projects 视图提供收益/进度汇总卡片与 Markdown 导出。
- [x] 导出报告含项目明细、收益合计与 Git 活动摘要，支持复制。
- [x] `portfolioSummaryExport` lane 双端覆盖汇总、导出与复制。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
