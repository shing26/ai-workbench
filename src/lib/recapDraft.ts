export type RecapDraft = {
  date: string;
  content: string;
  saved: boolean;
  savedAt: number;
};

const RECAP_DRAFT_KEY = 'ai-workbench:recap-draft:v1';

export function loadRecapDraft(): RecapDraft | null {
  try {
    const raw = localStorage.getItem(RECAP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecapDraft;
    if (!parsed.content || !parsed.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRecapDraft(date: string, content: string): RecapDraft {
  const draft: RecapDraft = { date, content, saved: false, savedAt: Date.now() };
  localStorage.setItem(RECAP_DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

export function markRecapDraftSaved(draft: RecapDraft): RecapDraft {
  const next: RecapDraft = { ...draft, saved: true, savedAt: Date.now() };
  localStorage.setItem(RECAP_DRAFT_KEY, JSON.stringify(next));
  return next;
}
