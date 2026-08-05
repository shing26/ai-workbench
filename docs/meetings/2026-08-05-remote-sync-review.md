# 2026-08-05 跨设备云端同步传输评审

## 结论

- `build_sync_snapshot` / `merge_sync_snapshot` 从本地文件导入导出中拆出，`export_sync_snapshot` / `import_sync_snapshot` 复用，文件与远端两条路径共享同一合并语义。
- `push_sync_snapshot(remote_url, token?)` 构建快照后 PUT JSON，可选 `Authorization: Bearer <token>`；`pull_sync_snapshot(remote_url, token?)` GET JSON 后按 `updated_at` 合并进 SQLite。
- 本地 `TcpListener` 端到端单测覆盖 Push 请求体 / Authorization 头与 Pull 解析合并；`cargo test --lib` 33/33，fmt、clippy、build 全绿。
- System Sync snapshot 卡片新增 Remote URL / Token 输入与 Push / Pull 按钮，浏览器 fallback 确定性返回结果；`verify:ui` / `verify:preview` 新增 Push / Pull 断言，两条 lane 全绿。

## 风险与后续

- 当前远端协议为明文 HTTP JSON，生产使用需搭配 HTTPS 或端到端加密，留在 Backlog。
- 定时自动同步、冲突 UI、三方合并策略仍未实现，作为下一阶段候选。
