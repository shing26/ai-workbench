# Sprint 107 计划：拼音/中文分词模糊搜索

目标：会话搜索支持中文全拼与拼音首字母模糊匹配，Rust 与浏览器 fallback 行为一致；命中消息时仍可跳转到对应消息并高亮。

## Sprint 107 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| R1 | Rust 拼音匹配 | 引入 `pinyin` crate；`text_match_score` 在原文匹配失败后依次尝试全拼与首字母，命中类型返回 `pinyin-title` / `pinyin-model` / `pinyin-message` |
| R2 | 浏览器 fallback | 引入 `pinyin-pro`；`db.ts` 使用同构 `textMatchScore`，结果与 Rust 一致 |
| R3 | AI Studio 交互 | 拼音消息命中时仍携带 `messageId`，点击后跳转并高亮 |
| R4 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `sessionPinyinSearch` lane：`mrjh` / `meirijihua` 命中标题，`mnhjd` 命中消息并跳转 |
| R5 | 完整验证 | `npm run build`、lint、prettier、`cargo fmt` / `cargo clippy` / `cargo test --lib`、`verify:ui` / `verify:preview` 全绿 |

## DoD 检查清单

- [x] 中文标题可用全拼 / 首字母命中，匹配类型明确标记为拼音。
- [x] 拼音消息命中可跳转并高亮。
- [x] Rust 120 条单测通过，双端验证 lane 覆盖拼音路径。
- [x] Connection Layer 与 Monetization Workbench 继续搁置，不纳入本 Sprint。
