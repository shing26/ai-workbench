import * as db from './db';
import {
  DELIVERY_RUN_LIMIT,
  type CliExited,
  type CliLogLine,
  type DeliveryRun,
  type QualityGateResult,
} from './db';
import { usePrismModals } from '../components/modals/prismModalsStore';

export const MAX_FIX_ROUNDS = 2;
export const MAX_DELIVERY_RUNS = DELIVERY_RUN_LIMIT;

export type DeliveryCliLog = Omit<CliLogLine, 'runId'> & { runId: string | null };

export type DeliveryCliSnapshot = {
  runId: string | null;
  deliveryRunId: string | null;
  command: string;
  commandText: string;
  logs: DeliveryCliLog[];
  running: boolean;
  exitCode: number | null;
  projectPath: string;
};

export type DeliverySnapshot = {
  runs: DeliveryRun[];
  recentRuns: DeliveryRun[];
  gateResult: QualityGateResult | null;
  gateRunning: boolean;
  gateError: string | null;
  fixRound: number;
  activeCli: DeliveryCliSnapshot | null;
};

export type DeliveryFixInput = {
  projectPath: string;
  projectName: string;
  specPath?: string | null;
  tasks: string[];
};

export type DeliveryCliInput = {
  projectPath: string;
  command: string;
  args: string[];
  prompt: string;
  isFix?: boolean;
};

export type DeliveryFixStartResult =
  { ok: true; prompt: string; fixRound: number } | { ok: false; error: string };

export type DeliveryCliStartResult = { ok: true; runId: string } | { ok: false; error: string };

export type DeliveryOpenCliPayload = {
  projectName: string;
  specPath?: string | null;
  prompt: string;
  tasks: string[];
  isFix?: boolean;
};

export type DeliveryAdapters = {
  listRuns: () => Promise<DeliveryRun[]> | DeliveryRun[];
  recordRun: (run: DeliveryRun) => Promise<DeliveryRun> | DeliveryRun;
  runQualityGate: (projectPath: string, dodPath?: string | null) => Promise<QualityGateResult>;
  spawnCliProcess: (
    projectPath: string,
    command: string,
    args: string[],
    cwd?: string,
  ) => Promise<{ runId: string }>;
  listenCliLog: (handler: (line: CliLogLine) => void) => Promise<() => void>;
  listenCliExit: (handler: (evt: CliExited) => void) => Promise<() => void>;
  openCli: (payload: DeliveryOpenCliPayload) => void | Promise<void>;
};

function makeId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sortRuns(runs: DeliveryRun[]): DeliveryRun[] {
  return [...runs].sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_DELIVERY_RUNS);
}

export function buildFixPrompt(
  gateResult: QualityGateResult,
  specPath: string | null | undefined,
  fixRound: number,
): string {
  return [
    `验证未通过（第 ${fixRound} 轮修复），错误日志如下：`,
    '',
    gateResult.errors.join('\n'),
    '',
    specPath
      ? `请读取 ${specPath}，并修复上述问题。`
      : '请先读取项目现有旅程文档，再修复上述问题。',
  ].join('\n');
}

function defaultAdapters(): DeliveryAdapters {
  return {
    listRuns: () => db.listDeliveryRuns(),
    recordRun: (run) => db.recordDeliveryRun(run),
    runQualityGate: (projectPath, dodPath) => db.runQualityGate(projectPath, dodPath),
    spawnCliProcess: (projectPath, command, args, cwd) =>
      db.spawnCliProcess(projectPath, command, args, cwd),
    listenCliLog: (handler) => db.listenCliLog(handler),
    listenCliExit: (handler) => db.listenCliExit(handler),
    openCli: (payload) =>
      usePrismModals.getState().openCli({ ...payload, specPath: payload.specPath ?? undefined }),
  };
}

export class DeliveryOrchestrator {
  private readonly adapters: DeliveryAdapters;
  private readonly listeners = new Set<(snapshot: DeliverySnapshot) => void>();
  private state: DeliverySnapshot = {
    runs: [],
    recentRuns: [],
    gateResult: null,
    gateRunning: false,
    gateError: null,
    fixRound: 0,
    activeCli: null,
  };
  private currentRun: DeliveryRun | null = null;
  private currentRunId: string | null = null;
  private unlistenLog: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;
  private mountPromise: Promise<void> | null = null;
  private mountGeneration = 0;

  constructor(adapters?: DeliveryAdapters) {
    this.adapters = adapters ?? defaultAdapters();
  }

  async mount(): Promise<void> {
    if (this.mountPromise) {
      await this.mountPromise;
      return;
    }
    const generation = ++this.mountGeneration;
    this.unlistenLog?.();
    this.unlistenLog = null;
    this.unlistenExit?.();
    this.unlistenExit = null;

    this.mountPromise = Promise.all([
      this.adapters.listenCliLog((line) => this.handleLog(line)),
      this.adapters.listenCliExit((evt) => void this.handleExit(evt)),
      Promise.resolve(this.adapters.listRuns()).catch(() => []),
    ]).then(([unlistenLog, unlistenExit, runs]) => {
      if (generation !== this.mountGeneration) {
        unlistenLog();
        unlistenExit();
        return;
      }
      this.unlistenLog = unlistenLog;
      this.unlistenExit = unlistenExit;
      this.applyRuns(runs);
    });

    await this.mountPromise;
  }

  dispose(): void {
    this.mountGeneration += 1;
    this.unlistenLog?.();
    this.unlistenExit?.();
    this.unlistenLog = null;
    this.unlistenExit = null;
    this.mountPromise = null;
    this.listeners.clear();
  }

  subscribe(listener: (snapshot: DeliverySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): DeliverySnapshot {
    return this.state;
  }

  async runGate(projectPath: string, dodPath?: string | null): Promise<QualityGateResult | null> {
    return this.executeGate(projectPath, dodPath ?? null);
  }

  async refreshGate(
    projectPath: string,
    dodPath?: string | null,
  ): Promise<QualityGateResult | null> {
    return this.executeGate(projectPath, dodPath ?? null);
  }

  private async executeGate(
    projectPath: string,
    dodPath: string | null,
  ): Promise<QualityGateResult | null> {
    if (this.state.gateRunning) return this.state.gateResult;
    this.patch({ gateRunning: true, gateError: null });
    try {
      const result = await this.adapters.runQualityGate(projectPath, dodPath);
      const now = Date.now();
      const base =
        this.currentRun &&
        this.currentRun.projectPath === projectPath &&
        this.currentRun.gateResult !== null
          ? this.currentRun
          : null;
      const run: DeliveryRun = base
        ? { ...base, gateResult: result, finishedAt: now }
        : {
            runId: makeId('delivery'),
            projectPath,
            command: '',
            exitCode: null,
            startedAt: now,
            finishedAt: now,
            gateResult: result,
            fixRound: 0,
          };
      this.currentRun = run;
      this.currentRunId = run.runId;
      await this.persistRun(run, true);
      this.patch({
        gateResult: result,
        gateRunning: false,
        gateError: null,
        fixRound: run.fixRound,
      });
      return result;
    } catch (err) {
      this.patch({ gateRunning: false, gateError: errorMessage(err) });
      return null;
    }
  }

  async startFix(input: DeliveryFixInput): Promise<DeliveryFixStartResult> {
    if (this.state.activeCli?.running) {
      return { ok: false, error: 'CLI is already running' };
    }
    const gateResult = this.state.gateResult;
    if (!gateResult || gateResult.status === 'GREEN') {
      return { ok: false, error: 'No failed gate to fix' };
    }
    if (this.state.fixRound >= MAX_FIX_ROUNDS) {
      return { ok: false, error: `Fix limit reached (${MAX_FIX_ROUNDS})` };
    }

    const nextRound = this.state.fixRound + 1;
    const now = Date.now();
    const base = this.currentRun ?? {
      runId: makeId('delivery'),
      projectPath: input.projectPath,
      command: '',
      exitCode: null,
      startedAt: now,
      finishedAt: null,
      gateResult,
      fixRound: 0,
    };
    const run: DeliveryRun = {
      ...base,
      projectPath: base.projectPath || input.projectPath,
      command: '',
      exitCode: null,
      finishedAt: null,
      gateResult,
      fixRound: nextRound,
    };
    this.currentRun = run;
    this.currentRunId = run.runId;
    await this.persistRun(run, true);

    const prompt = buildFixPrompt(gateResult, input.specPath, nextRound);
    this.patch({ fixRound: nextRound, gateError: null });
    await this.adapters.openCli({
      projectName: input.projectName,
      specPath: input.specPath ?? null,
      prompt,
      tasks: input.tasks,
      isFix: true,
    });
    return { ok: true, prompt, fixRound: nextRound };
  }

  async startCli(input: DeliveryCliInput): Promise<DeliveryCliStartResult> {
    if (this.state.activeCli?.running) {
      return { ok: false, error: 'CLI is already running' };
    }

    const now = Date.now();
    const isFix =
      input.isFix === true &&
      this.currentRun !== null &&
      this.currentRun.projectPath === input.projectPath;
    const run: DeliveryRun =
      isFix && this.currentRun
        ? { ...this.currentRun, command: input.command, exitCode: null, finishedAt: null }
        : {
            runId: makeId('delivery'),
            projectPath: input.projectPath,
            command: input.command,
            exitCode: null,
            startedAt: now,
            finishedAt: null,
            gateResult: null,
            fixRound: 0,
          };
    if (isFix) {
      this.currentRun = run;
      this.currentRunId = run.runId;
    }

    const commandText = `${input.command} "${input.prompt}"`;
    this.patch({
      activeCli: {
        runId: null,
        deliveryRunId: run.runId,
        command: input.command,
        commandText,
        logs: [{ runId: null, line: `$ ${commandText}`, stream: 'stdout' }],
        running: true,
        exitCode: null,
        projectPath: input.projectPath,
      },
    });
    await this.persistRun(run, isFix);

    try {
      const result = await this.adapters.spawnCliProcess(
        input.projectPath,
        input.command,
        input.args,
      );
      const current = this.state.activeCli;
      if (current && current.deliveryRunId === run.runId && current.runId === null) {
        this.patch({ activeCli: { ...current, runId: result.runId } });
      }
      return { ok: true, runId: result.runId };
    } catch (err) {
      const message = errorMessage(err);
      const current = this.state.activeCli;
      this.patch({
        activeCli: {
          runId: null,
          deliveryRunId: run.runId,
          command: input.command,
          commandText,
          logs: [...(current?.logs ?? []), { runId: null, line: message, stream: 'stderr' }],
          running: false,
          exitCode: null,
          projectPath: input.projectPath,
        },
      });
      return { ok: false, error: message };
    }
  }

  private handleLog(line: CliLogLine): void {
    const active = this.state.activeCli;
    if (!active || (active.runId !== null && active.runId !== line.runId)) return;
    const bound = active.runId === null ? { ...active, runId: line.runId } : active;
    this.patch({ activeCli: { ...bound, logs: [...bound.logs, line] } });
  }

  private async handleExit(evt: CliExited): Promise<void> {
    const active = this.state.activeCli;
    if (!active || (active.runId !== null && active.runId !== evt.runId)) return;
    const bound = active.runId === null ? { ...active, runId: evt.runId } : active;
    const finishedAt = Date.now();
    this.patch({ activeCli: { ...bound, running: false, exitCode: evt.exitCode } });
    const existing = this.state.runs.find((run) => run.runId === bound.deliveryRunId);
    if (existing) {
      const run: DeliveryRun = {
        ...existing,
        command: bound.command,
        exitCode: evt.exitCode,
        finishedAt,
      };
      await this.persistRun(run, this.currentRunId === run.runId);
    }
  }

  private applyRuns(runs: DeliveryRun[]): void {
    const sorted = sortRuns(runs);
    const latest = sorted[0] ?? null;
    const gateAttempt =
      sorted.find((run) => run.gateResult !== null && run.command === '') ??
      sorted.find((run) => run.gateResult !== null) ??
      latest;
    const current = gateAttempt ?? latest;
    this.currentRun = current;
    this.currentRunId = current?.runId ?? null;
    this.state = {
      ...this.state,
      runs: sorted,
      recentRuns: sorted.slice(0, 6),
      gateResult: current?.gateResult ?? null,
      fixRound: current?.fixRound ?? 0,
    };
    this.emit();
  }

  private async persistRun(run: DeliveryRun, setCurrent: boolean): Promise<DeliveryRun> {
    if (setCurrent) {
      this.currentRun = run;
      this.currentRunId = run.runId;
    }
    this.patchRuns(run);
    try {
      const saved = await this.adapters.recordRun(run);
      if (setCurrent) {
        this.currentRun = saved;
      }
      this.patchRuns(saved);
      return saved;
    } catch {
      return run;
    }
  }

  private patchRuns(run: DeliveryRun): void {
    const runs = sortRuns([run, ...this.state.runs.filter((item) => item.runId !== run.runId)]);
    this.patch({ runs, recentRuns: runs.slice(0, 6) });
  }

  private patch(patch: Partial<DeliverySnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

export const deliveryOrchestrator = new DeliveryOrchestrator();
