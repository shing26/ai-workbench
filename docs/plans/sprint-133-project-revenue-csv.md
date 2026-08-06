# Sprint 133 计划：Projects 收益历史 CSV 导出

目标：为 Projects 新增收益历史 CSV 导出：把全部项目的 `revenueTrends` 趋势点汇总为 `Project,ProjectId,Status,RecordedAt,Revenue` CSV，支持预览、复制与下载，便于外部表格继续分析。

## Sprint 133 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | CSV 生成 | 组件内由 `projects` + `revenueTrends` 派生 `revenueCsv`，CSV 字段做引号转义，无历史项目的行用当前 revenue 兜底 |
| R2 | 导出控件 | Portfolio summary 卡片新增 `data-project-revenue-export` 开关、`data-project-revenue-csv-preview` 预览、`data-project-revenue-csv-copy` 复制与 `data-project-revenue-csv-download` 下载 |
| R3 | 结果反馈 | 开关打开时 `data-project-revenue-export-result` 显示 `N rows`，复制成功后按钮显示 Copied |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `projectRevenueExport` lane：断言表头、项目名、行数与复制状态 |
| R5 | 完整验证 | build、lint、prettier、`cargo fmt` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] CSV 汇总全部项目收益趋势点并正确处理空历史。
- [x] 预览、复制与下载三入口可用，结果行数可见。
- [x] 双端 lane 覆盖 CSV 内容与复制交互。
- [x] 全部门禁与双端验证通过。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
