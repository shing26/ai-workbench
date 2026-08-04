# Design System

<!-- impeccable:design-schema 1 -->

## Visual World

**Linear-style dark dashboard.** Pure black foundation (#000), warm grayscale text ladder, single restrained accent (near-white). The workbench is a tool first — expression lives in precision, density, and micro-interaction, never in decoration.

## Color

- **Deepest surface:** #0a0a0a — sidebar, global nav
- **Mid surface:** #111111 — sub-navigation, secondary panels
- **Content surface:** #1a1a1a — main workspace, cards
- **Border:** #262626 — structural, visible hierarchy
- **Text primary:** #ededed — clean white, high contrast on dark
- **Text secondary:** #888888 — metadata, labels, timestamps
- **Text muted:** #555555 — placeholders, disabled
- **Accent:** #0ea5a5 (teal) — buttons, highlights, active states
- **Accent subtle:** rgba(14, 165, 165, 0.12) — hover, selected backgrounds
- **Semantic:** green (#22c55e), amber (#eab308), red (#ef4444)

Strategy: Restrained with one saturated accent. Three-tier grey surface system (0a/11/1a) creates depth without decoration. Teal accent is visible on dark ground, distinct from white text, reads as precision over minimalism.

## Typography

- **Primary:** Geist Sans (when available), fallback Segoe UI → system-ui → sans-serif
- **Code:** Geist Mono (when available), fallback system monospace
- **Scale:** 9px (badges/timestamps) → 10px (labels/meta) → 11px (body) → 13px (headings) → 15px (section titles)
- **Weight:** Regular (400) for body, Medium (500) for headings, Semibold (600) for emphasis
- **Anti-aliasing:** subpixel-antialiased on, crisp rendering

## Shape & Radius

- **Cards & panels:** rounded-xl (12px)
- **Buttons & inputs:** rounded-lg (8px)
- **Sidebar icons:** rounded-[10px]
- **Tags & badges:** rounded-full (pill)
- **Active indicators:** 2px rounded-r-full sidebar left-border

Single coherent system: no mixing of sharp and soft within the same surface.

## Motion

- **View transitions:** 120ms, cubic-bezier(0.25, 0, 0, 1) — snappy, no overshoot
- **Dropdowns & modals:** scale 0.96 → 1, 120ms ease-out
- **Press feedback:** active:scale-[0.98] or active:scale-95 on all interactive elements
- **Budget bar:** width transition 500ms for smooth fill
- **Hover:** background-color 150ms, no scale changes

## Spacing

- **Sidebar:** 56px wide, icon buttons 36px with 2px gap
- **TopBar:** 48px tall
- **Content padding:** 16px (p-4) standard
- **Card grid gap:** 12px
- **Section gutters:** border-b with px-4 py-3 headers

## Interactive States

- **Default:** text-muted on transparent background
- **Hover:** text-secondary on surface-hover background, 150ms transition
- **Active/press:** scale-[0.98] + background change, instant
- **Selected:** accent-subtle background with text-primary
- **Focus-visible:** 1px border-colored outline, 1px offset
- **Disabled:** opacity-30 or opacity-40, cursor-default

## Components

All components rebuilt in the pure-black vocabulary:
- Sidebar: icon grid with left-border active indicator
- TopBar: compact, no title weight, monochrome bell badge
- CommandPalette: glass-morphism overlay, keyboard-first
- Cards: 12px radius, 1px border, color-coded status dots
- Inputs: bg-tertiary fills, border-colored focus rings
- Dropdowns: bg-secondary panels with shadow-2xl + shadow-black/40
