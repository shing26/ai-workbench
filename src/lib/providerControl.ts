import * as db from './db';

export const PROVIDER_SELECTION_KEY = 'ai-workbench:provider-selection:v1';

export const PROVIDER_PRESETS = [
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:3b',
  },
] as const;

export type ProviderDraft = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ProviderContext = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
};

export type ProviderTestState = {
  status: 'idle' | 'running' | 'ok' | 'error';
  message: string;
  at?: number;
  latencyMs?: number;
  chunks?: number;
};

export type ProviderControlSnapshot = {
  providers: db.Provider[];
  selectedProviderId: string | null;
  selectedProvider: db.Provider | null;
  modelsByProvider: Record<string, db.ProviderModel[]>;
  healthByProvider: Record<string, ProviderTestState>;
  smokeByProvider: Record<string, ProviderTestState>;
  busyProviderId: string | null;
  error: string | null;
};

export type ProviderControlAdapters = {
  listProviders: () => Promise<db.Provider[]> | db.Provider[];
  createProvider: (
    name: string,
    baseUrl: string,
    apiKey: string,
    model: string,
  ) => Promise<db.Provider> | db.Provider;
  deleteProvider: (id: string) => Promise<void> | void;
  setProviderActive: (id: string, isActive: boolean) => Promise<void> | void;
  setProviderPriority: (id: string, priority: number) => Promise<void> | void;
  updateProviderModel: (id: string, model: string) => Promise<void> | void;
  updateProviderStreamConfig: (
    id: string,
    timeoutSecs: number,
    retryCount: number,
    retryDelaySecs: number,
  ) => Promise<void> | void;
  checkProviderHealth: (id: string) => Promise<db.ProviderHealth> | db.ProviderHealth;
  runProviderStreamSmokeTest: (id: string) => Promise<db.StreamSmokeResult> | db.StreamSmokeResult;
  listCachedProviderModels: (id: string) => Promise<db.ProviderModel[]> | db.ProviderModel[];
  refreshProviderModels: (id: string) => Promise<db.ProviderModel[]> | db.ProviderModel[];
  loadSelection: () => string | null;
  saveSelection: (id: string | null) => void;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function readStoredSelection(): string | null {
  try {
    return localStorage.getItem(PROVIDER_SELECTION_KEY);
  } catch {
    return null;
  }
}

function writeStoredSelection(id: string | null): void {
  try {
    if (id) localStorage.setItem(PROVIDER_SELECTION_KEY, id);
    else localStorage.removeItem(PROVIDER_SELECTION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function defaultAdapters(): ProviderControlAdapters {
  return {
    listProviders: () => db.listProviders(),
    createProvider: (name, baseUrl, apiKey, model) =>
      db.createProvider(name, baseUrl, apiKey, model),
    deleteProvider: (id) => db.deleteProvider(id),
    setProviderActive: (id, isActive) => db.setProviderActive(id, isActive),
    setProviderPriority: (id, priority) => db.setProviderPriority(id, priority),
    updateProviderModel: (id, model) => db.updateProviderModel(id, model),
    updateProviderStreamConfig: (id, timeoutSecs, retryCount, retryDelaySecs) =>
      db.updateProviderStreamConfig(id, timeoutSecs, retryCount, retryDelaySecs),
    checkProviderHealth: (id) => db.checkProviderHealth(id),
    runProviderStreamSmokeTest: (id) => db.runProviderStreamSmokeTest(id),
    listCachedProviderModels: (id) => db.listCachedProviderModels(id),
    refreshProviderModels: (id) => db.refreshProviderModels(id),
    loadSelection: readStoredSelection,
    saveSelection: writeStoredSelection,
  };
}

export function normalizeProviderDraft(input: ProviderDraft): {
  ok: boolean;
  errors: string[];
  value: ProviderDraft;
} {
  const value = {
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim(),
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
  };
  const errors: string[] = [];
  if (!value.name) errors.push('Provider name is required');
  if (!/^https?:\/\//i.test(value.baseUrl)) {
    errors.push('Base URL must start with http:// or https://');
  }
  return { ok: errors.length === 0, errors, value };
}

export function providerContext(provider: db.Provider): ProviderContext {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    model: provider.model,
  };
}

export function idleTestState(): ProviderTestState {
  return { status: 'idle', message: '' };
}

function testStateFromHealth(health: db.ProviderHealth): ProviderTestState {
  return {
    status: health.ok ? 'ok' : 'error',
    message: health.ok ? `ok ${health.latencyMs}ms` : health.message,
    latencyMs: health.latencyMs,
    at: Date.now(),
  };
}

function testStateFromSmoke(smoke: db.StreamSmokeResult): ProviderTestState {
  return {
    status: smoke.ok ? 'ok' : 'error',
    message: smoke.ok
      ? `Streamed ${smoke.chunks} chunk(s)`
      : smoke.message || 'Stream smoke test failed',
    chunks: smoke.chunks,
    at: Date.now(),
  };
}

export class ProviderControlOrchestrator {
  private readonly adapters: ProviderControlAdapters;
  private readonly listeners = new Set<(snapshot: ProviderControlSnapshot) => void>();
  private state: ProviderControlSnapshot = {
    providers: [],
    selectedProviderId: null,
    selectedProvider: null,
    modelsByProvider: {},
    healthByProvider: {},
    smokeByProvider: {},
    busyProviderId: null,
    error: null,
  };
  private snapshot: ProviderControlSnapshot = {
    providers: [],
    selectedProviderId: null,
    selectedProvider: null,
    modelsByProvider: {},
    healthByProvider: {},
    smokeByProvider: {},
    busyProviderId: null,
    error: null,
  };
  private mountPromise: Promise<void> | null = null;
  private mountGeneration = 0;

  constructor(adapters?: Partial<ProviderControlAdapters>) {
    this.adapters = { ...defaultAdapters(), ...adapters };
  }

  async mount(): Promise<void> {
    if (this.mountPromise) {
      await this.mountPromise;
      return;
    }
    const generation = ++this.mountGeneration;
    this.mountPromise = this.loadProviders().finally(() => {
      if (generation === this.mountGeneration) this.mountPromise = null;
    });
    await this.mountPromise;
  }

  dispose(): void {
    this.mountGeneration += 1;
    this.mountPromise = null;
    this.listeners.clear();
  }

  subscribe(listener: (snapshot: ProviderControlSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ProviderControlSnapshot {
    return this.snapshot;
  }

  async selectProvider(id: string | null): Promise<void> {
    const providers = this.state.providers;
    const selectedProviderId = id && providers.some((provider) => provider.id === id) ? id : null;
    const selectedProvider =
      providers.find((provider) => provider.id === selectedProviderId) ?? null;
    this.patch({ selectedProviderId, selectedProvider });
    this.adapters.saveSelection(selectedProviderId);
  }

  async addProvider(draft: ProviderDraft): Promise<db.Provider | null> {
    const normalized = normalizeProviderDraft(draft);
    if (!normalized.ok) {
      this.patch({ error: normalized.errors.join('; ') });
      return null;
    }
    try {
      const provider = await Promise.resolve(
        this.adapters.createProvider(
          normalized.value.name,
          normalized.value.baseUrl,
          normalized.value.apiKey,
          normalized.value.model,
        ),
      );
      await this.refreshProviders();
      await this.selectProvider(provider.id);
      this.patch({ error: null });
      return provider;
    } catch (err) {
      this.patch({ error: errorMessage(err) });
      return null;
    }
  }

  async deleteProvider(id: string): Promise<boolean> {
    this.patch({ busyProviderId: id, error: null });
    try {
      await Promise.resolve(this.adapters.deleteProvider(id));
      await this.refreshProviders();
      this.patch({
        busyProviderId: null,
        modelsByProvider: Object.fromEntries(
          Object.entries(this.state.modelsByProvider).filter(([providerId]) => providerId !== id),
        ),
        healthByProvider: Object.fromEntries(
          Object.entries(this.state.healthByProvider).filter(([providerId]) => providerId !== id),
        ),
        smokeByProvider: Object.fromEntries(
          Object.entries(this.state.smokeByProvider).filter(([providerId]) => providerId !== id),
        ),
        error: null,
      });
      return true;
    } catch (err) {
      this.patch({ busyProviderId: null, error: errorMessage(err) });
      return false;
    }
  }

  async toggleProvider(id: string, isActive: boolean): Promise<void> {
    try {
      await Promise.resolve(this.adapters.setProviderActive(id, isActive));
      await this.refreshProviders();
      if (isActive && !this.state.selectedProviderId) {
        await this.selectProvider(id);
      }
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    }
  }

  async setProviderPriority(id: string, priority: number): Promise<void> {
    try {
      await Promise.resolve(this.adapters.setProviderPriority(id, priority));
      await this.refreshProviders();
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    }
  }

  async setProviderModel(id: string, model: string): Promise<void> {
    try {
      await Promise.resolve(this.adapters.updateProviderModel(id, model));
      await this.refreshProviders();
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    }
  }

  async setProviderStreamConfig(
    id: string,
    timeoutSecs: number,
    retryCount: number,
    retryDelaySecs: number,
  ): Promise<void> {
    try {
      await Promise.resolve(
        this.adapters.updateProviderStreamConfig(id, timeoutSecs, retryCount, retryDelaySecs),
      );
      await this.refreshProviders();
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    }
  }

  async checkHealth(id: string): Promise<ProviderTestState | null> {
    return this.runProviderTest(id, 'health');
  }

  async runSmoke(id: string): Promise<ProviderTestState | null> {
    return this.runProviderTest(id, 'smoke');
  }

  async refreshModels(id: string): Promise<db.ProviderModel[] | null> {
    this.patch({ busyProviderId: id, error: null });
    try {
      const models = await Promise.resolve(this.adapters.refreshProviderModels(id));
      this.patch({
        busyProviderId: null,
        modelsByProvider: { ...this.state.modelsByProvider, [id]: models },
      });
      return models;
    } catch (err) {
      this.patch({ busyProviderId: null, error: errorMessage(err) });
      return null;
    }
  }

  async loadCachedModels(id: string): Promise<db.ProviderModel[]> {
    return Promise.resolve(this.adapters.listCachedProviderModels(id));
  }

  private async runProviderTest(
    id: string,
    kind: 'health' | 'smoke',
  ): Promise<ProviderTestState | null> {
    this.patch({ busyProviderId: id, error: null });
    try {
      if (kind === 'health') {
        const health = await Promise.resolve(this.adapters.checkProviderHealth(id));
        const test = testStateFromHealth(health);
        this.patch({
          busyProviderId: null,
          healthByProvider: { ...this.state.healthByProvider, [id]: test },
        });
        return test;
      }
      const smoke = await Promise.resolve(this.adapters.runProviderStreamSmokeTest(id));
      const test = testStateFromSmoke(smoke);
      this.patch({
        busyProviderId: null,
        smokeByProvider: { ...this.state.smokeByProvider, [id]: test },
      });
      return test;
    } catch (err) {
      const message = errorMessage(err);
      const test: ProviderTestState = { status: 'error', message, at: Date.now() };
      this.patch({
        busyProviderId: null,
        error: message,
        ...(kind === 'health'
          ? { healthByProvider: { ...this.state.healthByProvider, [id]: test } }
          : { smokeByProvider: { ...this.state.smokeByProvider, [id]: test } }),
      });
      return test;
    }
  }

  private async loadProviders(): Promise<void> {
    try {
      const providers = await Promise.resolve(this.adapters.listProviders());
      const stored = this.adapters.loadSelection();
      const selectedProviderId =
        stored && providers.some((provider) => provider.id === stored)
          ? stored
          : (providers.find((provider) => provider.isActive)?.id ?? providers[0]?.id ?? null);
      const models: Record<string, db.ProviderModel[]> = {};
      await Promise.all(
        providers.slice(0, 6).map(async (provider) => {
          models[provider.id] = await Promise.resolve(
            this.adapters.listCachedProviderModels(provider.id),
          ).catch(() => []);
        }),
      );
      this.applyProviders(providers, selectedProviderId, models);
    } catch (err) {
      this.patch({ error: errorMessage(err) });
    }
  }

  private async refreshProviders(): Promise<void> {
    const providers = await Promise.resolve(this.adapters.listProviders());
    const selectedProviderId =
      this.state.selectedProviderId &&
      providers.some((provider) => provider.id === this.state.selectedProviderId)
        ? this.state.selectedProviderId
        : (providers.find((provider) => provider.isActive)?.id ?? providers[0]?.id ?? null);
    this.applyProviders(providers, selectedProviderId, this.state.modelsByProvider);
  }

  private applyProviders(
    providers: db.Provider[],
    selectedProviderId: string | null,
    modelsByProvider: Record<string, db.ProviderModel[]>,
  ): void {
    const selectedProvider =
      providers.find((provider) => provider.id === selectedProviderId) ?? null;
    this.patch({
      providers,
      selectedProviderId,
      selectedProvider,
      modelsByProvider,
      error: null,
    });
    this.adapters.saveSelection(selectedProviderId);
  }

  private patch(patch: Partial<ProviderControlSnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.snapshot = {
      ...this.state,
      providers: [...this.state.providers],
      modelsByProvider: Object.fromEntries(
        Object.entries(this.state.modelsByProvider).map(([id, models]) => [id, [...models]]),
      ),
      healthByProvider: { ...this.state.healthByProvider },
      smokeByProvider: { ...this.state.smokeByProvider },
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

export const providerControlOrchestrator = new ProviderControlOrchestrator();
