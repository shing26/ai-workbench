import { useSyncExternalStore } from 'react';

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

const LS_KEY = 'ai-workbench:locale:v1';

const DICT: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'app.subtitle': '本地优先 AI 工作台',
    'app.allGreen': '全部通过',
    'app.checkFailed': '检查失败',
    'view.dashboard': '控制塔',
    'view.aiStudio': 'AI Studio',
    'view.projects': '项目',
    'view.knowledge': '知识与收件箱',
    'view.actions': '行动与日程',
    'view.system': '系统与自动化',
  },
  'en-US': {
    'app.subtitle': 'Local-first AI Workbench',
    'app.allGreen': 'ALL GREEN',
    'app.checkFailed': 'CHECK FAILED',
    'view.dashboard': 'Dashboard',
    'view.aiStudio': 'AI Studio',
    'view.projects': 'Projects',
    'view.knowledge': 'Knowledge & Inbox',
    'view.actions': 'Actions & Schedule',
    'view.system': 'System & Automation',
  },
  'ja-JP': {
    'app.subtitle': 'ローカル優先 AI ワークベンチ',
    'app.allGreen': 'ALL GREEN',
    'app.checkFailed': 'CHECK FAILED',
    'view.dashboard': 'コントロールタワー',
    'view.aiStudio': 'AI Studio',
    'view.projects': 'プロジェクト',
    'view.knowledge': 'ナレッジと受信トレイ',
    'view.actions': '行動とスケジュール',
    'view.system': 'システムと自動化',
  },
};

let currentLocale: Locale = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === 'zh-CN' || raw === 'en-US' || raw === 'ja-JP') return raw;
  } catch {
    /* ignore */
  }
  return 'zh-CN';
})();

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(next: Locale): Locale {
  currentLocale = next;
  try {
    localStorage.setItem(LS_KEY, next);
  } catch {
    /* best effort */
  }
  emitChange();
  return next;
}

export function t(key: string): string {
  return DICT[currentLocale][key] ?? DICT['zh-CN'][key] ?? key;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const locale = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentLocale,
  );
  return { locale, setLocale };
}

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'EN' },
  { code: 'ja-JP', label: '日本語' },
];
