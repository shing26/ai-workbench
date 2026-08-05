import type { SessionSearchHit } from './db';

export type SessionSearchHistoryEntry = {
  query: string;
  at: number;
  hits: number;
};

export type SessionSearchStats = {
  totalHits: number;
  sessions: number;
  titleHits: number;
  modelHits: number;
  messageHits: number;
  pinyinHits: number;
  avgScore: number;
};

const HISTORY_KEY = 'ai-workbench:session-search-history:v1';
const HISTORY_LIMIT = 8;

export function loadSearchHistory(): SessionSearchHistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is SessionSearchHistoryEntry =>
            typeof entry?.query === 'string' && typeof entry?.at === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

export function recordSearchHistory(query: string, hits: number): SessionSearchHistoryEntry[] {
  const q = query.trim();
  if (!q) return loadSearchHistory();
  const next = [
    { query: q, at: Date.now(), hits },
    ...loadSearchHistory().filter((entry) => entry.query.toLowerCase() !== q.toLowerCase()),
  ].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearSearchHistory(): SessionSearchHistoryEntry[] {
  localStorage.removeItem(HISTORY_KEY);
  return [];
}

export function summarizeSearchHits(hits: SessionSearchHit[]): SessionSearchStats {
  const titleHits = hits.filter(
    (hit) => hit.matchType === 'title' || hit.matchType === 'pinyin-title',
  ).length;
  const modelHits = hits.filter(
    (hit) => hit.matchType === 'model' || hit.matchType === 'pinyin-model',
  ).length;
  const messageHits = hits.filter(
    (hit) => hit.matchType === 'message' || hit.matchType === 'pinyin-message',
  ).length;
  return {
    totalHits: hits.length,
    sessions: new Set(hits.map((hit) => hit.session.id)).size,
    titleHits,
    modelHits,
    messageHits,
    pinyinHits: hits.filter((hit) => hit.matchType.startsWith('pinyin-')).length,
    avgScore: hits.length
      ? Math.round(hits.reduce((sum, hit) => sum + hit.score, 0) / hits.length)
      : 0,
  };
}
