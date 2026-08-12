# ADR-004: Journey Doc as Single Artifact（旅程文档单一产物）

部门论证只产出一个结构化 Markdown「旅程文档」，存放于项目 `docs/journey/`；Knowledge 卡片是它的索引视图，Actions 派发 CLI 时引用同一文档路径。不再并行维护独立的 Spec 与会议纪要，避免同一结论产生两份漂移。

**Considered Options**: 双产物（短 Spec 喂 CLI + 详细纪要进 Knowledge）；不生成文档、CLI 直接吃会话消息。
