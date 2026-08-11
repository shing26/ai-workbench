import {
  ArchiveRestore,
  CalendarDays,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from '../lib/db';
import { useWorkbenchStore } from '../stores/workbenchStore';
import BentoCard from '../components/ui/BentoCard';

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

export default function ActionsView() {
  const tasks = useWorkbenchStore((s) => s.tasks);
  const addTask = useWorkbenchStore((s) => s.addTask);
  const setTaskStatus = useWorkbenchStore((s) => s.setTaskStatus);
  const setTaskToday = useWorkbenchStore((s) => s.setTaskToday);
  const setTaskDueDate = useWorkbenchStore((s) => s.setTaskDueDate);
  const updateTaskTitle = useWorkbenchStore((s) => s.updateTaskTitle);
  const deleteTask = useWorkbenchStore((s) => s.deleteTask);
  const setActionContext = useWorkbenchStore((s) => s.setActionContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);

  const [title, setTitle] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [taskRenameId, setTaskRenameId] = useState<string | null>(null);
  const [taskRenameDraft, setTaskRenameDraft] = useState('');
  const [taskDeleteId, setTaskDeleteId] = useState<string | null>(null);
  const fastInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<db.Task[]>([]);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(-1);
  const [breakdownTask, setBreakdownTask] = useState<db.Task | null>(null);
  const [cliTask, setCliTask] = useState<db.Task | null>(null);
  const [cliDraft, setCliDraft] = useState('');
  const [cliLinkedPaths, setCliLinkedPaths] = useState<string[]>([]);
  const [cliLog, setCliLog] = useState<db.CliLogLine[]>([]);
  const [cliRunning, setCliRunning] = useState(false);
  const [cliExitCode, setCliExitCode] = useState<number | null>(null);
  const [knowledgePickerOpen, setKnowledgePickerOpen] = useState(false);
  const [knowledgeCards, setKnowledgeCards] = useState<db.Thought[]>([]);
  const [healthResult, setHealthResult] = useState<db.QualityGateResult | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const cliLogEndRef = useRef<HTMLDivElement | null>(null);
  const cliUnsubRef = useRef<(() => void) | null>(null);

  const openCliDraft = useCallback(
    (task: db.Task, pathsOverride?: string[]) => {
      setCliTask(task);
      const paths = pathsOverride ?? cliLinkedPaths;
      const linked = paths.length > 0 ? `，请读取 ${paths.join('，')}` : '';
      setCliDraft(
        `claude "请读取 ${linked}，实现 Task：${task.title}${task.isDod ? '（含 DoD 验收）' : ''}"`,
      );
    },
    [cliLinkedPaths],
  );

  const runHealthCheck = useCallback(async () => {
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const result = await db.runQualityGate(vibeContext?.path ?? '');
      setHealthResult(result);
    } finally {
      setHealthChecking(false);
    }
  }, [vibeContext?.path]);

  const openKnowledgePicker = async () => {
    const cards = await db.listThoughts().catch(() => []);
    setKnowledgeCards(cards.filter((t) => t.type === 'note' || t.type === 'doc'));
    setKnowledgePickerOpen(true);
  };

  const attachKnowledge = (card: db.Thought) => {
    const pathHint =
      (card.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .join('') || card.id;
    const nextPaths = cliLinkedPaths.includes(pathHint)
      ? cliLinkedPaths
      : [...cliLinkedPaths, pathHint];
    setCliLinkedPaths(nextPaths);
    setKnowledgePickerOpen(false);
    if (cliTask) openCliDraft(cliTask, nextPaths);
  };

  const runCli = async () => {
    if (!cliTask || cliRunning) return;
    const projectPath = vibeContext?.path ?? '';
    const match = /^(claude|aider|codex|git|npx|cargo|python|node)(\s.*)?$/.exec(cliDraft.trim());
    const command = match ? match[1] : 'claude';
    const rest = (cliDraft.trim().replace(/^claude|^aider|^codex/, '') || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 12);
    setCliRunning(true);
    setCliExitCode(null);
    setCliLog([]);
    try {
      const { runId } = await db.spawnCliProcess(projectPath, command, rest);
      const unLog = await db.listenCliLog((line) => {
        if (line.runId !== runId) return;
        setCliLog((prev) => [...prev, line]);
      });
      const unExit = await db.listenCliExit((evt) => {
        if (evt.runId !== runId) return;
        setCliExitCode(evt.exitCode);
        setCliRunning(false);
        db.recordCliRun({
          runId,
          command: command,
          exitCode: evt.exitCode,
          startedAt: Date.now(),
        });
      });
      cliUnsubRef.current = () => {
        unLog();
        unExit();
      };
    } catch (err) {
      setCliLog((prev) => [
        ...prev,
        { runId: 'err', line: err instanceof Error ? err.message : String(err), stream: 'stderr' },
      ]);
      setCliRunning(false);
    }
  };

  const clearCli = () => {
    setCliTask(null);
    setCliDraft('');
    setCliLinkedPaths([]);
    setCliLog([]);
    setCliExitCode(null);
    setCliRunning(false);
  };

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
      } else if (key === 'c') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) openCliDraft(task);
      } else if (key === 'v') {
        e.preventDefault();
        void runHealthCheck();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    focusedTaskIndex,
    setTaskStatus,
    setTaskToday,
    vibeContext,
    cliLinkedPaths,
    openCliDraft,
    runHealthCheck,
  ]);

  useEffect(() => {
    return () => {
      cliUnsubRef.current?.();
      cliUnsubRef.current = null;
    };
  }, []);

  useEffect(() => {
    cliLogEndRef.current?.scrollIntoView({ block: 'end' });
  }, [cliLog]);
  const archived = tasks
    .filter((t) => t.status === 'done' && t.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 6);

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
      <BentoCard title="Today Focus" subtitle="今日 3 件事" icon={Target} colSpan={12}>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="progress-strip-inner h-full rounded-full bg-emerald-400/80"
            style={{ transform: `scaleX(${focusProgress})` }}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {todayTasks.map((t) => (
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
                  const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                  const next = dayKey(nextDate);
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
          {todayTasks.length < 3 && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-[11px] text-slate-600">
              Add up to 3 focus items
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
        title="CLI 交付终端"
        subtitle="c 派发 · v 健康检查 · 📎 关联知识注入"
        icon={Terminal}
        colSpan={12}
      >
        <div data-cli-terminal className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-cli-health
              onClick={() => void runHealthCheck()}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 text-[11px] text-violet-300 hover:bg-violet-500/25"
            >
              <Sparkles size={12} />
              {healthChecking ? '检查中…' : 'v 健康检查'}
            </button>
            <button
              type="button"
              data-cli-link-knowledge
              onClick={() => void openKnowledgePicker()}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-[11px] text-amber-300 hover:bg-amber-500/25"
            >
              📎 关联知识
            </button>
            {healthResult && (
              <span
                data-cli-health-result
                data-status={healthResult.status}
                className={`text-[11px] ${healthResult.status === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {healthResult.status === 'GREEN'
                  ? '✓ Quality Gate GREEN'
                  : `✗ ${healthResult.errors.length} 项错误`}
              </span>
            )}
          </div>

          {healthResult && healthResult.status !== 'GREEN' && (
            <div
              data-cli-health-errors
              className="max-h-28 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-2 font-mono text-[10px] text-rose-300"
            >
              {healthResult.errors.slice(0, 10).map((e, i) => (
                <div key={i} className="truncate">
                  {e}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">选中任务</span>
            <span data-cli-selected-task className="truncate text-xs text-slate-300">
              {cliTask ? cliTask.title : '—（按 c 选择聚焦任务）'}
            </span>
            {cliLinkedPaths.length > 0 && (
              <div data-cli-linked-paths className="flex flex-wrap items-center gap-1">
                {cliLinkedPaths.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5 text-[9px] text-amber-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2">
            <textarea
              value={cliDraft}
              onChange={(e) => setCliDraft(e.target.value)}
              placeholder="CLI 命令模板，如 claude「请读取 xxx，实现 Task…」"
              rows={2}
              data-cli-template-preview
              className="h-[46px] min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:font-sans placeholder:text-slate-600"
            />
            <button
              type="button"
              data-cli-run
              disabled={!cliTask || cliRunning}
              onClick={() => void runCli()}
              className="flex h-[46px] items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 text-[11px] text-emerald-400 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Terminal size={13} />
              {cliRunning ? '运行中…' : '🚀 唤醒本地 CLI'}
            </button>
            {cliTask && (
              <button
                type="button"
                data-cli-clear
                onClick={clearCli}
                className="flex h-[46px] items-center rounded-xl border border-white/10 px-3 text-[11px] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
              >
                清空
              </button>
            )}
          </div>

          {(cliLog.length > 0 || cliExitCode !== null) && (
            <div
              data-cli-log
              className="h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed"
            >
              {cliLog.map((entry, i) => (
                <div
                  key={i}
                  data-cli-log-line
                  data-stream={entry.stream}
                  className={`whitespace-pre-wrap ${entry.stream === 'stderr' ? 'text-rose-400' : entry.stream === 'system' ? 'text-emerald-400/80' : 'text-slate-300'}`}
                >
                  {entry.line}
                </div>
              ))}
              {cliExitCode !== null && (
                <div
                  data-cli-exit
                  className={`font-bold ${cliExitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {cliExitCode === 0 ? '✓ 完成 exit 0' : `✗ 失败 exit ${cliExitCode}`}
                </div>
              )}
              <div ref={cliLogEndRef} />
            </div>
          )}
        </div>

        {knowledgePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setKnowledgePickerOpen(false)}
              aria-hidden="true"
            />
            <div
              data-link-knowledge
              className="relative w-[420px] max-w-[94vw] rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-amber-400/80">
                  📎 关联知识
                </div>
                <button
                  type="button"
                  data-link-knowledge-close
                  onClick={() => setKnowledgePickerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {knowledgeCards.length === 0 && (
                  <div className="py-6 text-center text-[11px] text-slate-500">
                    暂无知识卡片，请先在 AI Studio 固化为知识
                  </div>
                )}
                {knowledgeCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    data-link-knowledge-card={card.id}
                    onClick={() => attachKnowledge(card)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-amber-500/30 hover:bg-amber-500/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-200">
                        {(card.content || '').split('\n').find((l) => l.trim()) || card.id}
                      </div>
                      <div className="truncate text-[9px] text-slate-500">
                        {card.tags || '无标签'} · {card.type}
                      </div>
                    </div>
                    <Plus size={12} className="shrink-0 text-amber-400/70" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
