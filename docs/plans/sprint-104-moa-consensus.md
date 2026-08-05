# Sprint 104 计划：MOA 三路共识摘要

目标：把 MOA 三路并行输出在流结束时汇聚为一条确定性的 `## MOA Consensus` 摘要块：共识关键词、分歧/独特观点、结论首行；Rust 与浏览器 fallback 同构实现，不新增数据库表或依赖。

## Sprint 104 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 共识生成 | 新增 `MoaConsensus` 与 `build_moa_consensus` Tauri 命令；`stream_ai_message(moa=true)` 收集三路最终文本并在 done 前 emit `## MOA Consensus` |
| R2 | 浏览器 fallback | `db.ts` 新增同构 `buildMoaConsensus`；`sendAiMessageStream` MOA 分支在全部流结束后 emit 相同摘要块 |
| R3 | AI Studio 展示 | MOA badge 状态改为 `3-way+summary`；Inspector Status 改为 `3-way consensus` 并展示 Consensus 摘要 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 的 `moaParallel` lane 断言 `## MOA Consensus`、共识点/结论文本；Rust 新增 1 条单测 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:preview` 全绿 |

## DoD 检查清单

- [x] MOA 流式输出结束后出现 `## MOA Consensus` 摘要块，且随主消息一起落库。
- [x] 摘要包含共识点、分歧/独特观点、结论三段，Rust 与浏览器 fallback 输出一致。
- [x] 单路失败不影响其他路，失败路以空输出参与摘要，取消时不追加摘要。
- [x] Rust 118 条单测通过，`cargo fmt` / `cargo clippy --lib -- -D warnings` 全绿。
- [x] `npm run build`、`npm run lint`、`npx prettier --check .`、`verify:preview` 全绿。
- [x] 无数据库表结构变更；PR 合并到 develop，RETRO / ARCHITECTURE / DATABASE 已更新，tag `v0.104.0-alpha`。

## 范围外（Backlog）

- Provider 权重 / 路由排序与跨路 token 预算控制。
- 会话消息内跳转与高亮定位。
- 拼音首字母 / 中文分词模糊匹配。
- Connection Layer（信号通知层）与 Monetization Workbench（创收工作台）继续搁置，后续有需要再开发。
