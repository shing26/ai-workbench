import { Check, FolderKanban, Plus, RotateCcw, Sparkles, Terminal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from '../lib/db';
import { usePrismModals } from '../components/modals/prismModalsStore';
import { useDeliverySnapshot } from '../hooks/useDelivery';
import { useProviderControlSnapshot } from '../hooks/useProviderControl';
import { deliveryOrchestrator } from '../lib/delivery';
import { useWorkbenchStore } from '../stores/workbenchStore';

const GATE_PRESETS: { level: number; name: string }[] = [
  { level: 1, name: '静态类型与编译 · cargo check / tsc' },
  { level: 2, name: '单元与契约测试 · cargo test / vitest' },
  { level: 3, name: 'CDP 无头浏览器 UI 比对' },
  { level: 4, name: 'AI DoD 语义对齐 + CISO 审计' },
];

export default function ActionsView() {
  const tasks = useWorkbenchStore((s) => s.tasks);
  const addTask = useWorkbenchStore((s) => s.addTask);
  const setTaskStatus = useWorkbenchStore((s) => s.setTaskStatus);
  const setTaskToday = useWorkbenchStore((s) => s.setTaskToday);
  const updateTaskTitle = useWorkbenchStore((s) => s.updateTaskTitle);
  const deleteTask = useWorkbenchStore((s) => s.deleteTask);
  const setActionContext = useWorkbenchStore((s) => s.setActionContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const projects = useWorkbenchStore((s) => s.projects);
  const openCli = usePrismModals((s) => s.openCli);
  const openAttach = usePrismModals((s) => s.openAttach);
  const openProvider = usePrismModals((s) => s.openProvider);
  const providerControl = useProviderControlSnapshot();

  const [title, setTitle] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [taskRenameId, setTaskRenameId] = useState<string | null>(null);
  const [taskRenameDraft, setTaskRenameDraft] = useState('');
  const [taskDeleteId, setTaskDeleteId] = useState<string | null>(null);
  const fastInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<db.Task[]>([]);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(-1);
  const delivery = useDeliverySnapshot();
  const { gateResult, gateRunning, gateError, fixRound: gateRound, recentRuns } = delivery;
  const recentCliRuns = recentRuns.filter((run) => run.exitCode !== null);
  const recordedProfile = gateResult?.providerProfile;
  const activeProfile = recordedProfile ?? providerControl.selectedProvider;

  const vibePath = vibeContext?.path ?? '';
  const activeProject = vibeContext
    ? projects.find(
        (project) => project.id === vibeContext.projectId || project.path === vibeContext.path,
      )
    : undefined;
  const specPath = activeProject?.journeyDocPath ?? '';

  const dispatchCli = useCallback(
    (task: db.Task) => {
      openCli({
        projectName: vibeContext?.projectName ?? 'Prism Station',
        specPath: specPath || undefined,
        tasks: [task.title],
        taskId: task.id,
      });
    },
    [openCli, vibeContext, specPath],
  );

  const list = todayOnly ? tasks.filter((t) => t.isToday) : tasks;
  listRef.current = list;

  const runGate = useCallback(() => {
    void deliveryOrchestrator.runGate(vibePath, specPath || null);
  }, [vibePath, specPath]);

  const dispatchFix = useCallback(() => {
    if (!delivery.gateResult || delivery.gateResult.status === 'GREEN' || delivery.fixRound >= 2) {
      return;
    }
    void deliveryOrchestrator.startFix({
      projectPath: vibePath,
      projectName: vibeContext?.projectName ?? 'Prism Station',
      specPath: specPath || undefined,
      tasks: list.slice(0, 3).map((task) => task.title),
    });
  }, [delivery.gateResult, delivery.fixRound, vibeContext, specPath, list, vibePath]);

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
      if (key === 'v') {
        e.preventDefault();
        void runGate();
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
      } else if (key === 'c') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) dispatchCli(task);
      } else if (key === 'p') {
        const idx = focusedTaskIndex >= 0 ? focusedTaskIndex : 0;
        const task = current[idx];
        if (task) void setTaskToday(task.id, !task.isToday);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedTaskIndex, setTaskStatus, setTaskToday, dispatchCli, runGate]);

  const add = async () => {
    if (!title.trim()) return;
    const words = title.trim().split(/\s+/);
    const projTag = words.find((w) => w.startsWith('#proj-'));
    const isDod = words.some((w) => w.toLowerCase() === '#dod');
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
    <div className="mission-view space-y-4 p-4 sm:p-5 lg:space-y-5">
      <div className="pc-section-head">
        <span className="pc-section-code">SYS.04 / DELIVERY</span>
        <span className="pc-section-title">交付终端</span>
        <span className="pc-section-meta">j/k 游走 · x 完成 · c 派发 · v 校验</span>
      </div>

      <div className="pc-actions-grid">
        <div className="pc-panel">
          <div className="pc-panel-title">
            <span className="tick" />
            DoD 任务队列<span className="right">{list.length} 项</span>
          </div>

          <div className="pc-form-row" style={{ marginBottom: 12 }}>
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
              placeholder="输入任务，Enter 快速创建 · n 聚焦"
              data-task-fast-input
              className="pc-text-input"
            />
            <button
              type="button"
              data-task-add
              onClick={() => void add()}
              className="pc-mini-btn primary"
            >
              <Plus size={13} />
              添加
            </button>
            <button
              type="button"
              data-task-today-filter
              onClick={() => setTodayOnly((v) => !v)}
              className="pc-mini-btn"
              style={
                todayOnly
                  ? { color: 'var(--prism-accent-strong)', borderColor: 'rgba(34,211,238,0.4)' }
                  : undefined
              }
            >
              Today
            </button>
          </div>

          <div className="pc-task-list">
            {list.map((t, idx) => (
              <div
                key={t.id}
                data-task-cursor={focusedTaskIndex === idx ? 'true' : 'false'}
                data-task-id={t.id}
                className={`pc-task ${t.status === 'done' ? 'done' : ''} ${
                  focusedTaskIndex === idx ? 'border-cyan-500/40 bg-cyan-500/[0.08]' : ''
                }`}
              >
                <button
                  type="button"
                  data-task-toggle={t.id}
                  onClick={() => void setTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                  className="pc-check"
                  aria-label="Toggle status"
                >
                  <Check size={12} />
                </button>
                <div className="min-w-0">
                  {taskRenameId === t.id ? (
                    <input
                      value={taskRenameDraft}
                      data-task-rename-input
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
                      className="w-full rounded border border-cyan-500/40 bg-black/25 px-2 py-1 text-[11px] text-slate-200 outline-none"
                    />
                  ) : (
                    <div
                      className={`pc-task-title ${t.status === 'done' ? 'line-through' : ''}`}
                      onDoubleClick={() => {
                        setTaskRenameId(t.id);
                        setTaskRenameDraft(t.title);
                      }}
                    >
                      {t.title}
                    </div>
                  )}
                  <div className="pc-task-meta">
                    {t.isToday && <span className="pc-badge cyan">TODAY</span>}
                    {t.isDod && <span className="pc-badge amber">DoD</span>}
                    {t.projectId && <span className="pc-badge">{t.projectId}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    data-task-attach={t.id}
                    onClick={() => openAttach({ taskId: t.id, taskTitle: t.title })}
                    className="pc-mini-btn"
                    title="🔗 关联知识"
                  >
                    <FolderKanban size={10} />
                    关联
                  </button>
                  <button
                    type="button"
                    data-task-cli={t.id}
                    onClick={() => dispatchCli(t)}
                    className="pc-mini-btn primary"
                  >
                    <Terminal size={10} />
                    派发 CLI
                  </button>
                  <button
                    type="button"
                    data-action-discuss={t.id}
                    onClick={() => discussTask(t)}
                    className="pc-mini-btn"
                    title="AI 拆解 / 讨论任务"
                  >
                    <Sparkles size={10} />
                    AI
                  </button>
                  {taskDeleteId === t.id ? (
                    <button
                      type="button"
                      data-task-delete-confirm
                      onClick={() => void deleteTask(t.id, true)}
                      className="pc-mini-btn danger"
                    >
                      <Check size={10} />
                      确认
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-task-delete
                      onClick={() => setTaskDeleteId(t.id)}
                      className="pc-mini-btn danger"
                      aria-label="Delete task"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-600">暂无任务，先添加一个</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="pc-panel" data-quality-gate>
            <div className="pc-panel-title">
              <span className="tick" />
              验证矩阵<span className="right">L1–L4</span>
            </div>

            {gateError && (
              <div
                data-gate-error
                className="mb-3 rounded border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 font-mono text-[10px] text-rose-300"
              >
                {gateError}
              </div>
            )}

            <div
              data-provider-profile
              className="mb-3 flex flex-wrap items-center gap-2 rounded border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-2"
            >
              <span className="text-[9px] text-slate-500">Provider Profile:</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-cyan-200">
                {activeProfile
                  ? `${activeProfile.name} / ${activeProfile.model || 'no model'} / ${activeProfile.baseUrl}`
                  : 'not configured'}
              </span>
              <button
                type="button"
                data-provider-open
                aria-label="Provider Control"
                onClick={openProvider}
                className="pc-mini-btn"
              >
                Configure
              </button>
            </div>

            <div className="pc-gate-list">
              {GATE_PRESETS.map((preset) => {
                const level = gateResult?.levels.find((l) => l.level === preset.level);
                const status = level?.status ?? 'READY';
                return (
                  <div
                    key={preset.level}
                    data-gate-level={preset.level}
                    className={`pc-gate ${status !== 'GREEN' && status !== 'READY' ? 'warn' : ''}`}
                  >
                    <span className="pc-gate-level">L{preset.level}</span>
                    <div className="pc-gate-name">{preset.name}</div>
                    <span className="pc-gate-state">{status}</span>
                  </div>
                );
              })}
            </div>

            {gateResult && (
              <div className="mt-3 space-y-2">
                <div
                  data-gate-status={gateResult.status}
                  className={`text-[11px] font-semibold ${
                    gateResult.status === 'GREEN' ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {gateResult.status === 'GREEN'
                    ? '✓ 四级验证全部通过'
                    : `✗ 验证未通过（${gateResult.errors.length} 条错误）`}
                </div>
                {gateResult.status === 'FAILED' && (
                  <div className="flex items-center gap-2">
                    {gateRound < 2 ? (
                      <button
                        type="button"
                        data-gate-fix
                        onClick={dispatchFix}
                        className="pc-mini-btn"
                        style={{
                          color: 'var(--color-warning)',
                          borderColor: 'rgba(245,158,11,0.3)',
                        }}
                      >
                        <RotateCcw size={12} />
                        自动修复（第 {gateRound + 1} 轮 / 最多 2 轮）
                      </button>
                    ) : (
                      <span data-gate-fix-limit className="text-[10px] text-amber-300/90">
                        已达 2 轮修复上限，请人工介入
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pc-log-box">
              {gateResult && gateResult.status === 'FAILED'
                ? gateResult.errors.slice(0, 4).map((err, i) => (
                    <div key={i} style={{ color: 'var(--color-error)' }}>
                      ✘ {err}
                    </div>
                  ))
                : recentCliRuns.slice(0, 3).map((run) => (
                    <div key={run.runId} data-cli-run-row data-exit={run.exitCode}>
                      <span
                        style={{
                          color: run.exitCode === 0 ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                      >
                        {run.exitCode === 0 ? '✔' : `✗ ${run.exitCode}`}
                      </span>{' '}
                      {run.command}
                    </div>
                  ))}
              {!gateResult && recentCliRuns.length === 0 && (
                <span style={{ color: 'var(--color-text-muted)' }}>— 等待派发 / 验证 —</span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                data-cli-open
                onClick={() =>
                  openCli({
                    projectName: vibeContext?.projectName ?? 'Prism Station',
                    specPath: specPath || undefined,
                    tasks: list.slice(0, 3).map((t) => t.title),
                  })
                }
                className="pc-ghost-btn flex-1"
              >
                <Terminal size={13} />
                派发 CLI
              </button>
              <button
                type="button"
                data-gate-run
                onClick={() => void runGate()}
                disabled={gateRunning || !vibePath}
                className="pc-ghost-btn flex-1 disabled:opacity-50"
              >
                {gateRunning ? '验证中...' : gateResult ? '重新验证 (v)' : '运行四级验证 (v)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
