# Backlog（v1.0 冻结范围候选池）

终点定义：冻结范围后的全部候选项完成 + `npm run build` / `npm run lint` / `npx prettier --check .` / `cargo fmt --check` / `cargo clippy --all-targets -- -D warnings` / `cargo test --lib` / `verify:ui` / `verify:preview` 全绿 + v1.0 发布文档。

已由用户确认：2026-08-06。

规则：每个 Sprint 从候选中选一项完成，验收后从池中移除；每完成一个 Sprint 接着进入下一个，直到候选池清空。

## 候选池（待开发）

- [ ] System：Provider 批量导入导出与 API Key 加密落库；流式请求超时配置与自动重试。
- [ ] System：模型能力元数据（context window / 价格 / 速率）、模型收藏与最近使用排序、`/models` 缓存与自动刷新。
- [ ] Sync：口令强度提示与确认框、多设备口令交换、密钥轮换与 salt 入库。
- [ ] RAG：命中来源跨文件选择器与“记住选择”偏好。
- [ ] Webhook：payload 高级模板（条件分支 / 循环）、schema 校验与自动补全、模板版本管理。
- [ ] AI Studio：复制会话携带消息版本历史；导出包含 RAG / Inspector Trace 辅助上下文。
- [ ] Knowledge：向量分片 / 近似索引。

## 已完成（从候选池移除）

- AI Studio：每条流独立取消与单路重试（Sprint 149）。
- Projects / Material：逐卡独立配色记忆（Sprint 148）。
- Projects：轮播拖拽排序与速度滑杆（Sprint 147）。
- Knowledge：语义聚类 / 文档去重（Sprint 146）。
- Knowledge：真实 Embedding 模型、向量增量后台重建与分片索引（Sprint 145）。
- 事件总线：持久化 event log、事件 schema 校验与跨设备事件转发（Sprint 144）。
- Webhook 多通道投递（邮件 / 系统通知）与熔断恢复指数退避调度（Sprint 143）。
- Webhook 复杂触发器条件表达式（cron / 事件匹配）与签名校验收发端 UI（Sprint 142）。
- Actions 周计划模板（Sprint 141）。
- Knowledge 双链补全编辑器提示（Sprint 140）。
- Webhook 规则执行日志与投递失败告警（Sprint 139）。
- Webhook 自动熔断（Sprint 138）。
- Webhook 投递保留策略（Sprint 134）、收益聚合展示（Sprint 136）、会话摘要（Sprint 137）。
- MOA 三路共识摘要（Sprint 104）、Provider 权重 / 路由排序（Sprint 105 前后）、跨流 token 预算（Sprint 107 前后）。
- 会话搜索模糊匹配 / 拼音 / 消息跳转 / 搜索历史统计 / 会话归档（Sprint 103-105、120-137 区间完成）。
- Webhook 事件触发器与投递队列（Sprint 96）、payload 模板（Sprint 98）、系统事件总线（Sprint 99）、签名与重试（Sprint 90）。
- 本地向量 RAG（Sprint 94）、Provider 模型发现（Sprint 97）、实时流式（Sprint 95）。

## 明确搁置（不纳入 v1.0）

- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）：用户明确后续有需要再开发。
