export type FsmNodeStatus =
  'pending' | 'running' | 'paused' | 'blocked-on-human' | 'complete' | 'aborted';

export type FsmEventKind =
  | 'run.started'
  | 'run.completed'
  | 'run.aborted'
  | 'node.created'
  | 'node.updated'
  | 'hitl.requested';

export type FsmLevel = 'info' | 'hitl' | 'error';

export type FsmNode = {
  id: string;
  runId: string;
  nodeKey: string;
  agent: string;
  status: FsmNodeStatus;
  contextJson: string;
  traceId: string;
  createdAt: number;
  updatedAt: number;
};

export type FsmEvent = {
  id: string;
  ts: number;
  runId: string;
  traceId: string;
  nodeId?: string;
  nodeKey?: string;
  agent: string;
  kind: FsmEventKind;
  status?: FsmNodeStatus;
  level: FsmLevel;
  summary: string;
  payload?: unknown;
};

export type FsmEventSource = (handler: (event: FsmEvent) => void) => () => void;

export const FSM_EVENT_TOPIC = 'fsm://node/updated';
