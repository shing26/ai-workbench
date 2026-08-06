# Sprint 151 计划：模型能力元数据 / 收藏与最近使用 / `/models` 缓存自动刷新

目标：System Provider 模型下拉从“一次性探测”升级为本地模型目录：缓存模型列表、记录 context window / 价格 / 速率能力元数据，支持收藏与最近使用排序，并按 TTL 自动刷新。

## Sprint 151 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| M1 | 模型目录表 | SQLite 新增 `model_metadata`：`(provider_id, model_id)` 联合主键，`owned_by / context_window / input_price_per_mtok / output_price_per_mtok / rate_tpm / rate_rpm / is_favorite / last_used_at / fetched_at / updated_at`；Rust 提供 upsert / list / update meta / favorite / touch usage 函数，排序为收藏优先、最近使用其次、id 升序。 |
| M2 | Rust 命令 | 新增 `list_cached_provider_models` / `refresh_provider_models` / `update_provider_model_meta` / `set_provider_model_favorite` / `touch_provider_model_usage`；refresh 复用真实 `/models` / `/api/tags` 探测并 upsert，保留已填写的元数据与收藏。 |
| M3 | 浏览器 fallback | `ai-workbench:db:v1` 新增 `modelCache`（按 providerId 分组的模型目录）；`refreshProviderModels` 合并探测结果并刷新 `fetchedAt`，`listCachedProviderModels` 同构排序；TTL 为 24 小时。 |
| M4 | System UI | System Provider 卡片自动加载缓存并自动刷新过期缓存；模型下拉展示 `ctx / 价格 / TPM` 徽标、收藏星标与元数据编辑面板；选择模型时记录最近使用并即时重排。 |
| M5 | 自动化验证 | `verify:ui` / `verify:preview` 新增 `providerModelCatalog` lane：种子 stale 缓存触发自动刷新，断言初始排序、收藏重排、选择后最近使用排序、元数据编辑持久化与 `fresh` 状态；Rust 新增 `model_metadata_cache_lifecycle_sorts_by_favorite_then_recent` 单测，总数增至 183。 |
| M6 | 文档与合并 | BACKLOG 移除该项并记入已完成；RETRO / ARCHITECTURE / DATABASE 同步；八道质量门全绿后合入 develop。 |

## DoD 检查单

- [x] `model_metadata` 表可持久化模型能力元数据、收藏与最近使用时间，排序规则稳定。
- [x] `/models` 结果写入本地缓存，stale 缓存进入 System 视图自动刷新，手动 Detect 也走同一刷新链路。
- [x] 模型选项按收藏、最近使用、id 排序；选择模型后 `lastUsedAt` 更新并立即重排。
- [x] context window / 输入输出价格 / TPM / RPM 可编辑并持久化，选项行展示能力徽标。
- [x] 浏览器 fallback 与 Tauri 链路行为一致，`modelCache` 不破坏既有 localStorage 结构。
- [x] `verify:ui` / `verify:preview` 的 `providerModelCatalog` lane 双端通过；Rust 单测 183/183。
- [x] 八道质量门全绿。
- [x] PR 合入 develop，BACKLOG / RETRO / ARCHITECTURE / DATABASE 已更新。

## 范围外（Backlog）

- Connection Layer 与 Monetization Workbench 继续搁置；其余候选留在候选池。
