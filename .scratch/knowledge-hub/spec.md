# Knowledge Hub Spec
**Status:** ready-for-agent
## Problem Statement
用户在对话和写码中积累了大量有价值的 AI 解释、代码思路、踩坑记录，但这些内容散落在对话线程里，无法沉淀、检索、复用。需要一个知识中枢把这些产出结构化为笔记，对接 Obsidian Vault 形成持久知识库。
## Solution
在 AI Workbench 中新增知识中枢模块。对话中的任意消息可一键沉淀为 Markdown 笔记，直接写入 Obsidian Vault。笔记按项目+标签组织，三栏布局浏览，全局搜索快速检索。AI 自动推断标题和标签，也可手动编辑。
## User Stories
1. As a user, I want to click a "save" button on any chat message to instantly create a Markdown note in my Obsidian Vault, so that I can capture insights without leaving the conversation.
2. As a user, I want AI to auto-infer a title and tags for each saved note, so that I don't have to type metadata manually.
3. As a user, I want to browse notes grouped by project in the left sidebar, so that I can navigate my knowledge by context.
4. As a user, I want to filter notes by clicking tags in a tag cloud, so that I can cross-reference across projects.
5. As a user, I want a global search bar that filters notes in real-time, so that I can find anything instantly.
6. As a user, I want to click a note card to preview its Markdown content in a side panel, so that I can read without opening Obsidian.
7. As a user, I want to configure my Obsidian Vault path once in settings, so that the workbench knows where to write notes.
8. As a user, I want AI to proactively suggest "this might be worth saving" on insightful chat messages, so that I don't miss important learnings.
## Implementation Decisions
- **Storage**: Notes written as `.md` files with YAML frontmatter (title, date, project, tags) directly to the configured Obsidian Vault directory
- **Vault path**: Stored in Zustand `settingsStore`, configured via a settings modal. Default: empty, user must set before first save
- **Rust command**: `write_note(path, content)` — creates file at given path, writing the Markdown content
- **AI tag inference**: Heuristic-based — extracts key terms from message content (tech terms, concepts, proper nouns) as tag suggestions
- **Three-column layout**: Left sidebar (projects list + tag cloud), center (card grid filtered by project/tag), right panel (Markdown preview)
- **Search**: Client-side `String.includes()` across title/tags/content; real-time filter as user types
- **Auto-recommend**: Simple heuristic — messages longer than 200 chars with code blocks or bullet lists get a subtle "save?" indicator in chat
- **Settings**: Modal triggered from sidebar or top menu; persistent path stored in Zustand
- **Visual**: Consistent dark theme; note cards show title, first 2 lines of content, tags as chips, date
## Testing Decisions
- UI verified via manual visual verification in dev server (Vite HMR)
- Vault write verified by checking file system after save
- What makes a good test: save a message → file appears in Vault → note appears in card grid → search finds it → tag filter works
## Out of Scope
- Vector embeddings / RAG (future phase)
- Bidirectional sync with Obsidian (one-way write only)
- Full Markdown editor (use Obsidian for editing)
- Multi-Vault support (single configured path)
- Note version history or diff
## Further Notes
- Vault path must be an absolute path; validation checks directory exists before first write
- If path is not configured, "save to knowledge" buttons show a tooltip: "Configure Obsidian Vault path in settings"
- Notes follow Obsidian [[wikilink]] convention for cross-references (future enhancement)
