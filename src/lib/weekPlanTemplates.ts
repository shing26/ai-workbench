export type WeekPlanEvent = {
  title: string;
  time: string;
  tag: string;
};

export type WeekPlanDay = {
  focus: string[];
  events: WeekPlanEvent[];
};

export type WeekPlanTemplate = {
  id: string;
  name: string;
  days: WeekPlanDay[];
};

const WEEK_PLAN_TEMPLATES_LS_KEY = 'ai-workbench:week-plan-templates:v1';

export const DEFAULT_WEEK_PLAN_TEMPLATE: WeekPlanTemplate = {
  id: 'balanced-week',
  name: 'Balanced week',
  days: [
    {
      focus: ['Break down week goals', 'Morning review'],
      events: [
        { title: 'Daily review', time: '09:30', tag: 'routine' },
        { title: 'Week sync', time: '10:30', tag: 'work' },
      ],
    },
    {
      focus: ['Deep work 2h'],
      events: [{ title: 'Project sync', time: '14:00', tag: 'work' }],
    },
    {
      focus: ['Study 30m', 'Organize notes'],
      events: [{ title: 'Reading time', time: '20:00', tag: 'life' }],
    },
    {
      focus: ['Clear pending todos'],
      events: [{ title: 'Code review', time: '15:00', tag: 'work' }],
    },
    {
      focus: ['Draft week recap'],
      events: [{ title: 'Week plan review', time: '16:30', tag: 'routine' }],
    },
    {
      focus: ['Life tidy-up'],
      events: [{ title: 'Family time', time: '19:00', tag: 'life' }],
    },
    {
      focus: ['Preview next week'],
      events: [{ title: 'Wind down', time: '21:00', tag: 'life' }],
    },
  ],
};

export function loadWeekPlanTemplates(): WeekPlanTemplate[] {
  try {
    const raw = localStorage.getItem(WEEK_PLAN_TEMPLATES_LS_KEY);
    if (!raw) return [DEFAULT_WEEK_PLAN_TEMPLATE];
    const parsed = JSON.parse(raw) as WeekPlanTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_WEEK_PLAN_TEMPLATE];
    }
    const ids = new Set(parsed.map((t) => t.id));
    return ids.has(DEFAULT_WEEK_PLAN_TEMPLATE.id)
      ? parsed
      : [DEFAULT_WEEK_PLAN_TEMPLATE, ...parsed];
  } catch {
    return [DEFAULT_WEEK_PLAN_TEMPLATE];
  }
}

export function saveWeekPlanTemplates(templates: WeekPlanTemplate[]): void {
  localStorage.setItem(WEEK_PLAN_TEMPLATES_LS_KEY, JSON.stringify(templates));
}

export function weekPlanTemplateCounts(template: WeekPlanTemplate): {
  focusCount: number;
  eventCount: number;
} {
  return template.days.reduce(
    (acc, day) => ({
      focusCount: acc.focusCount + day.focus.filter((item) => item.trim()).length,
      eventCount: acc.eventCount + day.events.filter((item) => item.title.trim()).length,
    }),
    { focusCount: 0, eventCount: 0 },
  );
}
