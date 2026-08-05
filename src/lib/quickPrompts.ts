export type QuickPrompt = {
  id: string;
  label: string;
  category: string;
  text: string;
  custom?: boolean;
  order?: number;
  updatedAt?: number;
  createdAt?: number;
};

export type CustomQuickPrompt = QuickPrompt & {
  custom: true;
};

const QUICK_PROMPT_LS_KEY = "ai-workbench:quick-prompts:v1";
const QUICK_PROMPT_USAGE_LS_KEY = "ai-workbench:quick-prompt-usage:v1";

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "daily-recap",
    label: "Daily recap",
    category: "life",
    text: "帮我做今日复盘：先列出今天完成的事，再指出一件可以做得更好的事，最后给我明天最重要的 3 件事。",
  },
  {
    id: "week-plan",
    label: "Week plan",
    category: "work",
    text: "帮我规划本周：按工作、学习、生活三个维度各列 2 个可执行目标，并为每天安排一个优先项。",
  },
  {
    id: "summarize-notes",
    label: "Summarize notes",
    category: "work",
    text: "请把下面的笔记提炼成要点清单：保留结论、行动项和待确认问题，删除重复内容。",
  },
  {
    id: "draft-reply",
    label: "Draft reply",
    category: "work",
    text: "帮我起草一封简洁得体的中文回复，语气自然、不过度客套，保留对方的要点并给出明确结论。",
  },
  {
    id: "meal-plan",
    label: "Meal plan",
    category: "life",
    text: "帮我安排今天的一日三餐：优先本地当季食材，控制在简单易做的范围内，并给出备餐顺序。",
  },
  {
    id: "wind-down",
    label: "Wind down",
    category: "life",
    text: "给我一份 15 分钟的睡前放松清单，包含身体放松、环境调整和一句结束今天的话。",
  },
];

export function isCustomQuickPrompt(prompt: QuickPrompt): prompt is CustomQuickPrompt {
  return prompt.custom === true;
}

export function loadQuickPrompts(): QuickPrompt[] {
  return [...QUICK_PROMPTS, ...listCustomQuickPrompts()];
}

export function getQuickPromptUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(QUICK_PROMPT_USAGE_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "number" && value > 0),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

export function recordQuickPromptUsage(id: string): number {
  const usage = getQuickPromptUsage();
  const next = (usage[id] ?? 0) + 1;
  usage[id] = next;
  localStorage.setItem(QUICK_PROMPT_USAGE_LS_KEY, JSON.stringify(usage));
  return next;
}

export function loadQuickPromptsByUsage(): QuickPrompt[] {
  const usage = getQuickPromptUsage();
  return loadQuickPrompts()
    .map((prompt, index) => ({ prompt, index, count: usage[prompt.id] ?? 0 }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.prompt.order ?? a.index) - (b.prompt.order ?? b.index),
    )
    .map((entry) => entry.prompt);
}

export function listCustomQuickPrompts(): CustomQuickPrompt[] {
  try {
    const raw = localStorage.getItem(QUICK_PROMPT_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomQuickPrompt[];
    return Array.isArray(parsed) ? parsed.filter((prompt) => prompt && prompt.custom) : [];
  } catch {
    return [];
  }
}

export function addCustomQuickPrompt(
  label: string,
  category: "life" | "work",
  text: string,
): CustomQuickPrompt {
  const prompt: CustomQuickPrompt = {
    id: `custom-${Date.now()}`,
    label,
    category,
    text,
    custom: true,
    order:
      listCustomQuickPrompts().reduce(
        (max, existing) => Math.max(max, existing.order ?? 0),
        0,
      ) + 1,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
  localStorage.setItem(
    QUICK_PROMPT_LS_KEY,
    JSON.stringify([...listCustomQuickPrompts(), prompt]),
  );
  return prompt;
}

export function updateCustomQuickPrompt(
  id: string,
  label: string,
  category: string,
  text: string,
): CustomQuickPrompt {
  const prompts = listCustomQuickPrompts();
  const index = prompts.findIndex((prompt) => prompt.id === id);
  if (index < 0) throw new Error(`custom quick prompt not found: ${id}`);
  const updated: CustomQuickPrompt = {
    ...prompts[index],
    label,
    category,
    text,
    updatedAt: Date.now(),
  };
  prompts[index] = updated;
  localStorage.setItem(QUICK_PROMPT_LS_KEY, JSON.stringify(prompts));
  return updated;
}

export function reorderCustomQuickPrompts(ids: string[]): number {
  const prompts = listCustomQuickPrompts();
  const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const next = ids
    .map((id) => byId.get(id))
    .filter((prompt): prompt is CustomQuickPrompt => !!prompt)
    .map((prompt, index) => ({ ...prompt, order: index, updatedAt: Date.now() }));
  const remaining = prompts.filter((prompt) => !ids.includes(prompt.id));
  localStorage.setItem(QUICK_PROMPT_LS_KEY, JSON.stringify([...remaining, ...next]));
  return next.length;
}

export function deleteCustomQuickPrompt(id: string): void {
  localStorage.setItem(
    QUICK_PROMPT_LS_KEY,
    JSON.stringify(listCustomQuickPrompts().filter((prompt) => prompt.id !== id)),
  );
}
