import type { AgentSpec, MoaConsensus, StreamChunk } from './db';

export type RoundtableSeat = AgentSpec;

export type RoundtableMessage = {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
};

export type RoundtableApiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type RoundtableOutput = {
  seat: RoundtableSeat;
  opinion: string;
};

export type RoundtableStatus = 'idle' | 'connecting' | 'streaming' | 'error';

export type RoundtableVibeContext = {
  projectId: string;
  projectName: string;
  journeyDocPath: string | null;
  path: string;
  branch: string;
  changes: string[];
};

export type RoundtableNoteContext = {
  title: string;
  tags: string;
  type: string;
  content: string;
};

export type RoundtableActionContext = {
  taskId: string;
  title: string;
  status: string;
  dueDate: string | null;
  isToday: boolean;
};

export type RoundtableSnapshot = {
  messages: RoundtableMessage[];
  outputs: RoundtableOutput[];
  consensus: MoaConsensus | null;
  status: RoundtableStatus;
  busy: boolean;
  error: string | null;
};

export type RoundtableStreamArgs = {
  providerIds: string[];
  messages: RoundtableApiMessage[];
  runId: string;
  moa?: boolean;
};

export type RoundtableStartInput = {
  text: string;
  seats: RoundtableSeat[];
  providerIds: string[];
  sessionId: string | null;
  vibe?: RoundtableVibeContext | null;
  note?: RoundtableNoteContext | null;
  action?: RoundtableActionContext | null;
  relatedJourneys?: { content: string }[];
  hits?: { content: string }[];
  onStageDiscussing?: () => void | Promise<void>;
};

export type RoundtableStartResult =
  | {
      ok: true;
      runId: string;
      outputs: RoundtableOutput[];
      consensus: MoaConsensus | null;
      consensusNote: string;
    }
  | { ok: false; error: string };

export type RoundtableAdapters = {
  sendStream: (args: RoundtableStreamArgs) => Promise<void>;
  listenChunks: (handler: (chunk: StreamChunk) => void) => Promise<() => void>;
  buildConsensus: (contents: string[]) => Promise<MoaConsensus | null>;
  saveMessage: (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    id?: string,
  ) => Promise<unknown>;
};

const MAX_SEATS = 5;
const MIN_SEATS = 2;

function makeMessageId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildVibeSystemMessage(vibe: RoundtableVibeContext): string {
  return (
    `[Vibe Coding 上下文] 当前挂载项目：${vibe.projectName}\n` +
    `Path: ${vibe.path}\nBranch: ${vibe.branch}\n` +
    `当前变更文件:\n${vibe.changes.map((c) => `- ${c}`).join('\n') || '- 无'}`
  );
}

function buildNoteSystemMessage(note: RoundtableNoteContext): string {
  return (
    `[知识笔记上下文] 当前挂载笔记：${note.title}\n` +
    `标签: ${note.tags || '无'}\n` +
    `类型: ${note.type}\n` +
    `笔记正文:\n${note.content.slice(0, 6000)}` +
    `\n请基于以上笔记内容执行用户的提问 / 扩展 / 重构指令，引用时注明来源笔记。`
  );
}

function buildActionSystemMessage(action: RoundtableActionContext): string {
  return (
    `[任务上下文] 当前挂载任务：${action.title}\n` +
    `状态: ${action.status}\n` +
    `截止: ${action.dueDate || '未设定'}\n` +
    `今日焦点: ${action.isToday ? '是' : '否'}\n` +
    `请帮我把该任务拆解为可执行的 Markdown 步骤清单，或给出解决方案 / 建议。`
  );
}

function buildRelatedJourneysMessage(related: { content: string }[]): string {
  return (
    `[相关旅程档案] 以下是与当前项目相关的历史旅程/归档记录，供论证参考：\n` +
    related.map((h) => `- ${h.content.slice(0, 400)}`).join('\n')
  );
}

function buildApiMessages(
  seat: RoundtableSeat,
  history: RoundtableMessage[],
  input: RoundtableStartInput,
): RoundtableApiMessage[] {
  const messages: RoundtableApiMessage[] = history
    .filter((m) => m.content !== '__stream__')
    .map((m) => ({ role: m.role, content: m.content }));

  if (input.vibe) {
    messages.unshift({ role: 'system', content: buildVibeSystemMessage(input.vibe) });
  }
  if (input.note) {
    messages.unshift({ role: 'system', content: buildNoteSystemMessage(input.note) });
  }
  if (input.action) {
    messages.unshift({ role: 'system', content: buildActionSystemMessage(input.action) });
  }
  if (input.relatedJourneys?.length) {
    messages.unshift({
      role: 'system',
      content: buildRelatedJourneysMessage(input.relatedJourneys),
    });
  }
  messages.unshift({ role: 'system', content: seat.prompt.trim() });
  if (input.hits?.length) {
    messages.unshift({
      role: 'system',
      content: `Knowledge context:\n${input.hits.map((h) => `- ${h.content}`).join('\n')}`,
    });
  }
  return messages;
}

function buildConsensusNote(
  text: string,
  outputs: RoundtableOutput[],
  consensus: MoaConsensus | null,
): string {
  return [
    '## 🧠 Agency 圆桌共识（第二轮汇总）',
    '',
    `**议题**：${text}`,
    '',
    consensus?.summary
      ? `**共识摘要**：\n${consensus.summary.trim()}`
      : '**共识摘要**：各 Agent 已独立发言，等待 CPO 确认定稿。',
    '',
    ...outputs.map(
      (o) =>
        `### ${o.seat.name}（${o.seat.role}）\n${o.opinion.trim().slice(0, 400) || '（无输出）'}`,
    ),
    '',
    '_点击上方「固化为旅程文档」将本次论证落盘为旅程文档。_',
  ].join('\n');
}

export class RoundtableOrchestrator {
  private readonly adapters: RoundtableAdapters;
  private readonly listeners = new Set<(snapshot: RoundtableSnapshot) => void>();
  private state: RoundtableSnapshot = {
    messages: [],
    outputs: [],
    consensus: null,
    status: 'idle',
    busy: false,
    error: null,
  };
  private unlisten: (() => void) | null = null;
  private mountPromise: Promise<void> | null = null;
  private mountGeneration = 0;
  private runCounter = 0;
  private seatByIndex = new Map<number, RoundtableSeat>();
  private runs = new Map<string, { content: string; index: number }>();
  private runIds: string[] = [];
  private results = new Map<string, string>();
  private completed = new Set<string>();
  private pending = 0;
  private sessionId: string | null = null;

  constructor(adapters: RoundtableAdapters) {
    this.adapters = adapters;
  }

  async mount(): Promise<void> {
    if (this.mountPromise) {
      await this.mountPromise;
      return;
    }
    const generation = ++this.mountGeneration;
    this.unlisten?.();
    this.unlisten = null;
    this.mountPromise = this.adapters
      .listenChunks((chunk) => this.handleChunk(chunk))
      .then((unlisten) => {
        if (generation !== this.mountGeneration) {
          unlisten();
          return;
        }
        this.unlisten = unlisten;
      });
    await this.mountPromise;
  }

  dispose(): void {
    this.mountGeneration += 1;
    this.unlisten?.();
    this.unlisten = null;
    this.mountPromise = null;
    this.listeners.clear();
    this.resetRunState();
  }

  subscribe(listener: (snapshot: RoundtableSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RoundtableSnapshot {
    return {
      ...this.state,
      messages: [...this.state.messages],
      outputs: [...this.state.outputs],
      consensus: this.state.consensus
        ? {
            ...this.state.consensus,
            common: [...this.state.consensus.common],
            viewpoints: [...this.state.consensus.viewpoints],
          }
        : null,
    };
  }

  replaceMessages(messages: RoundtableMessage[]): void {
    this.resetRunState();
    this.state = {
      messages: [...messages],
      outputs: [],
      consensus: null,
      status: 'idle',
      busy: false,
      error: null,
    };
    this.emit();
  }

  seatForMessageIndex(index: number): RoundtableSeat | null {
    return this.seatByIndex.get(index) ?? null;
  }

  async start(input: RoundtableStartInput): Promise<RoundtableStartResult> {
    if (this.state.busy) {
      const error = '论证进行中，请等待当前轮次完成';
      this.state = { ...this.state, status: 'idle', busy: false, error };
      this.emit();
      return { ok: false, error };
    }

    const seats = input.seats.slice(0, MAX_SEATS);
    if (seats.length < MIN_SEATS) {
      const error = '请至少勾选 2 位 Agent 席位';
      this.state = { ...this.state, status: 'idle', busy: false, error };
      this.emit();
      return { ok: false, error };
    }

    const runId = `prism-${++this.runCounter}`;
    const userMessage: RoundtableMessage = {
      id: makeMessageId(),
      role: 'user',
      content: input.text,
    };
    const placeholders: RoundtableMessage[] = seats.map(() => ({
      role: 'assistant',
      content: '__stream__',
    }));
    const userIndex = this.state.messages.length;
    const messages = [...this.state.messages, userMessage, ...placeholders];
    this.seatByIndex = new Map(seats.map((seat, index) => [userIndex + 1 + index, seat]));
    this.resetRunState();
    this.runIds = [];
    this.pending = seats.length;
    this.sessionId = input.sessionId;
    this.state = {
      messages,
      outputs: [],
      consensus: null,
      status: 'connecting',
      busy: true,
      error: null,
    };
    this.emit();

    if (input.sessionId) {
      await this.adapters
        .saveMessage(input.sessionId, 'user', input.text, userMessage.id)
        .catch(() => {});
    }

    const history = messages.slice(0, userIndex + 1);
    const streamPromises = seats.map((seat, index) => {
      const subRunId = `${runId}-s${index}`;
      this.runIds.push(subRunId);
      this.runs.set(subRunId, { content: '', index: userIndex + 1 + index });
      const apiMessages = buildApiMessages(seat, history, input);
      return this.adapters
        .sendStream({
          providerIds: input.providerIds,
          messages: apiMessages,
          runId: subRunId,
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          this.finalizeRun(subRunId, `请求失败: ${message}`, {
            success: false,
            save: true,
          });
        });
    });

    await Promise.all(streamPromises);

    const outputs = seats.map((seat, index) => ({
      seat,
      opinion: this.results.get(this.runIds[index] ?? '') ?? '',
    }));
    this.state = { ...this.state, outputs };
    this.emit();

    if (input.onStageDiscussing) {
      try {
        await input.onStageDiscussing();
      } catch {
        /* journey stage updates are best-effort */
      }
    }

    const consensus = await this.adapters
      .buildConsensus(outputs.map((o) => o.opinion))
      .catch(() => null);
    const consensusNote = buildConsensusNote(input.text, outputs, consensus);
    this.state = {
      ...this.state,
      messages: [...this.state.messages, { role: 'assistant', content: consensusNote }],
      consensus,
      status: 'idle',
      busy: false,
      error: null,
    };
    this.emit();

    if (this.sessionId) {
      const consensusIndex = this.state.messages.length - 1;
      await this.adapters
        .saveMessage(this.sessionId, 'assistant', consensusNote)
        .then((saved) => this.applySavedMessageId(consensusIndex, saved))
        .catch(() => {});
    }

    return { ok: true, runId, outputs, consensus, consensusNote };
  }

  private handleChunk(chunk: StreamChunk): void {
    if (!this.runIds.includes(chunk.id)) return;
    const run = this.runs.get(chunk.id);
    if (!run) return;

    if (!chunk.done) {
      run.content += chunk.delta;
      this.patchMessage(run.index, run.content);
      this.state = { ...this.state, status: 'streaming' };
      this.emit();
      return;
    }

    const finalContent = chunk.error
      ? `请求失败: ${chunk.error}`
      : chunk.cancelled && !run.content.endsWith('[stopped]')
        ? `${run.content}${run.content ? ' ' : ''}[stopped]`
        : run.content;
    this.finalizeRun(chunk.id, finalContent, {
      success: !chunk.error && !chunk.cancelled,
      save: Boolean(run.content || chunk.error || chunk.cancelled),
    });
  }

  private finalizeRun(
    runId: string,
    content: string,
    options: { success: boolean; save: boolean },
  ): void {
    if (this.completed.has(runId)) return;
    const run = this.runs.get(runId);
    if (!run) return;
    this.completed.add(runId);
    this.patchMessage(run.index, content);
    if (options.success) {
      this.results.set(runId, content);
    }
    if (options.save && this.sessionId) {
      void this.adapters
        .saveMessage(this.sessionId, 'assistant', content)
        .then((saved) => this.applySavedMessageId(run.index, saved))
        .catch(() => {});
    }
    this.runs.delete(runId);
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) {
      this.state = { ...this.state, status: 'idle', busy: true, error: null };
    } else {
      this.state = { ...this.state, status: 'streaming' };
    }
    this.emit();
  }

  private patchMessage(index: number, content: string): void {
    if (index < 0 || index >= this.state.messages.length) return;
    this.state = {
      ...this.state,
      messages: this.state.messages.map((m, i) => (i === index ? { ...m, content } : m)),
    };
  }

  private applySavedMessageId(index: number, saved: unknown): void {
    if (!saved || typeof saved !== 'object' || !('id' in saved)) return;
    const id = (saved as { id: unknown }).id;
    if (typeof id !== 'string') return;
    const message = this.state.messages[index];
    if (!message || message.id === id) return;
    this.state = {
      ...this.state,
      messages: this.state.messages.map((m, i) => (i === index ? { ...m, id } : m)),
    };
    this.emit();
  }

  private resetRunState(): void {
    this.runs.clear();
    this.runIds = [];
    this.results.clear();
    this.completed.clear();
    this.pending = 0;
    this.sessionId = null;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
