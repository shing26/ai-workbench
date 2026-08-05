export type ThemePreference = 'dark' | 'light' | 'system';
export type AccentName = 'emerald' | 'ocean' | 'iris' | 'amber' | 'sakura';

export const THEME_KEY = 'ai-workbench:theme';
export const ACCENT_KEY = 'ai-workbench:accent';
export const THEMES: ThemePreference[] = ['dark', 'light', 'system'];
export const ACCENTS: AccentName[] = ['emerald', 'ocean', 'iris', 'amber', 'sakura'];

export function readTheme(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY) as ThemePreference | null;
  return value && THEMES.includes(value) ? value : 'dark';
}

export function readAccent(): AccentName {
  const value = localStorage.getItem(ACCENT_KEY) as AccentName | null;
  return value && ACCENTS.includes(value) ? value : 'emerald';
}

export function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ThemePreference, accent: AccentName): void {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.dataset.theme = theme;
  root.dataset.themeResolved = resolved;
  root.dataset.accent = accent;
  root.style.colorScheme = resolved;
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // Storage can be unavailable in hardened Tauri webviews.
  }
}

export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const handler = () => onChange();
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
