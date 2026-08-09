# 11 — S1-6: Toast/Snackbar feedback system

**What to build:** 统一保存/失败/拦截反馈，替代散落的内联 `data-*-result`。

**Blocked by:** None — can start immediately.

**Status:** open

- [ ] 新建 `lib/toast.ts` + `components/ui/Toast.tsx`（全局栈 + 自动过期）
- [ ] Toast 分级：success / error / info / warning，动效 <=150ms
- [ ] 收敛现有内联结果区：保存成功、操作失败、权限拦截（`RequiresConfirmation`/`PermissionDenied`）
- [ ] reduced-motion 降级

**Definition of Done:** 全应用反馈位置/样式统一；拦截有醒目提示。
