# 2026-08-06 MOA 共识摘要评审

## 结论

- `MoaConsensus` 采用与 Team Summary 相同的本地确定性规则：首条有效行、跨输出关键词、分歧首行，不新增依赖、不新增数据库表。
- Rust `stream_ai_message(moa=true)` 的三路 `spawn_blocking` 现在返回各自最终文本，全部结束后在 done 前 emit `## MOA Consensus` 摘要块。
- 浏览器 fallback `sendAiMessageStream` 用同构 `buildMoaConsensusLocal` 生成相同摘要，取消时跳过摘要，保留 `done.cancelled = true`。
- AI Studio MOA badge 从 `3-way` 升级为 `3-way+summary`，Inspector 增加 `3-way consensus` 状态与 Consensus 摘要。
- `verify:ui` / `verify:preview` 的 `moaParallel` lane 新增 `consensusSeen` / `summaryText` 断言，三路 `maxActive = 3` 且共识块可见。

## 排查记录

- 首版关键词停用词表包含 `answer` / `answers`，导致 mock 三路共同词只剩 `part2`，Rust 单测断言 `answer` 失败；从停用词表移除后 Rust / TS 两侧规则一致。
- `stream_openai_compatible_with` / `stream_ollama_with` 返回值从 `()` 改为完整文本后，Rust 推断任务容器类型需要显式 `JoinHandle<Result<String, String>>`，补齐后编译通过。
- MOA 摘要选择追加在流内同一 run，随主消息一起落库，避免与 Team Summary 的独立气泡模式重复；Inspector 通过短暂等待 `run.content` 拿到摘要块。

## 风险与后续

- 共识摘要为纯本地规则，不经过模型二次总结；后续可把“模型共识裁判”作为可选增强排入 Backlog。
- Provider 权重 / 路由排序、会话消息内跳转、拼音模糊搜索仍在 Backlog。
- Connection Layer 与 Monetization Workbench 按用户要求继续搁置。
