# Sprint 48 计划：同步审计筛选与导出

目标：Sync audit 支持按事件类型筛选，并可将当前筛选结果导出为 JSON / CSV，便于事后核对与移交。

## Sprint 48 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | 筛选查询 | `list_sync_audit` 增加可选 `event` 参数，SQL 按事件精确过滤，缺省返回全部 |
| A2 | 导出命令 | 新增 `export_sync_audit(format, event)`：JSON 输出美化数组，CSV 输出带表头并转义逗号/引号/换行 |
| A3 | 前端透传 | `listSyncAudit(limit, event)` 支持筛选；`exportSyncAudit` Tauri invoke，浏览器 fallback 从 localStorage 生成同格式文本 |
| A4 | System UI | Sync audit 面板新增事件筛选下拉框与 JSON / CSV 导出按钮，导出后显示事件数量 |
| A5 | 单元测试 | 覆盖按事件过滤、JSON 导出不含其他事件、CSV 转义与非法格式报错 |
| A6 | 自动化验证 | `verify:ui` / `verify:preview` 断言筛选后只剩目标事件、导出提示含事件数、Clear 后清空 |

## DoD 检查单

- [x] `cargo test --lib` 全绿，fmt、clippy、build 全绿。
- [x] 筛选与导出单测通过，CSV 特殊字符转义正确。
- [x] System UI 筛选与导出按钮可用，浏览器 fallback 语义一致。
- [x] `verify:ui` / `verify:preview` 新增筛选与导出断言，两条 lane 全绿。
- [x] PR 合并到 develop，RETRO 已更新，tag `v0.48.0-alpha`。

## 范围外（Backlog）

- 按文件规模动态调整索引并发。
- 三方合并策略与冲突自动化解决。
- watch 目标级事件隔离与独立增量统计。
- 审计按时间范围与设备 ID 组合筛选。
