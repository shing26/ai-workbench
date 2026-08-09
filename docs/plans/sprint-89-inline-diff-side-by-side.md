# Sprint 89 计划：行内着色 diff 与整文件对比

目标：把 Projects 视图的 Git dirty diff 从纯文本 pre 升级为行级渲染：diff 行按 add / del / hunk / context 着色，并对代码关键字、字符串、注释做内联语法高亮；新增 Side by side 切换，按文件读取 HEAD 与 Working tree 整文件内容做双栏对比。

## Sprint 89 任务

| ID | 任务 | 验收标准 (AC) |
|---|---|---|
| A1 | Rust 版本读取命令 | 新增 get_git_file_versions(path, file)：返回 GitFileVersions { path, status, oldContent, newContent }；tracked 文件 old 用 git show HEAD:file，new 读磁盘；untracked old 为空，status 取 git status --porcelain 首行 |
| A2 | TS API | db.ts 新增 GitFileVersions 类型与 getGitFileVersions 异步 API；浏览器 fallback 从 getGitFileDiff mock 反解 old / new 行，保证 verify:ui / verify:preview 可运行 |
| A3 | 行级 diff 解析 | 新增 src/lib/diffHighlight.tsx：parseDiffLines 把 diff 文本分类为 file / hunk / add / del / context；detectLanguage 按扩展名识别 tsx / ts / rust / python / json / markdown / css / html / sql |
| A4 | 内联语法高亮 | highlightLine 基于正则 token 识别注释、字符串、数字与关键字，返回 JSX span；语言为 plain / markdown 时原样返回 |
| A5 | 前端交互 | ProjectsView diff 面板改为行方式渲染（data-git-diff-line / data-git-diff-line-type）；顶部新增 data-git-side-by-side-toggle，切换后加载版本内容并渲染 HEAD / Working tree 双栏（data-git-file-version=old|new） |
| A6 | 自动化验证 | verify:ui / verify:preview 新增 gitInlineDiffSideBySide lane：断言 inline 行类型集合含 add / del / hunk / context 且存在高亮 span；切换 side-by-side 后两栏有行号与内容；切回 inline 正常 |

## DoD 检查单

- [x] cargo fmt、cargo clippy --lib -- -Dwarnings、cargo test --lib 全绿（97/97）。
- [x] npm run build 全绿。
- [x] verify:ui / verify:preview 的 gitInlineDiffSideBySide 均为 true。
- [x] Rust 单测覆盖 tracked 文件 HEAD / worktree 内容读取与 untracked 空 old 行为。
- [x] PR 合并到 develop，RETRO 已更新，tag v0.89.0-alpha。

## 范围外（Backlog）

- 不做 diff 编辑能力与三向 merge 编辑器；对比仍为只读。
- 不做跨文件统一 diff 视图与提交阶段的行级 diff 选择；继续留在 Backlog。
- 不做真实 Provider 端到端流式联调；继续留在 Backlog。
