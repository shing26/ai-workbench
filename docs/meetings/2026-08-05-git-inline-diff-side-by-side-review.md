# 2026-08-05 行内着色 diff 与整文件对比评审

## 结论

- Rust 新增 `get_git_file_versions(path, file)` Tauri 命令：返回 `GitFileVersions { path, status, oldContent, newContent }`；tracked 文件从 `git show HEAD:file` 取旧内容、从磁盘读新内容，untracked 文件 old 为空，status 取 `git status --porcelain` 首行。
- 新增两条 Rust 单测：tracked 文件能同时返回 HEAD 与 worktree 内容；untracked 文件 old 为空且 status 以 `??` 开头。
- `db.ts` 新增 `GitFileVersions` 类型与 `getGitFileVersions`；浏览器 fallback 从既有 `getGitFileDiff` mock 反解 old / new 行，`verify:ui` / `verify:preview` 可稳定运行。
- 新增 `src/lib/diffHighlight.tsx`：`parseDiffLines` 输出 file / hunk / add / del / context 五类行；`detectLanguage` 按扩展名识别常见语言；`highlightLine` 用正则 token 识别注释、字符串、数字与关键字并输出 JSX span。
- ProjectsView diff 面板升级为行式渲染：`data-git-diff-line` / `data-git-diff-line-type` 携带行类型；顶部 `data-git-side-by-side-toggle` 在 Inline 与 Side by side 间切换，双栏使用 `data-git-file-version=old|new` 展示 HEAD / Working tree。
- `cargo test --lib` 97/97，fmt、clippy、`npm run build` 全绿；`verify:ui` / `verify:preview` 的 `gitInlineDiffSideBySide` 均为 true。

## 风险与后续

- 行内高亮是基于正则的轻量实现，不等同完整语言解析器；复杂语法可能出现误着色，但不会影响 diff 语义。
- Side by side 按文件整体读取，大文件双栏渲染存在性能风险；后续可加行数上限与懒加载。
- 真实 Provider 端到端流式联调、Vector Embedding RAG 继续留在 Backlog。
