import {
  ArchiveRestore,
  CalendarDays,
  Check,
  Flame,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as db from '../lib/db';
import { loadWeekPlanTemplates, weekPlanTemplateCounts } from '../lib/weekPlanTemplates';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';
import BentoCard from '../components/ui/BentoCard';
import StatPill from '../components/ui/StatPill';
import { resetTilt, tiltCard } from '../lib/tilt';

const HABIT_COLORS = ['emerald', 'blue', 'amber', 'rose'] as const;

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
}

function formatArchiveTime(ms: number | null | undefined): string {
  if (!ms) return '';
  const date = new Date(ms);
  return `${dayKey(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const colorClass: Record<
  (typeof HABIT_COLORS)[number],
  { dot: string; active: string; ring: string }
> = {
  emerald: {
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    ring: 'ring-emerald-500/40',
  },
  blue: {
    dot: 'accent-dot accent-shadow',
    active: 'accent-border accent-bg-10 accent-text-strong',
    ring: 'accent-ring',
  },
  amber: {
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    active: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    ring: 'ring-amber-500/40',
  },
  rose: {
    dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
    active: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    ring: 'ring-rose-500/40',
  },
};

export default function ActionsView() {
  const tasks = useWorkbenchStore((s) => s.tasks);
  const habits = useWorkbenchStore((s) => s.habits);
  const scheduleEvents = useWorkbenchStore((s) => s.scheduleEvents);
  const addTask = useWorkbenchStore((s) => s.addTask);
  const setTaskStatus = useWorkbenchStore((s) => s.setTaskStatus);
  const setTaskToday = useWorkbenchStore((s) => s.setTaskToday);
  const setTaskDueDate = useWorkbenchStore((s) => s.setTaskDueDate);
  const updateTaskTitle = useWorkbenchStore((s) => s.updateTaskTitle);
  const deleteTask = useWorkbenchStore((s) => s.deleteTask);
  const addHabit = useWorkbenchStore((s) => s.addHabit);
  const toggleHabit = useWorkbenchStore((s) => s.toggleHabit);
  const updateHabitWeekGoal = useWorkbenchStore((s) => s.updateHabitWeekGoal);
  const deleteHabit = useWorkbenchStore((s) => s.deleteHabit);
  const addScheduleEvent = useWorkbenchStore((s) => s.addScheduleEvent);
  const applyWeekPlan = useWorkbenchStore((s) => s.applyWeekPlan);
  const toggleEventDone = useWorkbenchStore((s) => s.toggleEventDone);
  const setActionContext = useWorkbenchStore((s) => s.setActionContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);

  const [title, setTitle] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitGoal, setHabitGoal] = useState(5);
  const [habitColor, setHabitColor] = useState<(typeof HABIT_COLORS)[number]>('emerald');
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('12:00');
  const [eventTag, setEventTag] = useState('work');
  const [eventDate, setEventDate] = useState(dayKey(new Date()));
  const [weekPlanTemplates] = useState(() => loadWeekPlanTemplates());
  const [weekPlanTemplateId, setWeekPlanTemplateId] = useState(
    () => loadWeekPlanTemplates()[0]?.id ?? 'balanced-week',
  );
  const [weekPlanResult, setWeekPlanResult] = useState('');
  const [selectedDay, setSelectedDay] = useViewState('actions', 'selectedDay', dayKey(new Date()));
  const [habitGoalEdits, setHabitGoalEdits] = useState<Record<string, string>>({});
  const [habitEditId, setHabitEditId] = useState<string | null>(null);
  const [habitEditResults, setHabitEditResults] = useState<Record<string, string>>({});
  const [habitDeleteId, setHabitDeleteId] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState('');
  const [taskRenameId, setTaskRenameId] = useState<string | null>(null);
  const [taskRenameDraft, setTaskRenameDraft] = useState('');
  const [taskDeleteId, setTaskDeleteId] = useState<string | null>(null);
  const [archiveConfirming, setArchiveConfirming] = useState(false);
  const fastInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<db.Task[]>([]);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(-1);
  const [breakdownTask, setBreakdownTask] = useState<db.Task | null>(null);

  const todayTasks = tasks.filter((t) => t.isToday).slice(0, 3);
  const list = todayOnly ? tasks.filter((t) => t.isToday) : tasks;
  listRef.current = list;
  const todayDone = todayTasks.filter((t) => t.status === 'done').length;
  const focusProgress = Math.min(todayDone / 3, 1);
  const now = new Date();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const current = listRef.current;
      const key = e.key.toLowerCase();
      if (key === 'n' || key === '/') {
        e.preventDefault();
        fastInputRef.current?.focus();
        return;
      }
      if (current.length === 0) return;
      if (key === 'j' || key === 'k') {
        e.preventDefault();
        setFocusedTaskIndex((prev) => {
          const delta = key === 'j' ? 1 : -1;
          return (prev + delta + current.length) % current.length;
        });
      } else if (key === 'x') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) void setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done');
      } else if (key === 'p') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) void setTaskToday(task.id, !task.isToday);
      } else if (key === 'a') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) setBreakdownTask(task);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedTaskIndex, setTaskStatus, setTaskToday]);
  const recentDayKeys = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
    return dayKey(d);
  });
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return dayKey(d);
  });
  const todayKey = dayKey(now);
  const selectedWeekPlan =
    weekPlanTemplates.find((template) => template.id === weekPlanTemplateId) ??
    weekPlanTemplates[0] ??
    null;
  const weekPlanCounts = selectedWeekPlan
    ? weekPlanTemplateCounts(selectedWeekPlan)
    : { focusCount: 0, eventCount: 0 };
  const weekTasks = tasks.filter((t) => (t.dueDate ? weekDays.includes(t.dueDate) : t.isToday));
  const weekDone = weekTasks.filter((t) => t.status === 'done').length;
  const weekProgress = weekTasks.length > 0 ? weekDone / weekTasks.length : 0;
  const weekDayStats = weekDays.map((key) => {
    const dayList = tasks.filter(
      (t) => t.dueDate === key || (!t.dueDate && t.isToday && key === todayKey),
    );
    return {
      key,
      total: dayList.length,
      done: dayList.filter((t) => t.status === 'done').length,
    };
  });
  let bestDay: { key: string; total: number; done: number } | null = null;
  for (const day of weekDayStats) {
    if (
      !bestDay ||
      day.done > bestDay.done ||
      (day.done === bestDay.done && weekDays.indexOf(day.key) < weekDays.indexOf(bestDay.key))
    ) {
      bestDay = day;
    }
  }
  const bestDayLabel = bestDay
    ? `${WEEKDAY_LABELS[weekDays.indexOf(bestDay.key)]} ${bestDay.done}/${bestDay.total}`
    : '—';
  let weekStreak = 0;
  for (let i = weekDays.length - 1; i >= 0; i -= 1) {
    const dayList = tasks.filter(
      (t) => t.dueDate === weekDays[i] || (!t.dueDate && t.isToday && weekDays[i] === todayKey),
    );
    if (dayList.length === 0) continue;
    if (dayList.every((t) => t.status === 'done')) weekStreak += 1;
    else break;
  }
  const dayTasks = tasks.filter(
    (t) => t.dueDate === selectedDay || (!t.dueDate && t.isToday && selectedDay === dayKey(now)),
  );
  const archived = tasks
    .filter((t) => t.status === 'done' && t.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 6);
  const habitDone = habits.filter((h) => h.doneToday).length;
  const eventDone = scheduleEvents.filter((e) => e.done).length;
  const nextEvent = scheduleEvents.find((e) => !e.done);
  const totalItems = todayTasks.length + habits.length + scheduleEvents.length;
  const doneItems = todayDone + habitDone + eventDone;
  const overallProgress = totalItems > 0 ? doneItems / totalItems : 0;

  const add = async () => {
    if (!title.trim()) return;
    const words = title.trim().split(/\s+/);
    const projTag = words.find((w) => w.startsWith('#proj-'));
    const isDod = words.some((w) => w.toLowerCase() === '#dod' || w.toLowerCase() === '#dod');
    const projectId = projTag ? projTag.replace('#proj-', '') : null;
    const cleanTitle = words
      .filter((w) => !w.startsWith('#proj-') && w.toLowerCase() !== '#dod')
      .join(' ');
    await addTask(cleanTitle || '（任务）', true, projectId, isDod);
    setTitle('');
  };

  const addHabitItem = async () => {
    if (!habitName.trim()) return;
    await addHabit(habitName.trim(), habitGoal, habitColor);
    setHabitName('');
    setHabitGoal(5);
  };

  const startHabitGoalEdit = (habit: db.Habit) => {
    setHabitEditId(habit.id);
    setHabitGoalEdits((prev) => ({ ...prev, [habit.id]: String(habit.weekGoal) }));
    setHabitEditResults((prev) => ({ ...prev, [habit.id]: '' }));
  };

  const saveHabitGoal = async (habit: db.Habit) => {
    const parsed = Number(habitGoalEdits[habit.id]);
    const goal = Number.isFinite(parsed)
      ? Math.max(1, Math.min(31, Math.round(parsed)))
      : habit.weekGoal;
    await updateHabitWeekGoal(habit.id, goal);
    setHabitEditId(null);
    setHabitEditResults((prev) => ({ ...prev, [habit.id]: 'Saved' }));
  };

  const confirmDeleteHabit = async (habit: db.Habit) => {
    await deleteHabit(habit.id, true);
    setHabitDeleteId(null);
  };

  const addEventItem = async () => {
    if (!eventTitle.trim()) return;
    await addScheduleEvent(eventTitle.trim(), eventTime, eventTag, eventDate);
    setEventTitle('');
  };

  const applyWeekPlanTemplate = async () => {
    if (!selectedWeekPlan) return;
    setWeekPlanResult('Applying...');
    const result = await applyWeekPlan(selectedWeekPlan, weekDays, todayKey);
    setWeekPlanResult(`Applied ${result.focusCount} focus + ${result.eventCount} events`);
  };

  const archiveWeekDone = async () => {
    if (!archiveConfirming) {
      setArchiveConfirming(true);
      setArchiveResult('');
      return;
    }
    setArchiveConfirming(false);
    const doneTasks = weekTasks.filter((t) => t.status === 'done');
    for (const t of doneTasks) {
      await setTaskToday(t.id, false);
      await setTaskDueDate(t.id, null);
    }
    setArchiveResult(doneTasks.length > 0 ? `Archived ${doneTasks.length}` : 'Nothing to archive');
  };

  const discussTask = (task: db.Task) => {
    setActionContext({
      taskId: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      isToday: task.isToday,
      mountedAt: Date.now(),
    });
    setActiveView('ai-studio');
  };

  return (
    <div className="view-enter mx-auto grid w-full max-w-7xl grid-cols-12 gap-4 overflow-y-auto p-4">
      {breakdownTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBreakdownTask(null)}
            aria-hidden="true"
          />
          <div
            data-ai-breakdown
            className="relative w-[420px] max-w-[94vw] rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                  AI 3 步拆解
                </div>
                <div className="truncate text-xs font-medium text-slate-200">
                  {breakdownTask.title}
                </div>
              </div>
              <button
                type="button"
                data-ai-breakdown-close
                onClick={() => setBreakdownTask(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                aria-label="Close breakdown"
              >
                <X size={13} />
              </button>
            </div>
            <div className="mb-3 space-y-1.5">
              {[
                `1. 拆解：${breakdownTask.title} → 明确输入、约束与验收标准`,
                `2. 落地：识别改动文件与调用链，按模块小步实现`,
                `3. 验证：补充测试 / 检查 tsc & lint，确认 DoD 完成`,
              ].map((step, idx) => (
                <div
                  key={idx}
                  data-ai-breakdown-step={idx + 1}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400"
                >
                  {step}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-ai-breakdown-dispatch
                onClick={() => {
                  const task = breakdownTask;
                  setBreakdownTask(null);
                  discussTask(task);
                }}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30"
              >
                <Sparkles size={12} /> 一键投递 AI Studio
              </button>
            </div>
          </div>
        </div>
      )}
      <BentoCard
        title="Today progress"
        subtitle="Focus · Habits · Schedule"
        icon={ListChecks}
        colSpan={12}
      >
        <div data-daily-progress className="space-y-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <div data-daily-focus={`${todayDone}/${todayTasks.length}`} className="min-w-0">
              <StatPill label="Focus" value={`${todayDone}/${todayTasks.length}`} tone="green" />
            </div>
            <div data-daily-habits={`${habitDone}/${habits.length}`} className="min-w-0">
              <StatPill label="Habits" value={`${habitDone}/${habits.length}`} tone="blue" />
            </div>
            <div data-daily-schedule={`${eventDone}/${scheduleEvents.length}`} className="min-w-0">
              <StatPill
                label="Schedule"
                value={`${eventDone}/${scheduleEvents.length}`}
                tone="neutral"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                data-daily-progress-bar
                className="progress-strip-inner h-full rounded-full bg-emerald-400/80"
                style={{ transform: `scaleX(${overallProgress})` }}
              />
            </div>
            <span data-daily-overall className="font-mono text-[10px] text-slate-500">
              {doneItems}/{totalItems}
            </span>
          </div>
          <div data-daily-next-event className="truncate text-[11px] text-slate-400">
            Next: {nextEvent ? `${nextEvent.startTime} ${nextEvent.title}` : 'Nothing scheduled'}
          </div>
        </div>
      </BentoCard>

      <BentoCard title="Today Focus" subtitle="今日 3 件事" icon={Target} colSpan={8}>
        <div className="mb-3 grid grid-cols-7 gap-1">
          {weekDays.map((key, i) => {
            const dayList = tasks.filter((t) => t.dueDate === key);
            const doneCount = dayList.filter((t) => t.status === 'done').length;
            const allDone = dayList.length > 0 && doneCount === dayList.length;
            const isSelected = selectedDay === key;
            const isToday = key === dayKey(now);
            return (
              <button
                key={key}
                type="button"
                data-focus-week-day={key}
                data-focus-day-done={allDone ? 'true' : 'false'}
                onClick={() => setSelectedDay(key)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] transition-colors ${
                  isSelected
                    ? 'accent-border accent-bg-15 accent-text-strong'
                    : 'border-white/10 bg-white/[0.03] text-slate-500 hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex items-center gap-1">
                  {WEEKDAY_LABELS[i]}
                  {isToday && <span className="rounded bg-white/10 px-1">T</span>}
                </span>
                <span className="font-mono text-[9px] opacity-70">{formatDayLabel(key)}</span>
                <span className="flex h-3.5 items-center gap-0.5 text-slate-400">
                  {dayList.length > 0 ? (
                    <>
                      <span className="font-mono">
                        {doneCount}/{dayList.length}
                      </span>
                      {allDone && <Check size={9} className="text-emerald-400" />}
                    </>
                  ) : (
                    <span className="text-slate-700">-</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-focus-week-bar
              className="progress-strip-inner h-full rounded-full accent-bg"
              style={{ transform: `scaleX(${weekProgress})` }}
            />
          </div>
          <span data-focus-week-total className="font-mono text-[10px] text-slate-500">
            week {weekDone}/{weekTasks.length}
          </span>
        </div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="progress-strip-inner h-full rounded-full bg-emerald-400/80"
            style={{ transform: `scaleX(${focusProgress})` }}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {dayTasks.map((t) => (
            <div
              key={t.id}
              data-task-row={t.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                t.status === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <button
                type="button"
                onClick={() => void setTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                aria-label={`Toggle ${t.title}`}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                  t.status === 'done'
                    ? 'check-pop border-emerald-500/40 bg-emerald-500/20'
                    : 'border-white/20'
                }`}
              >
                {t.status === 'done' && <Check size={11} />}
              </button>
              <div className="min-w-0 flex-1">
                {taskRenameId === t.id ? (
                  <input
                    data-task-rename-input
                    value={taskRenameDraft}
                    onChange={(e) => setTaskRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = taskRenameDraft.trim();
                        if (value) void updateTaskTitle(t.id, value);
                        setTaskRenameId(null);
                      } else if (e.key === 'Escape') {
                        setTaskRenameId(null);
                      }
                    }}
                    autoFocus
                    className="w-full rounded-md border border-emerald-500/40 bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-slate-200 outline-none"
                  />
                ) : (
                  <>
                    <div className="truncate">{t.title}</div>
                    <span className="mt-0.5 block font-mono text-[9px] text-slate-600">
                      {t.dueDate ? formatDayLabel(t.dueDate) : dayKey(now)}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                data-task-rename
                aria-label={`Rename ${t.title}`}
                onClick={() => {
                  setTaskRenameId(t.id);
                  setTaskRenameDraft(t.title);
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                data-action-discuss={t.id}
                data-action-discuss-title={t.title}
                aria-label={`AI break down ${t.title}`}
                onClick={() => discussTask(t)}
                className="flex h-6 shrink-0 items-center gap-1 rounded-lg bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
                title="AI 拆解 / 讨论任务"
              >
                <Sparkles size={10} /> AI
              </button>
              {taskDeleteId === t.id ? (
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-1.5 py-1">
                  <span className="text-[9px] text-rose-300">Delete?</span>
                  <button
                    type="button"
                    data-task-delete-confirm
                    aria-label={`Confirm delete ${t.title}`}
                    onClick={() => void deleteTask(t.id, true)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-rose-300 hover:bg-rose-500/20"
                  >
                    <Check size={10} />
                  </button>
                  <button
                    type="button"
                    data-task-delete-cancel
                    aria-label="Cancel delete"
                    onClick={() => setTaskDeleteId(null)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-slate-400 hover:bg-white/10"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-task-delete
                  aria-label={`Delete ${t.title}`}
                  onClick={() => setTaskDeleteId(t.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              )}
              <button
                type="button"
                data-task-next-day={t.id}
                aria-label={`Move ${t.title} to next day`}
                onClick={() => {
                  const nextIndex = weekDays.indexOf(dayKey(now));
                  const next = weekDays[(nextIndex + 1) % weekDays.length];
                  void setTaskDueDate(t.id, next);
                  if (t.isToday) void setTaskToday(t.id, false);
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
                title="Move to tomorrow"
              >
                <CalendarDays size={11} />
              </button>
            </div>
          ))}
          {dayTasks.length < 3 && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-[11px] text-slate-600">
              {selectedDay === dayKey(now) ? 'Add up to 3 focus items' : 'No focus on this day'}
            </div>
          )}
        </div>
        {archived.length > 0 && (
          <details
            data-focus-archive
            className="mt-3 rounded-xl border border-white/10 bg-white/[0.02]"
          >
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[11px] text-slate-400 hover:text-slate-300">
              <ArchiveRestore size={12} />
              <span data-focus-archive-count>Completed archive · {archived.length}</span>
            </summary>
            <div className="flex flex-col gap-1 border-t border-white/5 p-2">
              {archived.map((t) => (
                <div
                  key={t.id}
                  data-focus-archive-row
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-300">{t.title}</span>
                  <span className="font-mono text-[9px] text-slate-600">
                    {formatArchiveTime(t.completedAt)}
                  </span>
                  <button
                    type="button"
                    data-focus-archive-restore
                    aria-label={`Restore ${t.title}`}
                    onClick={() => {
                      void setTaskStatus(t.id, 'todo');
                      void setTaskDueDate(t.id, null);
                      void setTaskToday(t.id, true);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-slate-300"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </BentoCard>

      <BentoCard title="Habits" subtitle="打卡与连续天数" icon={Flame} colSpan={4}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addHabitItem();
              }
            }}
            placeholder="New habit..."
            className="h-8 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <div className="flex items-center gap-1">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Habit color ${c}`}
                onClick={() => setHabitColor(c)}
                className={`h-4 w-4 rounded-full ${colorClass[c].dot} ${habitColor === c ? `ring-2 ${colorClass[c].ring}` : 'opacity-50 hover:opacity-80'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void addHabitItem()}
            className="flex h-8 items-center gap-1 rounded-xl bg-emerald-500/20 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
            aria-label="Add habit"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {habits.map((h) => {
            const tone = colorClass[h.color] ?? colorClass.emerald;
            const recentSet = new Set(h.recentLogs ?? []);
            const weekCount = recentDayKeys.slice(7).filter((key) => recentSet.has(key)).length;
            return (
              <div
                key={h.id}
                className={`message-in flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                  h.doneToday ? tone.active : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <button
                  type="button"
                  data-habit-toggle
                  onClick={() => void toggleHabit(h.id)}
                  aria-label={`Toggle ${h.name}`}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${
                    h.doneToday
                      ? 'check-pop border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                      : 'border-white/20 text-transparent hover:border-white/40'
                  }`}
                >
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-xs ${
                        h.doneToday ? 'text-current' : 'text-slate-300'
                      }`}
                    >
                      {h.name}
                    </span>
                    <span
                      data-habit-week={`${weekCount}/${h.weekGoal}`}
                      className="shrink-0 font-mono text-[9px] text-slate-500"
                    >
                      周 {weekCount}/{h.weekGoal}
                    </span>
                  </div>
                  {habitEditId === h.id && (
                    <div
                      data-habit-week-editor={h.id}
                      className="mb-1 mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1"
                    >
                      <span className="text-[9px] text-slate-500">Week goal</span>
                      <input
                        data-habit-week-input={h.id}
                        type="number"
                        min="1"
                        max="31"
                        value={habitGoalEdits[h.id] ?? String(h.weekGoal)}
                        onChange={(e) =>
                          setHabitGoalEdits((prev) => ({ ...prev, [h.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveHabitGoal(h);
                          }
                        }}
                        className="h-6 w-12 rounded-md border border-white/10 bg-black/20 px-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500/40"
                      />
                      <button
                        type="button"
                        data-habit-week-save={h.id}
                        onClick={() => void saveHabitGoal(h)}
                        className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Check size={10} /> Save
                      </button>
                      <button
                        type="button"
                        data-habit-week-cancel={h.id}
                        onClick={() => setHabitEditId(null)}
                        className="h-6 rounded-md border border-white/10 px-1.5 text-[9px] text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <div
                    data-habit-recent-days
                    className="mt-1 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]"
                  >
                    {recentDayKeys.map((key) => {
                      const checked = recentSet.has(key);
                      return (
                        <span
                          key={key}
                          data-habit-day={key}
                          data-habit-day-checked={checked ? 'true' : 'false'}
                          className={`h-1.5 rounded-[2px] ${
                            checked ? tone.dot : 'bg-white/[0.06]'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {h.doneToday ? '今天已打卡' : `本周目标 ${h.weekGoal} 次`}
                  </div>
                  {habitEditResults[h.id] && (
                    <span
                      data-habit-edit-result={h.id}
                      className="mt-0.5 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
                    >
                      {habitEditResults[h.id]}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    data-habit-streak={h.currentStreak}
                    className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500"
                  >
                    <Flame size={11} className={h.currentStreak >= 3 ? 'text-amber-400' : ''} />
                    {h.currentStreak} 天
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      data-habit-week-edit={h.id}
                      title="Edit week goal"
                      onClick={() => startHabitGoalEdit(h)}
                      className="flex h-5 w-5 items-center justify-center rounded-lg border border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                    >
                      <Pencil size={10} />
                    </button>
                    {habitDeleteId === h.id ? (
                      <>
                        <button
                          type="button"
                          data-habit-delete-confirm={h.id}
                          onClick={() => void confirmDeleteHabit(h)}
                          className="flex h-5 items-center rounded-lg bg-rose-500/20 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/30"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          data-habit-delete-cancel={h.id}
                          onClick={() => setHabitDeleteId(null)}
                          className="h-5 rounded-lg border border-white/10 px-1.5 text-[9px] text-slate-500 hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        data-habit-delete={h.id}
                        title="Delete habit"
                        onClick={() => setHabitDeleteId(h.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-lg border border-white/10 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {habits.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-600">No habits</div>
          )}
        </div>
      </BentoCard>

      <BentoCard title="Fast list" subtitle="Enter 快速新建 · n 聚焦" icon={Target} colSpan={5}>
        <div className="mb-3 flex items-center gap-2">
          <input
            ref={fastInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="New task..."
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void add()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
          <button
            type="button"
            onClick={() => setTodayOnly((v) => !v)}
            className={`h-9 rounded-xl border px-3 text-[11px] ${
              todayOnly
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 text-slate-500 hover:text-slate-300'
            }`}
          >
            Today
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {list.map((t, idx) => (
            <div
              key={t.id}
              data-task-cursor={focusedTaskIndex === idx ? 'true' : 'false'}
              className={`message-in flex items-center gap-2 rounded-xl border px-3 py-2 ${
                focusedTaskIndex === idx
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <button
                type="button"
                onClick={() => void setTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                className={`flex h-5 w-5 items-center justify-center rounded-lg border ${
                  t.status === 'done'
                    ? 'check-pop border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/20 text-transparent'
                }`}
                aria-label="Toggle status"
              >
                <Check size={12} />
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-xs ${t.status === 'done' ? 'text-slate-600 line-through' : 'text-slate-300'}`}
              >
                {taskRenameId === t.id ? (
                  <input
                    data-task-rename-input
                    value={taskRenameDraft}
                    onChange={(e) => setTaskRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = taskRenameDraft.trim();
                        if (value) void updateTaskTitle(t.id, value);
                        setTaskRenameId(null);
                      } else if (e.key === 'Escape') {
                        setTaskRenameId(null);
                      }
                    }}
                    autoFocus
                    className="w-full rounded-md border border-emerald-500/40 bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-slate-200 outline-none"
                  />
                ) : (
                  t.title
                )}
              </span>
              <button
                type="button"
                data-task-rename
                aria-label={`Rename ${t.title}`}
                onClick={() => {
                  setTaskRenameId(t.id);
                  setTaskRenameDraft(t.title);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-slate-300"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                data-action-discuss={t.id}
                data-action-discuss-title={t.title}
                aria-label={`AI break down ${t.title}`}
                onClick={() => discussTask(t)}
                className="flex h-6 shrink-0 items-center gap-1 rounded-lg bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
                title="AI 拆解 / 讨论任务"
              >
                <Sparkles size={10} /> AI
              </button>
              {taskDeleteId === t.id ? (
                <button
                  type="button"
                  data-task-delete-confirm
                  aria-label={`Confirm delete ${t.title}`}
                  onClick={() => void deleteTask(t.id, true)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/20"
                  title="Confirm delete"
                >
                  <Check size={11} />
                </button>
              ) : (
                <button
                  type="button"
                  data-task-delete
                  aria-label={`Delete ${t.title}`}
                  onClick={() => setTaskDeleteId(t.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => void setTaskToday(t.id, !t.isToday)}
                className={`rounded-md px-2 py-1 text-[10px] ${
                  t.isToday
                    ? 'accent-bg-15 accent-text-strong'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                Focus
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-600">No tasks</div>
          )}
        </div>
      </BentoCard>

      <BentoCard
        title="Schedule Timeline"
        subtitle="按时间排序，勾选完成"
        icon={CalendarDays}
        colSpan={7}
        className="tilt-card"
        onPointerMove={tiltCard}
        onPointerLeave={resetTilt}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addEventItem();
              }
            }}
            placeholder="New event..."
            className="h-8 min-w-0 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="h-8 w-32 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none [color-scheme:dark]"
          />
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            className="h-8 w-24 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none [color-scheme:dark]"
          />
          <select
            value={eventTag}
            onChange={(e) => setEventTag(e.target.value)}
            className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none"
          >
            <option value="work">work</option>
            <option value="routine">routine</option>
            <option value="life">life</option>
          </select>
          <button
            type="button"
            onClick={() => void addEventItem()}
            className="flex h-8 items-center gap-1 rounded-xl bg-emerald-500/20 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
            aria-label="Add event"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {scheduleEvents.map((ev) => (
            <div
              key={ev.id}
              data-schedule-event-row
              className="message-in flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <div className="w-20 shrink-0 text-right font-mono text-[10px] leading-tight text-slate-500">
                <span className="block">{ev.date ? formatDayLabel(ev.date) : '—'}</span>
                <span className="block">{ev.startTime}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <button
                type="button"
                onClick={() => void toggleEventDone(ev.id)}
                aria-label={`Toggle ${ev.title}`}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${
                  ev.done
                    ? 'check-pop border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/20 text-transparent hover:border-white/40'
                }`}
              >
                <Check size={12} />
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-xs ${ev.done ? 'text-slate-600 line-through' : 'text-slate-300'}`}
              >
                {ev.title}
              </span>
              <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-500">
                {ev.tag}
              </span>
            </div>
          ))}
          {scheduleEvents.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-600">No events</div>
          )}
        </div>
      </BentoCard>

      <BentoCard title="Week Plan" subtitle="Focus · Schedule" icon={Wand2} colSpan={12}>
        <div data-week-plan className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              data-week-plan-template
              value={weekPlanTemplateId}
              onChange={(e) => setWeekPlanTemplateId(e.target.value)}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none"
            >
              {weekPlanTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <span
              data-week-plan-counts
              className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-500"
            >
              {weekPlanCounts.focusCount} focus · {weekPlanCounts.eventCount} events
            </span>
            <button
              type="button"
              data-week-plan-apply
              onClick={() => void applyWeekPlanTemplate()}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
            >
              <Wand2 size={12} /> Apply to week
            </button>
            <span data-week-plan-result className="text-[11px] text-slate-400">
              {weekPlanResult}
            </span>
          </div>
          <div data-week-plan-preview className="grid grid-cols-2 gap-1.5 md:grid-cols-7">
            {weekDays.map((key, i) => {
              const day = selectedWeekPlan?.days[i];
              return (
                <div
                  key={key}
                  data-week-plan-day={key}
                  className={`rounded-lg border p-2 ${
                    key === todayKey
                      ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-400">{WEEKDAY_LABELS[i]}</span>
                    <span className="font-mono text-[9px] text-slate-600">
                      {formatDayLabel(key)}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {(day?.focus ?? []).slice(0, 2).map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="truncate rounded bg-white/[0.04] px-1.5 py-1 text-[9px] text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                    {(day?.events ?? []).slice(0, 2).map((event, index) => (
                      <div
                        key={`${event.title}-${index}`}
                        className="flex items-center gap-1 rounded bg-emerald-500/[0.06] px-1.5 py-1 text-[9px] text-emerald-300/80"
                      >
                        <span className="font-mono">{event.time}</span>
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BentoCard>

      <BentoCard
        title="Week Review"
        subtitle="本周目标统计与快速归档"
        icon={TrendingUp}
        colSpan={12}
      >
        <div data-week-review className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div data-week-review-total className="min-w-0">
              <StatPill label="Week done" value={`${weekDone}/${weekTasks.length}`} tone="green" />
            </div>
            <div data-week-review-rate className="min-w-0">
              <StatPill label="Rate" value={`${Math.round(weekProgress * 100)}%`} tone="blue" />
            </div>
            <div data-week-review-best className="min-w-0">
              <StatPill label="Best day" value={bestDayLabel} tone="neutral" />
            </div>
            <div data-week-review-streak className="min-w-0">
              <StatPill label="Streak" value={`${weekStreak}d`} tone="blue" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((key, i) => {
              const stats = weekDayStats.find((d) => d.key === key) ?? {
                key,
                total: 0,
                done: 0,
              };
              const isSelected = selectedDay === key;
              const pct = stats.total > 0 ? stats.done / stats.total : 0;
              return (
                <button
                  key={key}
                  type="button"
                  data-week-review-day={key}
                  data-week-review-day-total={stats.total}
                  data-week-review-day-done={stats.done}
                  data-week-review-day-selected={isSelected ? 'true' : 'false'}
                  onClick={() => setSelectedDay(key)}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] transition-colors ${
                    isSelected
                      ? 'accent-border accent-bg-15 accent-text-strong'
                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{WEEKDAY_LABELS[i]}</span>
                  <span className="flex h-8 w-2 items-end overflow-hidden rounded-[2px] bg-white/[0.06]">
                    <span
                      className={`w-full ${stats.done > 0 ? 'accent-bg' : 'bg-white/10'}`}
                      style={{ height: `${Math.max(pct * 100, stats.total > 0 ? 14 : 3)}%` }}
                    />
                  </span>
                  <span className="font-mono text-[9px] opacity-70">
                    {stats.done}/{stats.total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-week-review-archive
              data-archive-confirming={archiveConfirming ? 'true' : 'false'}
              onClick={() => void archiveWeekDone()}
              className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] ${
                archiveConfirming
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              <ArchiveRestore size={12} />
              {archiveConfirming ? '确认归档？' : 'Archive done'}
            </button>
            {archiveConfirming && (
              <button
                type="button"
                data-week-review-archive-cancel
                onClick={() => setArchiveConfirming(false)}
                className="flex h-8 items-center rounded-xl border border-white/10 px-3 text-[11px] text-slate-400 hover:bg-white/[0.06]"
              >
                取消
              </button>
            )}
            <span data-week-review-archived className="text-[11px] text-slate-400">
              {archiveResult}
            </span>
          </div>
        </div>
      </BentoCard>
    </div>
  );
}
