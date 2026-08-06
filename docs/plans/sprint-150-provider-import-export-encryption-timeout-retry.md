# Sprint 150 计划：Provider 批量导入导出 / API Key 加密 / 流式超时与自动重试

目标：Provider 配置可整批导出与导入，API Key 在 Rust 侧加密落库；每条 Provider 流式请求具备可配置超时与失败自动重试，浏览器 fallback 与 Tauri 链路行为一致。

## Sprint 150 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| P1 | API Key 加密落库 | app 启动时生成 / 读取 32 字节 AES-256 密钥（`provider.key`，hex）；创建与导入 Provider 时非空 API Key 用 AES-256-GCM 加密为 `enc:v1:<base64>` 写入 `api_key`，`api_key_encrypted=1`；列表 / 详情 / 流式命令读取时统一解密。 |
| P2 | 批量导入导出 | `export_providers` 返回 `{version:1, exportedAt, providers}`（解密后的明文 JSON）并复制到剪贴板；`import_providers` 接受数组或 `{providers:[]}`，逐项钳制字段、重新生成 id、加密 API Key 并整体替换；System Provider 工具栏提供 Export / Import 按钮与粘贴输入框。 |
| P3 | 流式超时配置 | `providers` 新增 `timeout_secs`（1~300，默认 30）；Rust `stream_client` 与浏览器 `streamProviderLive` 均按该值设置请求超时，超时报 `Request timeout: provider did not respond in time`。 |
| P4 | 自动重试 | `providers` 新增 `retry_count`（0~5，默认 1）与 `retry_delay_secs`（0~30，默认 1）；Rust 与浏览器均在未发出任何 chunk 前按 `retry_count` 重试，间隔 `retry_delay_secs`，已开始输出则不再重试；System Provider 卡片提供三个数值输入，blur / Enter 持久化。 |
| P5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `providerTimeout` / `providerRetry` / `providerConfigEdit` / `providerExport` / `providerImport` / `importedRetry` lanes；Sprint 149 lane seeding 显式补 `retryCount:0` 保持手动重试语义；Rust 单测覆盖迁移、加密、导入替换与超时 / 重试参数钳制。 |
| P6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合入 develop。 |

## DoD 检查单

- [x] 非空 API Key 不再明文落库，导出为明文 JSON，导入后重新加密并替换整批 Provider。
- [x] 流式请求超时按 Provider 配置生效，超时后错误可见且 busy 退出。
- [x] 首次请求失败时按重试次数与间隔自动重试，已产出内容的请求不重复重试。
- [x] System Provider 卡片可编辑 timeout / retries / delay 并持久化，reload 后恢复。
- [x] `verify:ui` / `verify:preview` 双端六条新 lane 全绿，Sprint 149 lane 语义未被破坏。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；其余候选留在候选池。
