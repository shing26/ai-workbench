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

const LS_KEY = 'ai-workbench:token-budget:v1';

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
