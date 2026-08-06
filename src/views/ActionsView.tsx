import {
  ArchiveRestore,
  CalendarDays,
  Check,
  Flame,
  ListChecks,
  Plus,
  RotateCcw,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';
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
  const addHabit = useWorkbenchStore((s) => s.addHabit);
  const toggleHabit = useWorkbenchStore((s) => s.toggleHabit);
  const addScheduleEvent = useWorkbenchStore((s) => s.addScheduleEvent);
  const toggleEventDone = useWorkbenchStore((s) => s.toggleEventDone);

  const [title, setTitle] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitGoal, setHabitGoal] = useState(5);
  const [habitColor, setHabitColor] = useState<(typeof HABIT_COLORS)[number]>('emerald');
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('12:00');
  const [eventTag, setEventTag] = useState('work');
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));

  const todayTasks = tasks.filter((t) => t.isToday).slice(0, 3);
  const list = todayOnly ? tasks.filter((t) => t.isToday) : tasks;
  const todayDone = todayTasks.filter((t) => t.status === 'done').length;
  const focusProgress = Math.min(todayDone / 3, 1);
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return dayKey(d);
  });
  const weekTasks = tasks.filter((t) =>
    t.dueDate ? weekDays.includes(t.dueDate) : t.isToday && selectedDay === dayKey(now),
  );
  const weekDone = weekTasks.filter((t) => t.status === 'done').length;
  const weekProgress = weekTasks.length > 0 ? weekDone / weekTasks.length : 0;
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
    await addTask(title.trim(), true);
    setTitle('');
  };

  const addHabitItem = async () => {
    if (!habitName.trim()) return;
    await addHabit(habitName.trim(), habitGoal, habitColor);
    setHabitName('');
    setHabitGoal(5);
  };

  const addEventItem = async () => {
    if (!eventTitle.trim()) return;
    await addScheduleEvent(eventTitle.trim(), eventTime, eventTag);
    setEventTitle('');
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-12 gap-4">
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
              <div
                data-daily-schedule={`${eventDone}/${scheduleEvents.length}`}
                className="min-w-0"
              >
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

        <BentoCard title="Today Focus" subtitle="今日 3 件事" icon={Target} colSpan={7}>
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
                  <div className="truncate">{t.title}</div>
                  <span className="mt-0.5 block font-mono text-[9px] text-slate-600">
                    {t.dueDate ? formatDayLabel(t.dueDate) : dayKey(now)}
                  </span>
                </div>
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

        <BentoCard title="Habits" subtitle="打卡与连续天数" icon={Flame} colSpan={5}>
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
              return (
                <div
                  key={h.id}
                  className={`message-in flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                    h.doneToday ? tone.active : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <button
                    type="button"
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
                    <div
                      className={`truncate text-xs ${h.doneToday ? 'text-current' : 'text-slate-300'}`}
                    >
                      {h.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {h.doneToday ? '今天已打卡' : `本周目标 ${h.weekGoal} 次`}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
                    <Flame size={11} className={h.currentStreak >= 3 ? 'text-amber-400' : ''} />
                    {h.currentStreak} 天
                  </span>
                </div>
              );
            })}
            {habits.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-600">No habits</div>
            )}
          </div>
        </BentoCard>

        <BentoCard title="Fast list" subtitle="Enter 快速新建" icon={Target} colSpan={5}>
          <div className="mb-3 flex items-center gap-2">
            <input
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
            {list.map((t) => (
              <div
                key={t.id}
                className="message-in flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
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
                  {t.title}
                </span>
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
                className="message-in flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="w-10 shrink-0 text-right font-mono text-[10px] text-slate-500">
                  {ev.startTime}
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
      </div>
    </div>
  );
}
