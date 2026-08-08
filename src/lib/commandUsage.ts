export type CommandUsageEntry = {
  id: string;
  count: number;
  lastAt: number;
};

export type CommandUsageMap = Record<string, CommandUsageEntry>;

const USAGE_KEY = 'ai-workbench:command-usage:v1';

export function loadCommandUsage(): CommandUsageMap {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CommandUsageEntry[];
    const map: CommandUsageMap = {};
    for (const entry of parsed) {
      if (entry && typeof entry.id === 'string' && typeof entry.count === 'number') {
        map[entry.id] = { id: entry.id, count: entry.count, lastAt: entry.lastAt ?? 0 };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function recordCommandUsage(id: string): CommandUsageMap {
  const usage = loadCommandUsage();
  const current = usage[id] ?? { id, count: 0, lastAt: 0 };
  const next: CommandUsageMap = {
    ...usage,
    [id]: { id, count: current.count + 1, lastAt: Date.now() },
  };
  try {
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify(Object.values(next).sort((a, b) => b.count - a.count)),
    );
  } catch {
    // Storage is best-effort; the in-memory map still drives this session's ranking.
  }
  return next;
}
