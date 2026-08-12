import { describe, expect, it } from 'vitest';
import { formatTokens, getBudgetStatus } from './tokenBudget';

describe('tokenBudget helpers', () => {
  it('formats token counts compactly', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1200)).toBe('1.2k');
    expect(formatTokens(2_300_000)).toBe('2.3M');
  });

  it('reports over and near thresholds from monthly budget', () => {
    const normal = getBudgetStatus({
      monthlyLimit: 100_000,
      monthKey: '2026-08',
      usedTokens: 80_000,
      autoDegrade: false,
    });
    expect(normal.pct).toBe(80);
    expect(normal.near).toBe(true);
    expect(normal.over).toBe(false);

    const low = getBudgetStatus({
      monthlyLimit: 100_000,
      monthKey: '2026-08',
      usedTokens: 40_000,
      autoDegrade: false,
    });
    expect(low.pct).toBe(40);
    expect(low.near).toBe(false);

    const over = getBudgetStatus({
      monthlyLimit: 100_000,
      monthKey: '2026-08',
      usedTokens: 120_000,
      autoDegrade: false,
    });
    expect(over.pct).toBe(100);
    expect(over.over).toBe(true);
  });
});
