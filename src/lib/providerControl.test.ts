import { describe, expect, it } from 'vitest';
import type { Provider, ProviderModel, StreamSmokeResult } from './db';
import {
  ProviderControlOrchestrator,
  type ProviderControlAdapters,
  type ProviderControlSnapshot,
  type ProviderDraft,
} from './providerControl';

function provider(partial: Partial<Provider>): Provider {
  return {
    id: 'p1',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    model: 'gpt-4o-mini',
    providerType: 'openai-compatible',
    priority: 0,
    isActive: true,
    apiKeyEncrypted: false,
    timeoutSecs: 30,
    retryCount: 1,
    retryDelaySecs: 1,
    ...partial,
  };
}

function createHarness(
  options: {
    providers?: Provider[];
    savedSelection?: string | null;
    health?: Record<string, { ok: boolean; latencyMs: number; message: string }>;
  } = {},
) {
  let providers = [...(options.providers ?? [provider({})])];
  let savedSelection = options.savedSelection ?? null;
  const modelsByProvider: Record<string, ProviderModel[]> = {};
  const health = options.health ?? {};
  const snapshots: ProviderControlSnapshot[] = [];
  const created: ProviderDraft[] = [];
  const smokeCalls: string[] = [];
  const healthCalls: string[] = [];
  const refreshCalls: string[] = [];
  const deleted: string[] = [];
  const profileUpdates: Array<{ id: string; profile: unknown }> = [];

  const adapters: ProviderControlAdapters = {
    listProviders: async () => providers,
    createProvider: async (name, baseUrl, apiKey, model, providerType) => {
      const draft = { name, baseUrl, apiKey, model, providerType };
      created.push(draft);
      const next: Provider = provider({
        id: `p${providers.length + 1}`,
        name,
        baseUrl,
        apiKey,
        model,
        providerType,
        isActive: false,
      });
      providers = [next, ...providers];
      return next;
    },
    deleteProvider: async (id) => {
      deleted.push(id);
      providers = providers.filter((p) => p.id !== id);
      delete modelsByProvider[id];
    },
    setProviderActive: async (id, isActive) => {
      providers = providers.map((p) => (p.id === id ? { ...p, isActive } : p));
    },
    setProviderPriority: async (id, priority) => {
      providers = providers.map((p) => (p.id === id ? { ...p, priority } : p));
    },
    updateProviderModel: async (id, model) => {
      providers = providers.map((p) => (p.id === id ? { ...p, model } : p));
    },
    updateProviderProfile: async (id, profile) => {
      profileUpdates.push({ id, profile });
      const updated = providers.map((p) => (p.id === id ? { ...p, ...profile } : p));
      providers = updated;
      return updated.find((p) => p.id === id) as Provider;
    },
    updateProviderStreamConfig: async (id, timeoutSecs, retryCount, retryDelaySecs) => {
      providers = providers.map((p) =>
        p.id === id ? { ...p, timeoutSecs, retryCount, retryDelaySecs } : p,
      );
    },
    checkProviderHealth: async (id) => {
      healthCalls.push(id);
      return health[id] ?? { ok: true, latencyMs: 12, message: 'ok' };
    },
    runProviderStreamSmokeTest: async (id) => {
      smokeCalls.push(id);
      const result: StreamSmokeResult = { ok: true, chunks: 2, message: 'ok' };
      return result;
    },
    listCachedProviderModels: async (id) => modelsByProvider[id] ?? [],
    refreshProviderModels: async (id) => {
      refreshCalls.push(id);
      const models = [{ id: 'model-a', ownedBy: null }];
      modelsByProvider[id] = models;
      return models;
    },
    loadSelection: () => savedSelection,
    saveSelection: (id) => {
      savedSelection = id;
    },
  };

  const orchestrator = new ProviderControlOrchestrator(adapters);
  const unsubscribe = orchestrator.subscribe((snapshot) => snapshots.push(snapshot));
  return {
    orchestrator,
    snapshots,
    unsubscribe,
    created,
    smokeCalls,
    healthCalls,
    refreshCalls,
    deleted,
    profileUpdates,
    getProviders: () => providers,
    getSavedSelection: () => savedSelection,
  };
}

describe('ProviderControlOrchestrator', () => {
  it('returns a stable snapshot reference until state changes', () => {
    const harness = createHarness();

    const first = harness.orchestrator.getSnapshot();
    const second = harness.orchestrator.getSnapshot();

    expect(first).toBe(second);
  });

  it('mounts providers and restores the saved selection', async () => {
    const harness = createHarness({
      providers: [
        provider({ id: 'p1', isActive: true }),
        provider({ id: 'p2', name: 'Ollama', isActive: false }),
      ],
      savedSelection: 'p2',
    });

    await harness.orchestrator.mount();

    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.providers).toHaveLength(2);
    expect(snapshot.selectedProviderId).toBe('p2');
    expect(snapshot.selectedProvider?.name).toBe('Ollama');
  });

  it('creates a provider and makes it the active selection', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.addProvider({
      name: 'Local',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
      model: 'qwen2.5:3b',
      providerType: 'ollama',
    });

    expect(result).not.toBeNull();
    expect(harness.created[0]).toEqual({
      name: 'Local',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
      model: 'qwen2.5:3b',
      providerType: 'ollama',
    });
    expect(harness.orchestrator.getSnapshot().selectedProvider?.name).toBe('Local');
    expect(harness.getSavedSelection()).toBe(result?.id);
  });

  it('saves an explicit custom provider type', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.addProvider({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-deepseek',
      model: 'deepseek-chat',
      providerType: 'custom',
    });

    expect(result).not.toBeNull();
    expect(harness.created[0]).toEqual({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-deepseek',
      model: 'deepseek-chat',
      providerType: 'custom',
    });
    expect(harness.orchestrator.getSnapshot().selectedProvider?.providerType).toBe('custom');
  });

  it('rejects an invalid provider draft without writing', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const result = await harness.orchestrator.addProvider({
      name: '',
      baseUrl: 'not-a-url',
      apiKey: '',
      model: '',
      providerType: 'custom',
    });

    expect(result).toBeNull();
    expect(harness.created).toHaveLength(0);
    expect(harness.orchestrator.getSnapshot().error).toContain('Provider name is required');
  });

  it('stores health and smoke results per provider', async () => {
    const harness = createHarness({
      health: { p1: { ok: false, latencyMs: 40, message: 'Connection failed' } },
    });
    await harness.orchestrator.mount();

    const health = await harness.orchestrator.checkHealth('p1');
    const smoke = await harness.orchestrator.runSmoke('p1');

    expect(health?.status).toBe('error');
    expect(health?.message).toContain('Connection failed');
    expect(smoke?.status).toBe('ok');
    expect(smoke?.chunks).toBe(2);
    const snapshot = harness.orchestrator.getSnapshot();
    expect(snapshot.healthByProvider.p1?.status).toBe('error');
    expect(snapshot.smokeByProvider.p1?.status).toBe('ok');
    expect(harness.healthCalls).toEqual(['p1']);
    expect(harness.smokeCalls).toEqual(['p1']);
  });

  it('updates provider label, endpoint and vendor type', async () => {
    const harness = createHarness({
      providers: [provider({ id: 'p1', providerType: 'ollama' })],
    });
    await harness.orchestrator.mount();

    const updated = await harness.orchestrator.updateProviderProfile('p1', {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-deepseek',
      model: 'deepseek-chat',
      providerType: 'custom',
    });

    expect(updated?.name).toBe('DeepSeek');
    expect(updated?.providerType).toBe('custom');
    expect(harness.profileUpdates).toEqual([
      {
        id: 'p1',
        profile: {
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-deepseek',
          model: 'deepseek-chat',
          providerType: 'custom',
        },
      },
    ]);
    expect(harness.orchestrator.getSnapshot().selectedProvider?.baseUrl).toBe(
      'https://api.deepseek.com/v1',
    );
  });

  it('refreshes the model catalog for a provider', async () => {
    const harness = createHarness();
    await harness.orchestrator.mount();

    const models = await harness.orchestrator.refreshModels('p1');

    expect(models).toEqual([{ id: 'model-a', ownedBy: null }]);
    expect(harness.orchestrator.getSnapshot().modelsByProvider.p1?.[0]?.id).toBe('model-a');
    expect(harness.refreshCalls).toEqual(['p1']);
  });

  it('activates a provider and selects it when no selection exists', async () => {
    const harness = createHarness({
      providers: [provider({ id: 'p1', isActive: false })],
      savedSelection: null,
    });
    await harness.orchestrator.mount();
    expect(harness.orchestrator.getSnapshot().selectedProviderId).toBe('p1');

    await harness.orchestrator.selectProvider('p1');

    expect(harness.orchestrator.getSnapshot().selectedProviderId).toBe('p1');
    expect(harness.orchestrator.getSnapshot().selectedProvider?.id).toBe('p1');
    expect(harness.getSavedSelection()).toBe('p1');
  });

  it('deletes a provider and selects the next available provider', async () => {
    const harness = createHarness({
      providers: [
        provider({ id: 'p1', isActive: true }),
        provider({ id: 'p2', name: 'Ollama', isActive: false }),
      ],
      savedSelection: 'p1',
    });
    await harness.orchestrator.mount();

    const ok = await harness.orchestrator.deleteProvider('p1');

    expect(ok).toBe(true);
    expect(harness.deleted).toEqual(['p1']);
    expect(harness.getProviders()).toHaveLength(1);
    expect(harness.orchestrator.getSnapshot().selectedProviderId).toBe('p2');
    expect(harness.getSavedSelection()).toBe('p2');
  });
});
