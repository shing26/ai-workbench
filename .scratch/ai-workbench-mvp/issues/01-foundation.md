# 01 — Foundation: fix config + Tailwind + dark theme

**What to build:** 修复 Tauri 配置并建立 Tailwind CSS 深色主题系统，使应用窗口以 1440x900 启动，标题显示 "AI Workbench"，页面背景为深色主题。

**Blocked by:** None — can start immediately.

**Status:** completed

- [ ] Fix `src-tauri/tauri.conf.json` identifier to `com.aiworkbench.desktop`
- [ ] Set window size to 1440x900, title to "AI Workbench"
- [ ] Configure `@tailwindcss/vite` plugin in `vite.config.ts`
- [ ] Add Tailwind CSS import to `src/main.tsx` or `src/index.css`
- [ ] Define dark theme CSS custom properties (background, surface, text, accent colors)
- [ ] Replace default template content with a minimal dark-themed root layout
- [ ] Update `index.html` title to "AI Workbench"
- [ ] Verify: `npm run dev` serves dark-themed page; `npm run build` passes
