# 05 — P0-5: Destructive-op confirmation in Rust layer

**What to build:** 破坏性操作确认门下沉 Rust Tauri 命令层，绕过前端直接 invoke 也被拦截。

**Blocked by:** None — can start immediately.

**Status:** completed

**前置:** 为 Q8 结构化错误协议铺路（`RequiresConfirmation` / `PermissionDenied`）。

- [ ] 定义高风险动作注册表（删除文件、写外部资源、git push、发送/支付、批量清理）
- [ ] Rust 命令执行前查 `permission_rules`（先建最小表或常量规则集），ask → 返回 `RequiresConfirmation`，deny → 返回 `PermissionDenied`
- [ ] 错误返回结构化为 `{ code, message, rule }`（配合 Q8 WorkbenchError）
- [ ] 前端捕获结构化错误并渲染确认/拒绝提示
- [ ] verify lane：直接 invoke 危险命令 → 被 Rust 拦截有明确反馈

**Definition of Done:** 绕过 UI 直接调 IPC 无法执行危险操作；错误可编程。
