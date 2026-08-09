# 17 — S2-6: Trace-correlated error UI

**What to build:** 错误日志按 trace_id 贯通 + 错误文案人性化。

**Blocked by:** P0-5（Rust 侧 trace 透传）/ S1-4（事件流带 traceId）

**Status:** open

- [ ] `ErrorLogCard`（S2-2 产物）增加按 `trace_id` 过滤
- [ ] `lib/errorCopy.ts`：错误码/已知异常 → 用户可读文案映射（如 `Cannot redefine property: ethereum` → 「插件冲突，请重启应用」）
- [ ] 异常消息按 `WorkbenchError.code` 分级展示（S2-5）

**Definition of Done:** 一次 run 的错误可按 trace 聚合查看；技术化报错转为可读提示。
