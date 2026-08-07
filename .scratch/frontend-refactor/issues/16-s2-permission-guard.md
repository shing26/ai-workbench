# 16 — S2-5: WorkbenchError + usePermissionGuard

**What to build:** 结构化错误协议 + 权限前端预检 hook（Rust 兜底裁决）。

**Blocked by:** P0-5（Rust 结构化错误返回）

**Status:** open

- [ ] `lib/errors.ts`：`class WorkbenchError extends Error { code: 'REQUIRES_CONFIRMATION' | 'PERMISSION_DENIED' | 'GENERIC'; rule?; payload? }`
- [ ] `db.ts` 统一 `parseWorkbenchError(e)` 包装 invoke 错误；fallback 层同构抛同类错误
- [ ] `hooks/usePermissionGuard.ts`：乐观预检（查 permission_rules 缓存），ask 直接渲染确认弹窗、deny 禁用按钮；最终裁决仍由 Rust 命令执行前做
- [ ] `components/ui/PermissionDialog.tsx`：确认/拒绝/详情；文案人性化（`PERMISSION_DENIED` → 用户可读 + 规则详情）
- [ ] 与 Toast 系统（S1-6）联动

**Definition of Done:** 错误可编程；前端预检即时 UX；Rust 兜底；绕过 UI 无效。
