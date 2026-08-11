export type TokenBudgetConfig = {
  monthlyLimit: number;
  monthKey: string;
  usedTokens: number;
  autoDegrade: boolean;
};

export type TokenBudgetStatus = TokenBudgetConfig & {
  pct: number;
  over: boolean;
  near: boolean;
};

export type TokenDayUsage = {
  day: string;
  tokens: number;
};

const LS_KEY = 'ai-workbench:token-budget:v1';
const HISTORY_LS_KEY = 'ai-workbench:token-history:v1';

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function loadTokenHistory(): TokenDayUsage[] {
  try {
    const raw = localStorage.getItem(HISTORY_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TokenDayUsage[];
      if (Array.isArray(parsed)) return parsed.slice(-60);
    }
  } catch {
    /* corrupt history falls back to empty */
  }
  return [];
}

export function recordTokenDayUsage(tokens: number): void {
  const day = dayKey();
  const history = loadTokenHistory();
  const existing = history.find((h) => h.day === day);
  if (existing) {
    existing.tokens += Math.max(0, Math.floor(tokens));
  } else {
    history.push({ day, tokens: Math.max(0, Math.floor(tokens)) });
  }
  localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(history.slice(-60)));
}

export function lastNDaysUsage(days: number, now = new Date()): TokenDayUsage[] {
  const history = loadTokenHistory();
  const points: TokenDayUsage[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d);
    const hit = history.find((h) => h.day === key);
    points.push({ day: key, tokens: hit?.tokens ?? 0 });
  }
  return points;
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function estimateTokens(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

export function loadTokenBudget(): TokenBudgetConfig {
  const current = monthKey();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TokenBudgetConfig>;
      const config: TokenBudgetConfig = {
        monthlyLimit:
          typeof parsed.monthlyLimit === 'number' && parsed.monthlyLimit > 0
            ? Math.floor(parsed.monthlyLimit)
            : 100_000,
        monthKey: parsed.monthKey ?? current,
        usedTokens:
          typeof parsed.usedTokens === 'number' && parsed.usedTokens > 0
            ? Math.floor(parsed.usedTokens)
            : 0,
        autoDegrade: parsed.autoDegrade !== false,
      };
      if (config.monthKey !== current) {
        config.monthKey = current;
        config.usedTokens = 0;
      }
      return config;
    }
  } catch {
    /* corrupt storage falls back to defaults */
  }
  return { monthlyLimit: 100_000, monthKey: current, usedTokens: 0, autoDegrade: true };
}

export function saveTokenBudget(config: TokenBudgetConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export function setTokenBudget(
  patch: Partial<Pick<TokenBudgetConfig, 'monthlyLimit' | 'autoDegrade'>>,
): TokenBudgetConfig {
  const next = { ...loadTokenBudget(), ...patch };
  saveTokenBudget(next);
  return next;
}

export function recordTokenUsage(tokens: number): TokenBudgetConfig {
  const next = loadTokenBudget();
  next.usedTokens += Math.max(0, Math.floor(tokens));
  saveTokenBudget(next);
  recordTokenDayUsage(tokens);
  return next;
}

export function resetTokenBudget(): TokenBudgetConfig {
  const next = loadTokenBudget();
  next.usedTokens = 0;
  saveTokenBudget(next);
  return next;
}

export function getBudgetStatus(config = loadTokenBudget()): TokenBudgetStatus {
  const pct =
    config.monthlyLimit > 0 ? Math.min((config.usedTokens / config.monthlyLimit) * 100, 100) : 0;
  return {
    ...config,
    pct,
    over: config.usedTokens >= config.monthlyLimit,
    near: pct >= 75,
  };
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}
