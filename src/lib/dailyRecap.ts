import type { Habit, ScheduleEvent, Task } from "./db";

export type DailyRecapContext = {
  focusDone: number;
  focusTotal: number;
  habitDone: number;
  habitTotal: number;
  eventDone: number;
  eventTotal: number;
  overallDone: number;
  overallTotal: number;
};

export function buildDailyRecapContext(
  tasks: Task[],
  habits: Habit[],
  scheduleEvents: ScheduleEvent[],
): DailyRecapContext {
  const focusTasks = tasks.filter((t) => t.isToday).slice(0, 3);
  const focusDone = focusTasks.filter((t) => t.status === "done").length;
  const habitDone = habits.filter((h) => h.doneToday).length;
  const eventDone = scheduleEvents.filter((e) => e.done).length;
  const overallTotal = focusTasks.length + habits.length + scheduleEvents.length;
  const overallDone = focusDone + habitDone + eventDone;
  return {
    focusDone,
    focusTotal: focusTasks.length,
    habitDone,
    habitTotal: habits.length,
    eventDone,
    eventTotal: scheduleEvents.length,
    overallDone,
    overallTotal,
  };
}

export function buildDailyRecapPrompt(
  tasks: Task[],
  habits: Habit[],
  scheduleEvents: ScheduleEvent[],
): string {
  const ctx = buildDailyRecapContext(tasks, habits, scheduleEvents);
  const focusLines =
    tasks
      .filter((t) => t.isToday)
      .slice(0, 3)
      .map((t) => `- ${t.title} [${t.status}]`)
      .join("\n") || "- 暂无";
  const habitLines =
    habits.map((h) => `- ${h.name}${h.doneToday ? " [done]" : " [pending]"}`).join("\n") ||
    "- 暂无";
  const eventLines =
    scheduleEvents
      .map((e) => `- ${e.startTime} ${e.title}${e.done ? " [done]" : " [pending]"}`)
      .join("\n") || "- 暂无";
  return [
    "请帮我生成今日复盘。",
    "",
    "今日进度：",
    `- Focus ${ctx.focusDone}/${ctx.focusTotal}`,
    `- Habits ${ctx.habitDone}/${ctx.habitTotal}`,
    `- Schedule ${ctx.eventDone}/${ctx.eventTotal}`,
    `- Overall ${ctx.overallDone}/${ctx.overallTotal}`,
    "",
    "今日 Focus：",
    focusLines,
    "",
    "习惯：",
    habitLines,
    "",
    "日程：",
    eventLines,
    "",
    "要求：先总结完成情况，再指出一件可以做得更好的事，最后给出明天最重要的 3 件事。",
  ].join("\n");
}
