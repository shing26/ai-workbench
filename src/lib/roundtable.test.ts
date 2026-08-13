import { describe, expect, it } from 'vitest';
import type { StreamChunk } from './db';
import {
  RoundtableOrchestrator,
  type RoundtableSeat,
  type RoundtableSnapshot,
  type RoundtableStreamArgs,
} from './roundtable';

const seatA: RoundtableSeat = {
  id: 'product',
  name: 'Product Lead',
  role: 'Product',
  kpi: 'scope',
  prompt: '你是产品负责人，评估需求范围。',
  active: true,
};

const seatB: RoundtableSeat = {
  id: 'engineering',
  name: 'Engineering Lead',
  role: 'Engineering',
  kpi: 'architecture',
  prompt: '你是工程负责人，评估实现路径。',
  active: true,
};

function createHarness(options: { failRun?: (runId: string) => boolean } = {}) {
  let handler: ((chunk: StreamChunk) => void) | null = null;
  const calls: RoundtableStreamArgs[] = [];
  const saved: { role: string; content: string; id?: string }[] = [];
  const snapshots: RoundtableSnapshot[] = [];

  function emit(chunk: StreamChunk) {
    handler?.(chunk);
  }

  const orchestrator = new RoundtableOrchestrator({
    sendStream: async (args) => {
      calls.push(args);
      if (options.failRun?.(args.runId)) {
        emit({
          id: args.runId,
          delta: '',
          done: true,
          error: 'boom',
          cancelled: false,
        });
        return;
      }
      emit({
        id: args.runId,
        delta: `opinion-${args.runId} `,
        done: false,
        error: null,
        cancelled: false,
      });
      emit({
        id: args.runId,
        delta: '',
        done: true,
        error: null,
        cancelled: false,
      });
    },
    listenChunks: async (listener) => {
      handler = listener;
      return () => {
        if (handler === listener) handler = null;
      };
    },
    buildConsensus: async (contents) => ({
      summary: `共识：${contents.length} 席`,
      common: [],
      viewpoints: contents,
    }),
    saveMessage: async (_sessionId, role, content, id) => {
      saved.push({ role, content, id });
      return { id: id ?? 'saved' };
    },
  });

  const unsubscribe = orchestrator.subscribe((snapshot) => snapshots.push(snapshot));
  return { orchestrator, calls, saved, snapshots, unsubscribe };
}

describe('RoundtableOrchestrator', () => {
  it('runs two-round debate through the orchestrator seam', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.start({
      text: '是否采用旅程文档单一产物？',
      seats: [seatA, seatB],
      providerIds: ['p1'],
      sessionId: 's1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outputs).toHaveLength(2);
    expect(result.consensus?.summary).toContain('共识：2 席');

    const finalSnapshot = harness.snapshots[harness.snapshots.length - 1];
    expect(finalSnapshot?.status).toBe('idle');
    expect(finalSnapshot?.busy).toBe(false);
    expect(
      finalSnapshot?.messages.some((m) => m.role === 'user' && m.content.includes('旅程文档')),
    ).toBe(true);
    expect(finalSnapshot?.messages.some((m) => m.content.includes('Agency 圆桌共识'))).toBe(true);

    expect(harness.calls).toHaveLength(2);
    expect(
      harness.calls[0]?.messages.some(
        (m) => m.role === 'system' && m.content.includes(seatA.prompt),
      ),
    ).toBe(true);
    expect(
      harness.calls[1]?.messages.some(
        (m) => m.role === 'system' && m.content.includes(seatB.prompt),
      ),
    ).toBe(true);
    expect(harness.saved.some((m) => m.role === 'assistant' && m.content.includes('共识'))).toBe(
      true,
    );
  });

  it('blocks a roundtable with fewer than two seats', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.start({
      text: '单席论证',
      seats: [seatA],
      providerIds: ['p1'],
      sessionId: 's1',
    });

    expect(result).toEqual({ ok: false, error: '请至少勾选 2 位 Agent 席位' });
    expect(harness.calls).toHaveLength(0);
    expect(harness.snapshots[harness.snapshots.length - 1]?.error).toBe(
      '请至少勾选 2 位 Agent 席位',
    );
  });

  it('blocks a roundtable with more than five seats', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.start({
      text: '超席论证',
      seats: [seatA, seatB, seatA, seatB, seatA, seatB],
      providerIds: ['p1'],
      sessionId: 's1',
    });

    expect(result).toEqual({ ok: false, error: '最多选择 5 位 Agent 席位' });
    expect(harness.calls).toHaveLength(0);
    expect(harness.snapshots[harness.snapshots.length - 1]?.error).toBe('最多选择 5 位 Agent 席位');
  });

  it('surfaces failed lanes and keeps healthy lanes in the consensus', async () => {
    const harness = createHarness({ failRun: (runId) => runId.endsWith('-s1') });
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.start({
      text: '并行论证失败场景',
      seats: [seatA, seatB],
      providerIds: ['p1'],
      sessionId: 's1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outputs[0]?.opinion).toContain('opinion-');
    expect(result.outputs[1]?.opinion).toBe('');
    const finalSnapshot = harness.snapshots[harness.snapshots.length - 1];
    expect(finalSnapshot?.messages.some((m) => m.content.includes('请求失败: boom'))).toBe(true);
    expect(
      harness.saved.some((m) => m.role === 'assistant' && m.content.includes('请求失败')),
    ).toBe(true);
  });

  it('replaces messages and clears stale output between sessions', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    await harness.orchestrator.start({
      text: '前一会话',
      seats: [seatA, seatB],
      providerIds: ['p1'],
      sessionId: 's1',
    });
    harness.orchestrator.replaceMessages([{ role: 'assistant' as const, content: '新的空会话' }]);

    const snapshot = harness.snapshots[harness.snapshots.length - 1];
    expect(snapshot?.messages).toEqual([{ role: 'assistant', content: '新的空会话' }]);
    expect(snapshot?.outputs).toEqual([]);
    expect(snapshot?.consensus).toBeNull();
  });
});
