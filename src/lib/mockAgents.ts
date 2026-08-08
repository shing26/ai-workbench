import type { FsmEvent, FsmEventSource, FsmLevel, FsmNodeStatus } from './fsm';

export const MOCK_AGENTS_LS_KEY = 'ai-workbench:mock-agents:v1';

let seq = 0;

function makeId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function isMockAgentsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(MOCK_AGENTS_LS_KEY);
    if (stored === '1' || stored === 'true') return true;
  } catch {
    /* storage unavailable */
  }
  try {
    if (import.meta.env.MOCK_ALL_AGENTS) return true;
  } catch {
    /* env unavailable */
  }
  return false;
}

export function setMockAgentsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(MOCK_AGENTS_LS_KEY, '1');
    else localStorage.removeItem(MOCK_AGENTS_LS_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Step = {
  agent: string;
  kind: FsmEvent['kind'];
  status?: FsmNodeStatus;
  level?: FsmLevel;
  summary: string;
  holdMs?: number;
};

function buildSteps(cycle: number): Step[] {
  return [
    { agent: 'planner', kind: 'run.started', level: 'info', summary: `run ${cycle} started` },
    {
      agent: 'planner',
      kind: 'node.created',
      status: 'running',
      level: 'info',
      summary: 'planning milestones for sprint backlog',
    },
    {
      agent: 'planner',
      kind: 'node.updated',
      status: 'complete',
      level: 'info',
      summary: 'plan ready: 3 milestones sequenced',
    },
    {
      agent: 'researcher',
      kind: 'node.created',
      status: 'running',
      level: 'info',
      summary: 'gathering context from vault',
    },
    {
      agent: 'researcher',
      kind: 'node.updated',
      status: 'complete',
      level: 'info',
      summary: 'found 4 relevant sources',
    },
    {
      agent: 'codex',
      kind: 'node.created',
      status: 'running',
      level: 'info',
      summary: 'implementing change set',
    },
    {
      agent: 'codex',
      kind: 'node.updated',
      status: 'running',
      level: 'info',
      summary: 'patch generated, running checks',
    },
    {
      agent: 'reviewer',
      kind: 'hitl.requested',
      status: 'blocked-on-human',
      level: 'hitl',
      summary: 'approval required before outbound delivery',
      holdMs: 4200,
    },
    {
      agent: 'reviewer',
      kind: 'node.updated',
      status: 'complete',
      level: 'info',
      summary: 'approved by human operator',
    },
    { agent: 'planner', kind: 'run.completed', level: 'info', summary: `run ${cycle} complete` },
  ];
}

export function createMockFsmEventStream(intervalMs = 1400): FsmEventSource {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cycle = 0;
  let index = 0;
  let handler: ((event: FsmEvent) => void) | null = null;

  const schedule = (delayMs: number) => {
    timer = setTimeout(tick, delayMs);
  };

  const tick = () => {
    if (!handler) return;
    if (cycle % 3 === 2 && index >= buildSteps(cycle).length) {
      handler({
        id: makeId('evt'),
        ts: Date.now(),
        runId: `run-${cycle}`,
        traceId: `tr-${cycle}-err`,
        nodeKey: 'codex.exec',
        agent: 'codex',
        kind: 'node.updated',
        status: 'aborted',
        level: 'error',
        summary: 'timeout after 30s, routed to fallback provider',
      });
      cycle += 1;
      index = 0;
      schedule(intervalMs);
      return;
    }
    const steps = buildSteps(cycle);
    if (index >= steps.length) {
      cycle += 1;
      index = 0;
      schedule(intervalMs);
      return;
    }
    const step = steps[index];
    index += 1;
    const event: FsmEvent = {
      id: makeId('evt'),
      ts: Date.now(),
      runId: `run-${cycle}`,
      traceId: `tr-${cycle}-${index}`,
      nodeKey: `${step.agent}.${index}`,
      agent: step.agent,
      kind: step.kind,
      status: step.status,
      level: step.level ?? 'info',
      summary: step.summary,
    };
    handler(event);
    schedule(step.holdMs ?? intervalMs);
  };

  return (nextHandler) => {
    handler = nextHandler;
    schedule(intervalMs);
    return () => {
      if (timer !== null) clearTimeout(timer);
      handler = null;
    };
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const MOCK_REPLY_TEMPLATES = [
  '收到。基于当前上下文，建议先锁定最小可行路径，再逐步扩展。',
  '收到。这条回复来自确定性 fixture，未调用真实 Provider。',
  '收到。已按工作区状态整理要点：结构清晰、依赖完整、下一步可执行。',
] as const;

export function mockLlmReply(prompt: string): string {
  const seed = hashString(prompt);
  const excerpt = (prompt.trim().split('\n')[0] ?? 'workspace').slice(0, 80);
  const template = MOCK_REPLY_TEMPLATES[seed % MOCK_REPLY_TEMPLATES.length];
  const tag = `mock-${seed.toString(36).slice(0, 6)}`;
  return [
    `[MOCK_AGENTS:${tag}]`,
    '',
    `Prompt 摘要：${excerpt || '(empty)'}`,
    template,
    '（MOCK_ALL_AGENTS 开启：仅外部 I/O 被替换，存储与 FSM 照常真实流转。）',
  ].join('\n');
}

export function mockProviderHealth(providerId: string): {
  ok: true;
  latencyMs: number;
  message: string;
} {
  const latencyMs = 40 + (hashString(providerId) % 120);
  return {
    ok: true,
    latencyMs,
    message: `Mock provider healthy (${latencyMs}ms)`,
  };
}

export function mockWebhookDelivery(event: string): {
  status: 'success';
  lastStatus: number;
  lastMessage: string;
} {
  return {
    status: 'success',
    lastStatus: 200,
    lastMessage: `Mock webhook logged (event: ${event}) — no request sent`,
  };
}

export function mockCodexResult(idea: string): string {
  return [
    '[MOCK_AGENTS:codex]',
    `Idea: ${idea.slice(0, 80)}`,
    'Mock Codex execution completed (preset result).',
    '（MOCK_ALL_AGENTS 开启：未调用 Codex CLI。）',
  ].join('\n');
}
