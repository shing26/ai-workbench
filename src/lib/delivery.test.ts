import { describe, expect, it } from 'vitest';
import type { CliExited, CliLogLine, DeliveryRun, QualityGateResult } from './db';
import { DeliveryOrchestrator, type DeliveryAdapters, type DeliverySnapshot } from './delivery';

function gateResult(status: 'GREEN' | 'FAILED', errors: string[] = []): QualityGateResult {
  return {
    status,
    errors,
    levels: [1, 2, 3, 4].map((level) => ({
      level,
      name: `L${level}`,
      status,
      errors: status === 'FAILED' && level === 1 ? errors : [],
      durationMs: 0,
    })),
  };
}

function deliveryRun(partial: Partial<DeliveryRun>): DeliveryRun {
  return {
    runId: 'run-1',
    projectPath: '/project',
    command: '',
    exitCode: null,
    startedAt: 100,
    finishedAt: null,
    gateResult: null,
    fixRound: 0,
    ...partial,
  };
}

function createHarness(
  options: {
    initialRuns?: DeliveryRun[];
    gateResult?: QualityGateResult;
    spawnCliProcess?: DeliveryAdapters['spawnCliProcess'];
  } = {},
) {
  let logHandler: ((line: CliLogLine) => void) | null = null;
  let exitHandler: ((evt: CliExited) => void) | null = null;
  const runs = [...(options.initialRuns ?? [])];
  const persisted: DeliveryRun[] = [];
  const openedCli: {
    projectName: string;
    specPath?: string | null;
    prompt: string;
    tasks: string[];
  }[] = [];
  const snapshots: DeliverySnapshot[] = [];
  let cliCounter = 0;
  let currentGateResult = options.gateResult ?? gateResult('GREEN');
  const spawnCliProcess =
    options.spawnCliProcess ?? (async () => ({ runId: `cli-${++cliCounter}` }));

  const adapters: DeliveryAdapters = {
    listRuns: async () => [...runs].sort((a, b) => b.startedAt - a.startedAt),
    recordRun: async (run) => {
      const index = runs.findIndex((item) => item.runId === run.runId);
      if (index >= 0) runs[index] = run;
      else runs.push(run);
      const existing = persisted.findIndex((item) => item.runId === run.runId);
      if (existing >= 0) persisted[existing] = run;
      else persisted.push(run);
      return run;
    },
    runQualityGate: async () => currentGateResult,
    spawnCliProcess,
    listenCliLog: async (handler) => {
      logHandler = handler;
      return () => {
        if (logHandler === handler) logHandler = null;
      };
    },
    listenCliExit: async (handler) => {
      exitHandler = handler;
      return () => {
        if (exitHandler === handler) exitHandler = null;
      };
    },
    openCli: async (payload) => {
      openedCli.push(payload);
    },
  };

  const orchestrator = new DeliveryOrchestrator(adapters);
  const unsubscribe = orchestrator.subscribe((snapshot) => snapshots.push(snapshot));

  return {
    orchestrator,
    persisted,
    openedCli,
    snapshots,
    unsubscribe,
    setGateResult: (result: QualityGateResult) => {
      currentGateResult = result;
    },
    emitLog: (line: CliLogLine) => logHandler?.(line),
    emitExit: (evt: CliExited) => exitHandler?.(evt),
  };
}

describe('DeliveryOrchestrator', () => {
  it('restores the latest delivery attempt from persisted runs', async () => {
    const harness = createHarness({
      initialRuns: [
        deliveryRun({
          runId: 'delivery-2',
          projectPath: '/project',
          command: 'claude',
          exitCode: 1,
          startedAt: 200,
          finishedAt: 300,
          gateResult: gateResult('FAILED', ['boom']),
          fixRound: 1,
        }),
      ],
    });

    await harness.orchestrator.mount();

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.gateResult?.status).toBe('FAILED');
    expect(snapshot.fixRound).toBe(1);
    expect(snapshot.runs[0]?.runId).toBe('delivery-2');
  });

  it('runs the gate and persists one delivery attempt', async () => {
    const harness = createHarness({ gateResult: gateResult('GREEN') });
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.runGate('/project', 'docs/journey/spec.md');

    expect(result?.status).toBe('GREEN');
    expect(harness.persisted).toHaveLength(1);
    expect(harness.persisted[0]).toMatchObject({
      projectPath: '/project',
      command: '',
      exitCode: null,
      fixRound: 0,
    });
    expect(harness.orchestrator.getSnapshot().gateRunning).toBe(false);
  });

  it('reuses the attempt through auto-fix and CLI exit', async () => {
    const harness = createHarness({ gateResult: gateResult('FAILED', ['error A']) });
    await harness.orchestrator.mount();

    await harness.orchestrator.runGate('/project', 'docs/journey/spec.md');
    const fix = await harness.orchestrator.startFix({
      projectPath: '/project',
      projectName: 'Project',
      specPath: 'docs/journey/spec.md',
      tasks: ['Fix failing gate'],
    });

    expect(fix.ok).toBe(true);
    expect(harness.orchestrator.getSnapshot().fixRound).toBe(1);
    expect(harness.openedCli[0]?.prompt).toContain('error A');

    const cli = await harness.orchestrator.startCli({
      projectPath: '/project',
      command: 'claude',
      args: ['-p', 'fix'],
      prompt: 'Fix failing gate',
      isFix: true,
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;

    harness.emitLog({
      runId: cli.runId,
      line: 'fixing',
      stream: 'stdout',
    });
    harness.emitExit({ runId: cli.runId, exitCode: 0 });

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.activeCli?.running).toBe(false);
    expect(snapshot.activeCli?.exitCode).toBe(0);
    expect(snapshot.recentRuns[0]).toMatchObject({
      command: 'claude',
      exitCode: 0,
      fixRound: 1,
    });
    expect(harness.persisted[0]).toMatchObject({
      command: 'claude',
      exitCode: 0,
      fixRound: 1,
    });
  });

  it('creates an independent run for manual CLI dispatch', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const cli = await harness.orchestrator.startCli({
      projectPath: '/manual-project',
      command: 'codex',
      args: ['do'],
      prompt: 'Do the task',
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;

    harness.emitExit({ runId: cli.runId, exitCode: 2 });

    expect(harness.persisted).toHaveLength(1);
    expect(harness.persisted[0]).toMatchObject({
      projectPath: '/manual-project',
      command: 'codex',
      exitCode: 2,
      fixRound: 0,
      gateResult: null,
    });
  });

  it('keeps a manual CLI dispatch independent after a fix modal is opened', async () => {
    const harness = createHarness({ gateResult: gateResult('FAILED', ['gate failed']) });
    await harness.orchestrator.mount();

    await harness.orchestrator.runGate('/project');
    const fix = await harness.orchestrator.startFix({
      projectPath: '/project',
      projectName: 'Project',
      tasks: ['Fix'],
    });
    expect(fix.ok).toBe(true);

    const cli = await harness.orchestrator.startCli({
      projectPath: '/project',
      command: 'codex',
      args: ['do'],
      prompt: 'Manual task',
      isFix: false,
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;

    harness.emitExit({ runId: cli.runId, exitCode: 2 });

    expect(harness.persisted).toHaveLength(2);
    const manualRun = harness.persisted.find((run) => run.command === 'codex');
    expect(manualRun).toMatchObject({
      projectPath: '/project',
      command: 'codex',
      exitCode: 2,
      fixRound: 0,
      gateResult: null,
    });
    expect(harness.orchestrator.getSnapshot().gateResult?.status).toBe('FAILED');
  });

  it('persists a fast CLI exit that arrives before spawn resolves', async () => {
    let markSpawnStarted: () => void = () => {};
    let resolveSpawn: (value: { runId: string }) => void = () => {};
    const spawnStarted = new Promise<void>((resolve) => {
      markSpawnStarted = resolve;
    });
    const spawnResult = new Promise<{ runId: string }>((resolve) => {
      resolveSpawn = resolve;
    });
    const harness = createHarness({
      gateResult: gateResult('FAILED', ['gate failed']),
      spawnCliProcess: async () => {
        markSpawnStarted();
        return spawnResult;
      },
    });
    await harness.orchestrator.mount();

    await harness.orchestrator.runGate('/project');
    const fix = await harness.orchestrator.startFix({
      projectPath: '/project',
      projectName: 'Project',
      tasks: ['Fix'],
    });
    expect(fix.ok).toBe(true);

    const cliPromise = harness.orchestrator.startCli({
      projectPath: '/project',
      command: 'claude',
      args: ['-p', 'fix'],
      prompt: 'Fix failing gate',
      isFix: true,
    });
    await spawnStarted;
    harness.emitExit({ runId: 'cli-fast', exitCode: 7 });
    resolveSpawn({ runId: 'cli-fast' });
    const cli = await cliPromise;
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.activeCli).toMatchObject({
      runId: 'cli-fast',
      running: false,
      exitCode: 7,
    });
    expect(harness.persisted[0]).toMatchObject({
      command: 'claude',
      exitCode: 7,
      fixRound: 1,
    });
  });

  it('keeps a manual CLI dispatch separate from the current gate attempt', async () => {
    const harness = createHarness({ gateResult: gateResult('FAILED', ['gate failed']) });
    await harness.orchestrator.mount();

    await harness.orchestrator.runGate('/project');
    const cli = await harness.orchestrator.startCli({
      projectPath: '/project',
      command: 'codex',
      args: ['do'],
      prompt: 'Manual task',
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;

    harness.emitExit({ runId: cli.runId, exitCode: 2 });

    expect(harness.persisted).toHaveLength(2);
    const gateRun = harness.persisted.find((run) => run.gateResult !== null);
    const manualRun = harness.persisted.find((run) => run.command === 'codex');
    expect(gateRun?.runId).not.toBe(manualRun?.runId);
    expect(manualRun).toMatchObject({
      projectPath: '/project',
      command: 'codex',
      exitCode: 2,
      fixRound: 0,
      gateResult: null,
    });
    expect(harness.orchestrator.getSnapshot().gateResult?.status).toBe('FAILED');
  });

  it('refreshes the latest gate result without resetting fix round', async () => {
    const harness = createHarness({ gateResult: gateResult('FAILED', ['first failure']) });
    await harness.orchestrator.mount();

    await harness.orchestrator.runGate('/project');
    const fix = await harness.orchestrator.startFix({
      projectPath: '/project',
      projectName: 'Project',
      tasks: ['Fix'],
    });
    expect(fix.ok).toBe(true);

    harness.setGateResult(gateResult('GREEN'));
    await harness.orchestrator.refreshGate('/project');

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.gateResult?.status).toBe('GREEN');
    expect(snapshot.fixRound).toBe(1);
    expect(harness.persisted[0]?.fixRound).toBe(1);
  });

  it('restores the gate attempt even when a later manual CLI run exists', async () => {
    const harness = createHarness({
      initialRuns: [
        deliveryRun({
          runId: 'delivery-gate',
          projectPath: '/project',
          command: '',
          exitCode: null,
          startedAt: 100,
          finishedAt: 150,
          gateResult: gateResult('FAILED', ['old failure']),
          fixRound: 2,
        }),
        deliveryRun({
          runId: 'delivery-manual',
          projectPath: '/project',
          command: 'codex',
          exitCode: 1,
          startedAt: 200,
          finishedAt: 250,
          gateResult: null,
          fixRound: 0,
        }),
      ],
    });

    await harness.orchestrator.mount();

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.gateResult?.status).toBe('FAILED');
    expect(snapshot.fixRound).toBe(2);
    expect(snapshot.recentRuns[0]?.runId).toBe('delivery-manual');
    expect(harness.orchestrator.getSnapshot().gateResult).not.toBeNull();
  });
});
