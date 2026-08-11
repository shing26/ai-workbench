import { useSyncExternalStore } from 'react';

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

const LS_KEY = 'ai-workbench:locale:v1';

const DICT: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'app.subtitle': '一人公司 AI CPO 桌面操作系统',
    'app.allGreen': '全部通过',
    'app.checkFailed': '检查失败',
    'view.dashboard': '总览控制塔',
    'view.aiStudio': '需求论证 Canvas',
    'view.projects': '项目矩阵',
    'view.knowledge': '活体知识库',
    'view.actions': '交付终端',
    'view.system': '系统与自动化',
  },
  'en-US': {
    'app.subtitle': 'One-Person AI CPO Desktop OS',
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
    'app.subtitle': '一人会社 AI CPO デスクトップ OS',
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
