# 2026-08-05 索引并发按规模自动规划评审

## 结论

- 新增纯函数 `plan_index_concurrency(file_count, large_file_count, cores)`：小文件集（≤32）顺序执行，中等文件集与大文件集（大文件 ≥8 个）上限 4，大文件集且以普通文件为主时最多按核数 1~16。
- `index_vault_files` 约定 `concurrency = 0` 表示 Auto，扫描后基于文件数与 `count_large_vault_files`（抽样前 64 个 >1MB 文件）自动规划；`IndexResult` 新增 `concurrency_used` 供 UI 回显。
- Knowledge Auto 模式改为向后端传 0，而不是前端提前透传推荐值；手动模式仍传 clamp 1~16，后端按文件数二次 clamp。
- 浏览器 fallback 按同一规则计算实际并发，保证两种运行环境显示一致。
- 验证覆盖：`cargo test --lib` 50/50，fmt、clippy、build 全绿；`verify:ui` / `verify:preview` 断言手动并发实际值在 1~2、Auto 索引实际值为 1。

## 风险与后续

- 大文件判定基于前 64 个文件元数据抽样，不遍历全量以避免额外 IO；后续可改为索引时统计真实字节数。
- watch 初始索引仍固定 4 并发，后续可复用同一自动规划入口。
