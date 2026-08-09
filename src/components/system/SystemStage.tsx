import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pause, Play, Radio, X } from 'lucide-react';
import BentoCard from '../ui/BentoCard';
import type { FsmEvent, FsmLevel } from '../../lib/fsm';
import {
  createMockFsmEventStream,
  isMockAgentsEnabled,
  setMockAgentsEnabled,
} from '../../lib/mockAgents';
import { useViewState } from '../../stores/viewState';
import { useWorkbenchStore } from '../../stores/workbenchStore';

const RING_CAP = 500;

const LEVEL_BADGE: Record<FsmLevel, string> = {
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  hitl: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  error: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
};

const LEVEL_DOT: Record<FsmLevel, string> = {
  info: 'bg-sky-400',
  hitl: 'bg-amber-400',
  error: 'bg-rose-400',
};

const LEVEL_OPTIONS: Array<{ value: FsmLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All levels' },
  { value: 'info', label: 'info' },
  { value: 'hitl', label: 'hitl' },
  { value: 'error', label: 'error' },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEntered(true);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return entered;
}

type EventRowProps = {
  event: FsmEvent;
  decision?: 'approved' | 'rejected';
  onApprove: () => void;
  onReject: () => void;
};

function EventRow({ event, decision, onApprove, onReject }: EventRowProps) {
  const entered = useEntered();
  const isHitl = event.kind === 'hitl.requested' || event.status === 'blocked-on-human';
  return (
    <div
      data-fsm-event
      data-fsm-event-level={event.level}
      data-fsm-event-kind={event.kind}
      className={`flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 transition-[opacity,transform] duration-[120ms] ease-out motion-reduce:transition-none ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
      }`}
    >
      <span
        data-fsm-event-level-dot
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[event.level]}`}
      />
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">
        {formatTime(event.ts)}
      </span>
      <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-300">
        {event.agent}
      </span>
      <span
        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] ${LEVEL_BADGE[event.level]}`}
      >
        {event.kind}
      </span>
      {event.status && (
        <span className="shrink-0 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-400">
          {event.status}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400" title={event.summary}>
        {event.summary}
      </span>
      {isHitl && !decision && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-fsm-hitl-approve
            onClick={onApprove}
            className="flex h-5 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25"
          >
            <Check size={9} /> Approve
          </button>
          <button
            type="button"
            data-fsm-hitl-reject
            onClick={onReject}
            className="flex h-5 items-center gap-1 rounded-md bg-rose-500/15 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/25"
          >
            <X size={9} /> Reject
          </button>
        </span>
      )}
      {decision && (
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] ${
            decision === 'approved'
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-rose-500/10 text-rose-300'
          }`}
        >
          {decision}
        </span>
      )}
    </div>
  );
}

export default function SystemStage() {
  const eventLogs = useWorkbenchStore((s) => s.eventLogs);
  const [events, setEvents] = useState<FsmEvent[]>([]);
  const [mockEnabled, setMockEnabled] = useState<boolean>(() => isMockAgentsEnabled());
  const [hitlDecisions, setHitlDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const [stickToBottom, setStickToBottom] = useState(true);
  const [paused, setPaused] = useViewState<boolean>('system', 'stagePaused', false);
  const [agentFilter, setAgentFilter] = useViewState<string>('system', 'stageAgent', 'all');
  const [levelFilter, setLevelFilter] = useViewState<string>('system', 'stageLevel', 'all');
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<FsmEvent[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const append = useCallback((event: FsmEvent) => {
    setEvents((prev) => [...prev, event].slice(-RING_CAP));
  }, []);

  useEffect(() => {
    if (!mockEnabled) return;
    const source = createMockFsmEventStream(1400);
    return source((event) => {
      if (pausedRef.current) {
        pendingRef.current.push(event);
        return;
      }
      append(event);
    });
  }, [mockEnabled, append]);

  useEffect(() => {
    if (paused || pendingRef.current.length === 0) return;
    const batch = pendingRef.current.splice(0);
    setEvents((prev) => [...prev, ...batch].slice(-RING_CAP));
  }, [paused]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !stickToBottom) return;
    list.scrollTop = list.scrollHeight;
  }, [events, stickToBottom]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    setStickToBottom(list.scrollHeight - list.scrollTop - list.clientHeight < 24);
  };

  const agents = useMemo(
    () => Array.from(new Set(events.map((event) => event.agent))).sort(),
    [events],
  );

  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (agentFilter === 'all' || event.agent === agentFilter) &&
          (levelFilter === 'all' || event.level === levelFilter),
      ),
    [events, agentFilter, levelFilter],
  );

  const decideHitl = useCallback(
    (event: FsmEvent, decision: 'approved' | 'rejected') => {
      setHitlDecisions((prev) => ({ ...prev, [event.id]: decision }));
      append({
        id: `${event.id}-${decision}`,
        ts: Date.now(),
        runId: event.runId,
        traceId: event.traceId,
        nodeId: event.nodeId,
        nodeKey: event.nodeKey,
        agent: event.agent,
        kind: 'node.updated',
        status: decision === 'approved' ? 'complete' : 'aborted',
        level: 'info',
        summary:
          decision === 'approved' ? 'HITL approved by operator' : 'HITL rejected by operator',
      });
    },
    [append],
  );

  const toggleMock = () => {
    const next = !mockEnabled;
    setMockEnabled(next);
    setMockAgentsEnabled(next);
    if (!next) {
      setEvents([]);
      setHitlDecisions({});
    }
  };

  return (
    <BentoCard
      title="Agent Live Event Stream"
      subtitle="FSM 节点时序，Rust 后端 emit fsm://node/updated"
      icon={Radio}
      tier="stage"
      className="min-h-0 flex-1"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-fsm-pause
          onClick={() => setPaused(!paused)}
          className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-2 text-[9px] accent-text-strong accent-hover-bg-25"
        >
          {paused ? <Play size={10} /> : <Pause size={10} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <select
          aria-label="FSM agent filter"
          data-fsm-agent-filter
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
        <select
          aria-label="FSM level filter"
          data-fsm-level-filter
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {mockEnabled ? (
          <span
            data-fsm-mock-badge
            className="flex h-6 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 text-[9px] text-amber-300"
          >
            <Radio size={9} /> mock
          </span>
        ) : (
          <button
            type="button"
            data-fsm-mock-enable
            onClick={toggleMock}
            className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            Enable mock stream
          </button>
        )}
        <span className="ml-auto text-[9px] text-slate-600">{visibleEvents.length} events</span>
      </div>
      {eventLogs.length > 0 && (
        <div
          data-ipc-log
          className="mb-2 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1"
        >
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/80">
            IPC
          </span>
          <div className="min-w-0 flex-1 truncate font-mono text-[9px] text-slate-500">
            {eventLogs[0].timestamp} · {eventLogs[0].type} · {eventLogs[0].message}
          </div>
          <span className="shrink-0 text-[8px] text-slate-600">
            +{Math.min(eventLogs.length - 1, 99)}
          </span>
        </div>
      )}
      <div
        ref={listRef}
        onScroll={handleScroll}
        data-fsm-event-list
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1"
      >
        {visibleEvents.length === 0 && (
          <div className="py-12 text-center text-[11px] text-slate-600">
            {mockEnabled
              ? '等待 mock 事件…'
              : 'Agent 事件流为空。开启 mock 事件源预览 FSM 时序，或等待 Rust 后端 emit fsm://node/updated。'}
          </div>
        )}
        {visibleEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            decision={hitlDecisions[event.id]}
            onApprove={() => decideHitl(event, 'approved')}
            onReject={() => decideHitl(event, 'rejected')}
          />
        ))}
      </div>
    </BentoCard>
  );
}
