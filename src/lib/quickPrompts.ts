export type QuickPrompt = {
  id: string;
  label: string;
  category: "life" | "work";
  text: string;
};

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
