import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  CloudUpload,
  Download,
  HeartPulse,
  History,
  List,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Terminal,
  Upload,
  Users,
  Wallet,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from '../lib/db';
import {
  formatTokens,
  getBudgetStatus,
  resetTokenBudget,
  setTokenBudget,
  type TokenBudgetConfig,
  type TokenBudgetStatus,
} from '../lib/tokenBudget';
import { useWorkbenchStore } from '../stores/workbenchStore';
import BentoCard from '../components/ui/BentoCard';
import ModelBadge from '../components/ui/ModelBadge';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function dateInput(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function resolveAuditRange(
  since: string,
  fromDate: string,
  toDate: string,
): { sinceMs?: number; untilMs?: number } {
  if (since === 'today') return { sinceMs: Date.now() - 24 * 60 * 60 * 1000 };
  if (since === '7d') return { sinceMs: Date.now() - 7 * 24 * 60 * 60 * 1000 };
  if (since === 'custom') {
    return {
      sinceMs: fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : undefined,
      untilMs: toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : undefined,
    };
  }
  return {};
}

type ErrorLogRange = '24h' | '7d' | '30d';

const ERROR_LOG_RANGE_MS: Record<ErrorLogRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function resolveErrorLogRange(range: ErrorLogRange): { sinceMs: number; untilMs: number } {
  const now = Date.now();
  return { sinceMs: now - ERROR_LOG_RANGE_MS[range], untilMs: now + 60 * 1000 };
}

function errorLogRangeGranularity(range: ErrorLogRange): 'hour' | 'day' {
  return range === '24h' ? 'hour' : 'day';
}

function deriveErrorLogPeak(buckets: db.ErrorLogBucket[] | undefined) {
  if (!buckets || buckets.length < 2) return null;
  const top = [...buckets].sort((a, b) => b.count - a.count)[0];
  const mean = buckets.reduce((sum, bucket) => sum + bucket.count, 0) / buckets.length;
  const ratio = top.count / Math.max(mean, 1);
  return ratio >= 3 && top.count >= 3
    ? { bucket: top.bucket, count: top.count, ratio: Math.round(ratio * 10) / 10 }
    : null;
}

function syncErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
  const message = err instanceof Error ? err.message : '';
  if (name) return message ? `${name}: ${message}` : `Operation failed (${name})`;
  return message || String(err ?? 'Unknown sync error');
}

export default function SystemView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const addProvider = useWorkbenchStore((s) => s.addProvider);
  const toggleProvider = useWorkbenchStore((s) => s.toggleProvider);
  const setProviderModel = useWorkbenchStore((s) => s.setProviderModel);
  const setProviderPriority = useWorkbenchStore((s) => s.setProviderPriority);
  const clipboard = useWorkbenchStore((s) => s.clipboard);
  const logs = useWorkbenchStore((s) => s.logs);
  const refreshSystem = useWorkbenchStore((s) => s.refreshSystem);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [health, setHealth] = useState<Record<string, db.ProviderHealth>>({});
  const [heartbeat, setHeartbeat] = useState<db.ProviderHeartbeatSnapshot | null>(null);
  const [streamSmoke, setStreamSmoke] = useState<Record<string, db.StreamSmokeResult>>({});
  const [e2eResults, setE2eResults] = useState<Record<string, db.ProviderE2eResult>>({});
  const [e2eBatch, setE2eBatch] = useState<Array<{
    providerId: string;
    result: db.ProviderE2eResult;
  }> | null>(null);
  const [e2eBatchBusy, setE2eBatchBusy] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, db.ProviderModel[]>>({});
  const [providerModelOpen, setProviderModelOpen] = useState<Record<string, boolean>>({});
  const [providerModelError, setProviderModelError] = useState<Record<string, string>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookPayload, setWebhookPayload] = useState(
    '{"event":"daily.summary","source":"ai-workbench"}',
  );
  const [webhookMethod, setWebhookMethod] = useState('POST');
  const [webhookToken, setWebhookToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookRetries, setWebhookRetries] = useState('1');
  const [webhookResult, setWebhookResult] = useState<db.WebhookDeliveryResult | null>(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookRules, setWebhookRules] = useState<db.WebhookRule[]>([]);
  const [webhookRuleName, setWebhookRuleName] = useState('');
  const [webhookRuleInterval, setWebhookRuleInterval] = useState('60');
  const [webhookRuleCooldown, setWebhookRuleCooldown] = useState('0');
  const [webhookRuleTrigger, setWebhookRuleTrigger] = useState('');
  const [webhookEventContext, setWebhookEventContext] = useState('');
  const [webhookPayloadPreview, setWebhookPayloadPreview] = useState('');
  const [webhookDeliveries, setWebhookDeliveries] = useState<db.WebhookDelivery[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastRemoteDevice, setLastRemoteDevice] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [syncEncryptEnabled, setSyncEncryptEnabled] = useState(false);
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState('60');
  const [syncConflicts, setSyncConflicts] = useState<db.SyncConflictRecord[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<db.SyncConflictRecord[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [syncAudit, setSyncAudit] = useState<db.SyncAuditEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [auditSince, setAuditSince] = useState('all');
  const [auditFromDate, setAuditFromDate] = useState(() =>
    dateInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
  );
  const [auditToDate, setAuditToDate] = useState(() => dateInput(new Date()));
  const [auditDevice, setAuditDevice] = useState('all');
  const [auditExportMessage, setAuditExportMessage] = useState('');
  const [auditSummary, setAuditSummary] = useState<db.SyncAuditSummary | null>(null);
  const [auditGranularity, setAuditGranularity] = useState<'day' | 'week'>('day');
  const [errorLogSummary, setErrorLogSummary] = useState<db.ErrorLogSummary | null>(null);
  const [errorLogGranularity, setErrorLogGranularity] = useState<'hour' | 'day' | 'week'>('day');
  const [errorLogRange, setErrorLogRange] = useState<ErrorLogRange>('7d');
  const [errorSeverityFilter, setErrorSeverityFilter] = useState('all');
  const [errorSourceFilter, setErrorSourceFilter] = useState('all');
  const [errorDeviceFilter, setErrorDeviceFilter] = useState('all');
  const [departments, setDepartments] = useState<db.Department[]>([]);
  const [agents, setAgents] = useState<db.Agent[]>([]);
  const [agentDeptId, setAgentDeptId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [promptEditAgentId, setPromptEditAgentId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [versionOpenAgentId, setVersionOpenAgentId] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<db.AgentPromptVersion[]>([]);
  const [budgetLimitDraft, setBudgetLimitDraft] = useState('');
  const [budgetConfig, setBudgetConfig] = useState<TokenBudgetConfig>(() => getBudgetStatus());
  const [budgetStatus, setBudgetStatusState] = useState<TokenBudgetStatus>(() => getBudgetStatus());
  const runAutoSyncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const status = getBudgetStatus();
    setBudgetConfig(status);
    setBudgetStatusState(status);
    setBudgetLimitDraft(String(status.monthlyLimit));
  }, []);

  const saveBudgetLimit = () => {
    const limit = Math.max(1, Math.floor(Number(budgetLimitDraft) || 0));
    const next = setTokenBudget({ monthlyLimit: limit });
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatusState(status);
    setBudgetLimitDraft(String(limit));
  };

  const toggleBudgetDegrade = () => {
    const next = setTokenBudget({ autoDegrade: !budgetConfig.autoDegrade });
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatusState(status);
  };

  const resetBudgetMonth = () => {
    const next = resetTokenBudget();
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatusState(status);
  };

  useEffect(() => {
    void db.getSyncStatus().then((status) => {
      setDeviceId(status.deviceId);
      setLastSyncedAt(status.lastSyncedAt);
    });
    void db.listSyncConflicts('unresolved').then(setSyncConflicts);
    void db.listSyncAudit(50).then(setSyncAudit);
    void db.getSyncAuditSummary('day').then(setAuditSummary);
    const defaultRange: ErrorLogRange = '7d';
    const errorRange = resolveErrorLogRange(defaultRange);
    void db
      .getErrorLogSummary(
        errorLogRangeGranularity(defaultRange),
        undefined,
        undefined,
        undefined,
        errorRange.sinceMs,
        errorRange.untilMs,
      )
      .then(setErrorLogSummary);
    void db.getSyncAutoConfig().then((config) => {
      setAutoSyncEnabled(config.enabled);
      setAutoSyncInterval(String(config.intervalMs / 1000));
      if (config.remoteUrl) setRemoteUrl(config.remoteUrl);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    void Promise.all([db.listDepartments(), db.listAgents()]).then(
      ([departmentList, agentList]) => {
        if (disposed) return;
        setDepartments(departmentList);
        setAgents(agentList);
        setAgentDeptId((current) => current || departmentList[0]?.id || '');
      },
    );
    return () => {
      disposed = true;
    };
  }, []);

  const createAgentItem = async () => {
    if (!agentDeptId || !agentName.trim()) return;
    await db.createAgent(agentDeptId, agentName.trim(), agentRole.trim(), 'openai', null, '');
    setAgents(await db.listAgents());
    setDepartments(await db.listDepartments());
    setAgentName('');
    setAgentRole('');
  };

  const saveAgentPrompt = async (id: string) => {
    await db.updateAgentSystemPrompt(id, promptDraft.trim());
    setAgents(await db.listAgents());
    setPromptEditAgentId(null);
    setPromptDraft('');
  };

  const togglePromptVersions = async (agentId: string) => {
    if (versionOpenAgentId === agentId) {
      setVersionOpenAgentId(null);
      setPromptVersions([]);
      return;
    }
    setVersionOpenAgentId(agentId);
    setPromptVersions(await db.listAgentPromptVersions(agentId));
  };

  const restorePromptVersion = async (agentId: string, versionId: string) => {
    await db.restoreAgentPrompt(agentId, versionId);
    setAgents(await db.listAgents());
    setPromptVersions(await db.listAgentPromptVersions(agentId));
  };

  const exportSync = async () => {
    setSyncError(false);
    if (syncEncryptEnabled && syncPassphrase.trim()) {
      await db.exportEncryptedSyncSnapshot(syncPassphrase.trim());
      setSyncMessage('Exported encrypted snapshot');
    } else {
      const snapshot = await db.exportSyncSnapshot();
      setSyncMessage(`Exported ${snapshot.clipboard.length} clips / ${snapshot.logs.length} logs`);
    }
  };

  const importSync = async () => {
    try {
      const result =
        syncEncryptEnabled && syncPassphrase.trim()
          ? await db.importEncryptedSyncSnapshot(syncPassphrase.trim())
          : await db.importSyncSnapshot();
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setLastRemoteDevice(result.deviceId);
      setSyncMessage(
        syncEncryptEnabled && syncPassphrase.trim()
          ? `Merged encrypted +${result.clipboardAdded} clips +${result.logsAdded} logs`
          : `Merged +${result.clipboardAdded} clips +${result.logsAdded} logs`,
      );
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const pushSync = async () => {
    if (!remoteUrl.trim()) {
      setSyncError(true);
      setSyncMessage('Remote URL required');
      return;
    }
    try {
      const result = await db.pushSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() ? syncPassphrase.trim() : undefined,
      );
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setSyncMessage(result.message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const pullSync = async () => {
    if (!remoteUrl.trim()) {
      setSyncError(true);
      setSyncMessage('Remote URL required');
      return;
    }
    try {
      const result = await db.pullSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() ? syncPassphrase.trim() : undefined,
      );
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setLastRemoteDevice(result.deviceId);
      setSyncMessage(`Merged +${result.clipboardAdded} clips +${result.logsAdded} logs`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const runAutoSync = async () => {
    if (!remoteUrl.trim()) return;
    try {
      const pulled = await db.pullSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() ? syncPassphrase.trim() : undefined,
      );
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      const pushed = await db.pushSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() ? syncPassphrase.trim() : undefined,
      );
      setSyncError(false);
      setLastSyncedAt(pushed.syncedAt);
      setLastRemoteDevice(pulled.deviceId);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  useEffect(() => {
    runAutoSyncRef.current = runAutoSync;
  });

  const loadConflicts = async () => {
    setSyncConflicts(await db.listSyncConflicts('unresolved'));
  };

  const loadAudit = async (
    filter = auditFilter,
    since = auditSince,
    device = auditDevice,
    fromDate = auditFromDate,
    toDate = auditToDate,
  ) => {
    const range = resolveAuditRange(since, fromDate, toDate);
    setSyncAudit(
      await db.listSyncAudit(
        200,
        filter === 'all' ? undefined : filter,
        range.sinceMs,
        range.untilMs,
        device === 'current' ? deviceId : undefined,
      ),
    );
    setAuditSummary(
      await db.getSyncAuditSummary(
        auditGranularity,
        filter === 'all' ? undefined : filter,
        range.sinceMs,
        range.untilMs,
        device === 'current' ? deviceId : undefined,
      ),
    );
  };

  const changeAuditGranularity = (granularity: 'day' | 'week') => {
    setAuditGranularity(granularity);
    setAuditExportMessage('');
    const range = resolveAuditRange(auditSince, auditFromDate, auditToDate);
    void db
      .getSyncAuditSummary(
        granularity,
        auditFilter === 'all' ? undefined : auditFilter,
        range.sinceMs,
        range.untilMs,
        auditDevice === 'current' ? deviceId : undefined,
      )
      .then(setAuditSummary);
  };

  const changeErrorLogRange = (range: ErrorLogRange) => {
    setErrorLogRange(range);
    const errorRange = resolveErrorLogRange(range);
    const granularity = errorLogRangeGranularity(range);
    setErrorLogGranularity(granularity);
    void db
      .getErrorLogSummary(
        granularity,
        errorSourceFilter === 'all' ? undefined : errorSourceFilter,
        errorSeverityFilter === 'all' ? undefined : errorSeverityFilter,
        errorDeviceFilter === 'all'
          ? undefined
          : errorDeviceFilter === 'current'
            ? deviceId
            : errorDeviceFilter,
        errorRange.sinceMs,
        errorRange.untilMs,
      )
      .then(setErrorLogSummary);
  };

  const changeErrorSeverityFilter = (severity: string) => {
    setErrorSeverityFilter(severity);
    void db
      .getErrorLogSummary(
        errorLogGranularity,
        errorSourceFilter === 'all' ? undefined : errorSourceFilter,
        severity === 'all' ? undefined : severity,
        errorDeviceFilter === 'all'
          ? undefined
          : errorDeviceFilter === 'current'
            ? deviceId
            : errorDeviceFilter,
        resolveErrorLogRange(errorLogRange).sinceMs,
        resolveErrorLogRange(errorLogRange).untilMs,
      )
      .then(setErrorLogSummary);
  };

  const changeErrorSourceFilter = (source: string) => {
    setErrorSourceFilter(source);
    void db
      .getErrorLogSummary(
        errorLogGranularity,
        source === 'all' ? undefined : source,
        errorSeverityFilter === 'all' ? undefined : errorSeverityFilter,
        errorDeviceFilter === 'all'
          ? undefined
          : errorDeviceFilter === 'current'
            ? deviceId
            : errorDeviceFilter,
        resolveErrorLogRange(errorLogRange).sinceMs,
        resolveErrorLogRange(errorLogRange).untilMs,
      )
      .then(setErrorLogSummary);
  };

  const changeErrorDeviceFilter = (device: string) => {
    setErrorDeviceFilter(device);
    void db
      .getErrorLogSummary(
        errorLogGranularity,
        errorSourceFilter === 'all' ? undefined : errorSourceFilter,
        errorSeverityFilter === 'all' ? undefined : errorSeverityFilter,
        device === 'all' ? undefined : device === 'current' ? deviceId : device,
        resolveErrorLogRange(errorLogRange).sinceMs,
        resolveErrorLogRange(errorLogRange).untilMs,
      )
      .then(setErrorLogSummary);
  };

  const changeAuditFilter = (filter: string) => {
    setAuditFilter(filter);
    setAuditExportMessage('');
    void loadAudit(filter);
  };

  const changeAuditRange = (range: string) => {
    setAuditSince(range);
    setAuditExportMessage('');
    void loadAudit(auditFilter, range, auditDevice);
  };

  const changeAuditDevice = (device: string) => {
    setAuditDevice(device);
    setAuditExportMessage('');
    void loadAudit(auditFilter, auditSince, device);
  };

  const changeAuditFromDate = (value: string) => {
    setAuditFromDate(value);
    setAuditExportMessage('');
    if (auditSince === 'custom') {
      void loadAudit(auditFilter, 'custom', auditDevice, value, auditToDate);
    }
  };

  const changeAuditToDate = (value: string) => {
    setAuditToDate(value);
    setAuditExportMessage('');
    if (auditSince === 'custom') {
      void loadAudit(auditFilter, 'custom', auditDevice, auditFromDate, value);
    }
  };

  const exportAudit = async (format: 'json' | 'csv') => {
    try {
      const range = resolveAuditRange(auditSince, auditFromDate, auditToDate);
      const text = await db.exportSyncAudit(
        format,
        auditFilter === 'all' ? undefined : auditFilter,
        range.sinceMs,
        range.untilMs,
        auditDevice === 'current' ? deviceId : undefined,
      );
      const count =
        format === 'json'
          ? (JSON.parse(text) as db.SyncAuditEntry[]).length
          : Math.max(0, text.trim().split('\n').length - 1);
      const blob = new Blob([text], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sync-audit-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      const message = `Exported ${count} sync audit event(s)`;
      setSyncError(false);
      setSyncMessage(message);
      setAuditExportMessage(message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveConflictItem = async (conflict: db.SyncConflictItem, choice: 'local' | 'remote') => {
    try {
      const message = await db.resolveSyncConflict(conflict, choice);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveAllConflicts = async (choice: 'local' | 'remote') => {
    if (syncConflicts.length === 0) return;
    try {
      const count = await db.resolveSyncConflicts(syncConflicts, choice);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(`Resolved ${count} conflict(s) with ${choice}`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveConflictUnionItem = async (conflict: db.SyncConflictItem) => {
    try {
      const message = await db.resolveSyncConflictUnion(conflict);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveAllConflictsUnion = async () => {
    if (syncConflicts.length === 0) return;
    try {
      const count = await db.resolveSyncConflictsUnion(syncConflicts);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(`Merged ${count} conflict(s) with union`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveConflictStructuredItem = async (conflict: db.SyncConflictItem) => {
    try {
      const message = await db.resolveSyncConflictStructured(conflict);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const resolveAllConflictsStructured = async () => {
    if (syncConflicts.length === 0) return;
    try {
      const count = await db.resolveSyncConflictsStructured(syncConflicts);
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setSyncMessage(`Merged ${count} conflict(s) with fields`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const toggleResolvedHistory = async () => {
    if (showResolved) {
      setShowResolved(false);
      return;
    }
    setResolvedConflicts(await db.listSyncConflicts('resolved'));
    setShowResolved(true);
  };

  const clearResolvedHistory = async () => {
    const cleared = await db.clearResolvedSyncConflicts();
    setResolvedConflicts(await db.listSyncConflicts('resolved'));
    await loadAudit();
    setSyncError(false);
    setSyncMessage(`Cleared ${cleared} resolved conflict(s)`);
  };

  const clearAudit = async () => {
    const cleared = await db.clearSyncAudit();
    setSyncAudit(await db.listSyncAudit(50));
    setAuditSummary({ granularity: auditGranularity, total: 0, buckets: [] });
    setSyncError(false);
    setSyncMessage(`Cleared ${cleared} sync audit event(s)`);
  };

  const toggleAutoSync = async () => {
    if (autoSyncEnabled) {
      setAutoSyncEnabled(false);
      await db.setSyncAutoConfig({
        enabled: false,
        intervalMs: Number(autoSyncInterval) * 1000,
        remoteUrl: remoteUrl.trim(),
      });
      setSyncError(false);
      setSyncMessage('Auto sync disabled');
      return;
    }
    if (!remoteUrl.trim()) {
      setSyncError(true);
      setSyncMessage('Remote URL required for auto sync');
      return;
    }
    setAutoSyncEnabled(true);
    await db.setSyncAutoConfig({
      enabled: true,
      intervalMs: Number(autoSyncInterval) * 1000,
      remoteUrl: remoteUrl.trim(),
    });
    await runAutoSync();
    setSyncError(false);
    setSyncMessage(`Auto sync enabled, every ${autoSyncInterval}s`);
  };

  useEffect(() => {
    if (!autoSyncEnabled) return;
    const intervalMs = Math.max(Number(autoSyncInterval) * 1000, 10_000);
    const timer = window.setInterval(() => void runAutoSyncRef.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoSyncEnabled, autoSyncInterval]);

  const check = async (id: string) => {
    const result = await db.checkProviderHealth(id);
    setHealth((prev) => ({ ...prev, [id]: result }));
  };

  const checkAll = useCallback(async () => {
    const entries = await Promise.all(
      providers.map(async (p) => [p.id, await db.checkProviderHealth(p.id)] as const),
    );
    setHealth(Object.fromEntries(entries));
  }, [providers]);

  const runStreamSmoke = async (id: string) => {
    const result = await db.runProviderStreamSmokeTest(id);
    setStreamSmoke((prev) => ({ ...prev, [id]: result }));
  };

  const runProviderE2E = async (id: string) => {
    const result = await db.runProviderE2EStream(id);
    setE2eResults((prev) => ({ ...prev, [id]: result }));
  };

  const runAllProviderE2E = async () => {
    if (e2eBatchBusy) return;
    setE2eBatchBusy(true);
    const targets = providers.filter((p) => p.isActive);
    const results = await Promise.all(
      targets.map(async (p) => {
        try {
          return { providerId: p.id, result: await db.runProviderE2EStream(p.id) };
        } catch (err) {
          return {
            providerId: p.id,
            result: {
              ok: false,
              chunks: 0,
              chars: 0,
              durationMs: 0,
              message: err instanceof Error ? err.message : String(err),
            },
          };
        }
      }),
    );
    setE2eResults((prev) => {
      const next = { ...prev };
      for (const { providerId, result } of results) next[providerId] = result;
      return next;
    });
    setE2eBatch(results);
    setE2eBatchBusy(false);
  };

  const deliverWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookResult({
        ok: false,
        status: 0,
        durationMs: 0,
        attempts: 0,
        signed: false,
        message: 'Webhook URL required',
      });
      return;
    }
    setWebhookBusy(true);
    try {
      const result = await db.deliverWebhook(
        webhookUrl.trim(),
        webhookPayload.trim() || '{}',
        webhookMethod,
        webhookToken,
        webhookSecret,
        Math.max(0, Number(webhookRetries) || 0),
      );
      setWebhookResult(result);
    } catch (err) {
      setWebhookResult({
        ok: false,
        status: 0,
        durationMs: 0,
        attempts: 0,
        signed: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setWebhookBusy(false);
    }
  };

  const loadWebhookRules = async () => {
    setWebhookRules(await db.listWebhookRules());
  };

  const saveWebhookRule = async () => {
    if (!webhookRuleName.trim() || !webhookUrl.trim()) {
      setWebhookResult({
        ok: false,
        status: 0,
        durationMs: 0,
        attempts: 0,
        signed: false,
        message: 'Rule name and Webhook URL required',
      });
      return;
    }
    await db.createWebhookRule(
      webhookRuleName.trim(),
      webhookUrl.trim(),
      webhookPayload,
      webhookMethod,
      webhookToken,
      Number(webhookRuleInterval) || 60,
      webhookSecret,
      Math.max(0, Number(webhookRetries) || 0),
      Math.max(0, Number(webhookRuleCooldown) || 0),
      webhookRuleTrigger.trim(),
    );
    await loadWebhookRules();
    await loadWebhookDeliveries();
    setWebhookRuleName('');
    setWebhookRuleCooldown('0');
    setWebhookRuleTrigger('');
  };

  const toggleWebhookRule = async (id: string, enabled: boolean) => {
    await db.setWebhookRuleEnabled(id, enabled);
    await loadWebhookRules();
  };

  const runScheduledWebhook = async (id: string) => {
    const result = await db.runWebhookRule(id);
    setWebhookResult(result);
    await loadWebhookRules();
  };

  const deleteWebhookRule = async (id: string) => {
    await db.deleteWebhookRule(id);
    await loadWebhookRules();
    await loadWebhookDeliveries();
  };

  const loadWebhookDeliveries = async () => {
    setWebhookDeliveries(await db.listWebhookDeliveries());
  };

  const fireWebhookEvent = async (event: string) => {
    let context: Record<string, unknown> | undefined;
    const trimmedContext = webhookEventContext.trim();
    if (trimmedContext) {
      try {
        context = JSON.parse(trimmedContext) as Record<string, unknown>;
      } catch {
        setWebhookResult({
          ok: false,
          status: 0,
          durationMs: 0,
          attempts: 0,
          signed: false,
          message: 'Event context JSON is invalid',
        });
        return;
      }
    }
    const count = await db.triggerWebhookEvent(event, context);
    setWebhookResult({
      ok: true,
      status: 202,
      durationMs: 0,
      attempts: 0,
      signed: false,
      message: `Queued ${count} delivery(ies) for ${event}`,
    });
    await loadWebhookDeliveries();
  };

  const previewWebhookPayload = () => {
    let context: Record<string, unknown> = {};
    const trimmedContext = webhookEventContext.trim();
    if (trimmedContext) {
      try {
        context = JSON.parse(trimmedContext) as Record<string, unknown>;
      } catch {
        setWebhookPayloadPreview('Event context JSON is invalid');
        return;
      }
    }
    setWebhookPayloadPreview(db.renderWebhookPayload(webhookPayload, 'sync.completed', context));
  };

  const retryWebhookDelivery = async (id: string) => {
    await db.retryWebhookDelivery(id);
    await loadWebhookDeliveries();
  };

  const deleteWebhookDelivery = async (id: string) => {
    await db.deleteWebhookDelivery(id);
    await loadWebhookDeliveries();
  };

  const clearWebhookDeliveries = async () => {
    const removed = await db.clearWebhookDeliveries('dead');
    setWebhookResult({
      ok: true,
      status: 0,
      durationMs: 0,
      attempts: 0,
      signed: false,
      message: `Cleared ${removed} dead delivery(ies)`,
    });
    await loadWebhookDeliveries();
  };

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  useEffect(() => {
    void loadWebhookRules();
    void loadWebhookDeliveries();
    const onWebhooksUpdated = () => void loadWebhookDeliveries();
    window.addEventListener('workbench:webhook-deliveries-updated', onWebhooksUpdated);
    const timer = window.setInterval(() => {
      void loadWebhookRules();
      void loadWebhookDeliveries();
    }, 5000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('workbench:webhook-deliveries-updated', onWebhooksUpdated);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.runProviderHeartbeat().then((snapshot) => {
      if (!disposed) setHeartbeat(snapshot);
    });
    void db
      .listenProviderHeartbeat((snapshot) => {
        if (!disposed) setHeartbeat(snapshot);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  const create = async () => {
    if (!name.trim() || !baseUrl.trim()) return;
    await addProvider(name.trim(), baseUrl.trim(), apiKey.trim(), model.trim());
    setName('');
    setBaseUrl('');
    setApiKey('');
    setModel('');
  };

  const saveProviderModel = async (id: string, value: string) => {
    await setProviderModel(id, value.trim());
    setModelDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const detectProviderModels = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    try {
      const models = await db.listProviderModels(provider);
      setProviderModels((prev) => ({ ...prev, [id]: models }));
      setProviderModelOpen((prev) => ({ ...prev, [id]: true }));
      setProviderModelError((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setProviderModelError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const pickProviderModel = async (id: string, modelId: string) => {
    setModelDrafts((prev) => ({ ...prev, [id]: modelId }));
    setProviderModelOpen((prev) => ({ ...prev, [id]: false }));
    await saveProviderModel(id, modelId);
  };

  const errorSources = Array.from(new Set(logs.map((log) => log.source))).sort();
  const errorDevices = Array.from(new Set(logs.map((log) => log.deviceId || 'unknown'))).sort();
  const errorLogWindow = resolveErrorLogRange(errorLogRange);
  const visibleLogs = logs
    .filter(
      (log) => log.updatedAt >= errorLogWindow.sinceMs && log.updatedAt <= errorLogWindow.untilMs,
    )
    .filter((log) => errorSourceFilter === 'all' || log.source === errorSourceFilter)
    .filter((log) => errorSeverityFilter === 'all' || log.severity === errorSeverityFilter)
    .filter((log) => {
      if (errorDeviceFilter === 'all') return true;
      const logDevice = log.deviceId || 'unknown';
      return errorDeviceFilter === 'current'
        ? logDevice === deviceId
        : logDevice === errorDeviceFilter;
    });
  const errorLogPeak = deriveErrorLogPeak(errorLogSummary?.buckets);
  const auditBuckets = auditSummary?.buckets ?? [];
  const auditMergeTotal = auditBuckets.reduce((sum, bucket) => sum + bucket.merge, 0);
  const auditResolveTotal = auditBuckets.reduce((sum, bucket) => sum + bucket.resolve, 0);
  const auditOtherTotal = auditBuckets.reduce((sum, bucket) => sum + bucket.other, 0);
  const auditCumulative = auditBuckets.map((_, index) =>
    auditBuckets.slice(0, index + 1).reduce((sum, bucket) => sum + bucket.count, 0),
  );
  const auditMaxCumulative = Math.max(1, ...auditCumulative);
  const auditTrendPoints =
    auditBuckets.length > 1
      ? auditCumulative
          .map((cumulative, index) => {
            const x = (index / (auditBuckets.length - 1)) * 100;
            const y = 22 - (cumulative / auditMaxCumulative) * 18;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

  return (
    <div className="view-enter flex h-full flex-col gap-4 overflow-y-auto p-4">
      <BentoCard title="Providers" subtitle="AI 节点配置与健康度" icon={Activity} colSpan={12}>
        {heartbeat && heartbeat.alerts.length > 0 && (
          <div className="heartbeat-alert mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="font-medium">Provider alerts</span>
            {heartbeat.alerts.map((alert) => (
              <span key={alert.id} className="rounded-md bg-red-500/15 px-1.5 py-0.5">
                {alert.name}: {alert.message}
              </span>
            ))}
            <span className="ml-auto text-red-400/70">
              {heartbeat.checkedAt ? new Date(heartbeat.checkedAt).toLocaleTimeString('zh-CN') : ''}
            </span>
          </div>
        )}
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          {providers.map((p) => {
            const entry = heartbeat?.providers.find((h) => h.id === p.id) ?? null;
            const state = entry ?? health[p.id];
            const statusLabel = !state
              ? 'pending'
              : state.ok
                ? 'ok'
                : entry?.checked === false
                  ? 'pending'
                  : 'degraded';
            return (
              <div
                key={p.id}
                data-provider-id={p.id}
                className={`provider-card rounded-2xl border bg-white/[0.03] p-3 ${
                  p.isActive ? 'active-provider border-emerald-500/20' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <ModelBadge
                    label={p.name}
                    tone={p.isActive ? 'green' : 'neutral'}
                    status={p.isActive ? 'active' : 'idle'}
                    pulse={p.isActive}
                  />
                  <button
                    type="button"
                    onClick={() => void toggleProvider(p.id, !p.isActive)}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    {p.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <p className="mt-2 truncate text-[11px] text-slate-500">{p.baseUrl}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    data-provider-model-input
                    value={modelDrafts[p.id] ?? p.model}
                    onChange={(e) =>
                      setModelDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    onBlur={(e) => void saveProviderModel(p.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    placeholder="model"
                    className="h-6 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[10px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-emerald-500/40"
                  />
                  <button
                    type="button"
                    data-provider-models-detect
                    data-provider-models={providerModels[p.id]?.length ?? 0}
                    onClick={() => void detectProviderModels(p.id)}
                    aria-label={`Detect models for ${p.name}`}
                    title="Detect models"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    <List size={10} />
                  </button>
                  <span
                    data-provider-model={p.model}
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] ${
                      p.model
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-white/[0.03] text-slate-500'
                    }`}
                  >
                    {p.model ? 'live' : 'fallback'}
                  </span>
                </div>
                {providerModelOpen[p.id] && (providerModels[p.id]?.length ?? 0) > 0 && (
                  <div
                    data-provider-model-options
                    className="mt-1.5 grid max-h-28 gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-[#101014] p-1"
                  >
                    {providerModels[p.id].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        data-provider-model-option={m.id}
                        onClick={() => void pickProviderModel(p.id, m.id)}
                        className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[10px] ${
                          m.id === (modelDrafts[p.id] ?? p.model)
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="truncate">{m.id}</span>
                        {m.ownedBy && <span className="shrink-0 text-slate-600">{m.ownedBy}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {providerModelError[p.id] && (
                  <p data-provider-model-error className="mt-1 truncate text-[9px] text-rose-300">
                    {providerModelError[p.id]}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${state?.ok ? 'bg-emerald-400' : 'bg-red-400'}`}
                  />
                  <span className={state?.ok ? 'text-emerald-400' : 'text-red-300'}>
                    {statusLabel}
                  </span>
                  <span className="text-slate-500">{state ? `${state.latencyMs}ms` : '- ms'}</span>
                  {entry?.alert && (
                    <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-red-300">
                      alert
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void check(p.id)}
                    className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Check
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-1.5" data-provider-priority-row={p.id}>
                  <span className="text-[9px] text-slate-500">Priority</span>
                  <button
                    type="button"
                    data-provider-priority-down={p.id}
                    aria-label={`Lower ${p.name} priority`}
                    onClick={() => void setProviderPriority(p.id, (p.priority ?? 0) - 1)}
                    className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    <ChevronDown size={11} />
                  </button>
                  <span
                    data-provider-priority={p.id}
                    className="min-w-4 text-center text-[10px] text-slate-300"
                  >
                    {p.priority ?? 0}
                  </span>
                  <button
                    type="button"
                    data-provider-priority-up={p.id}
                    aria-label={`Raise ${p.name} priority`}
                    onClick={() => void setProviderPriority(p.id, (p.priority ?? 0) + 1)}
                    className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    <ChevronUp size={11} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-stream-test
                    onClick={() => void runStreamSmoke(p.id)}
                    className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                  >
                    <Radio size={9} /> Stream test
                  </button>
                  {streamSmoke[p.id] && (
                    <span
                      data-stream-smoke-result
                      className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                        streamSmoke[p.id].ok
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {streamSmoke[p.id].message}
                    </span>
                  )}
                  <button
                    type="button"
                    data-provider-e2e-test
                    onClick={() => void runProviderE2E(p.id)}
                    className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                  >
                    <Zap size={9} /> E2E test
                  </button>
                  {e2eResults[p.id] && (
                    <span
                      data-provider-e2e-result
                      className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                        e2eResults[p.id].ok
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {e2eResults[p.id].ok
                        ? `ok · ${e2eResults[p.id].chunks} chunks · ${e2eResults[p.id].chars} chars · ${e2eResults[p.id].durationMs}ms`
                        : e2eResults[p.id].message}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL"
            className="h-9 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key ref"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            data-provider-model-new
            placeholder="Model"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={async () => setHeartbeat(await db.runProviderHeartbeat())}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/15 px-3 text-xs text-emerald-300 hover:bg-emerald-500/25"
          >
            <HeartPulse size={14} /> Heartbeat
          </button>
          <button
            type="button"
            onClick={() => void checkAll()}
            className="flex h-9 items-center gap-1 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30"
          >
            Check all
          </button>
          <button
            type="button"
            data-provider-batch-test
            onClick={() => void runAllProviderE2E()}
            disabled={e2eBatchBusy}
            className="flex h-9 items-center gap-1 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={14} /> {e2eBatchBusy ? 'E2E all...' : 'E2E all'}
          </button>
          {e2eBatch && (
            <span
              data-provider-batch-result
              className={`flex h-9 items-center rounded-xl px-3 text-xs ${
                e2eBatch.every((entry) => entry.result.ok)
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-rose-500/10 text-rose-300'
              }`}
            >
              {e2eBatch.filter((entry) => entry.result.ok).length}/{e2eBatch.length} ok
              {e2eBatch.some((entry) => !entry.result.ok)
                ? ` · ${e2eBatch.filter((entry) => !entry.result.ok).length} failed`
                : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => void create()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </BentoCard>

      <BentoCard
        title="Sync snapshot"
        subtitle="剪贴板与日志跨设备同步"
        icon={CloudUpload}
        colSpan={12}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-400">
            <input
              type="checkbox"
              data-sync-e2e-toggle
              checked={syncEncryptEnabled}
              onChange={(e) => setSyncEncryptEnabled(e.target.checked)}
              className="h-3 w-3 accent-violet-400"
            />
            E2E encrypt
          </label>
          {syncEncryptEnabled && (
            <input
              type="password"
              value={syncPassphrase}
              onChange={(e) => setSyncPassphrase(e.target.value)}
              placeholder="Passphrase"
              data-sync-passphrase
              className="h-7 w-52 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-violet-500/40 placeholder:text-slate-600"
            />
          )}
          <span
            data-sync-e2e-status
            className={
              syncEncryptEnabled && syncPassphrase.trim()
                ? 'rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300'
                : 'text-[9px] text-slate-600'
            }
          >
            {syncEncryptEnabled && syncPassphrase.trim() ? 'encrypted' : 'plain'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5">
            device {deviceId.slice(0, 8)}
          </span>
          <span>
            {lastSyncedAt
              ? `last sync ${new Date(lastSyncedAt).toLocaleTimeString('zh-CN')}`
              : 'not synced yet'}
          </span>
          {lastRemoteDevice && (
            <span className="text-slate-400">from {lastRemoteDevice.slice(0, 8)}</span>
          )}
          {syncMessage && (
            <span data-sync-message className={syncError ? 'text-rose-400' : 'text-emerald-400'}>
              {syncMessage}
            </span>
          )}
          {syncConflicts.length > 0 && (
            <span
              data-sync-conflicts
              className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-amber-300"
            >
              {syncConflicts.length} conflict(s) pending review
            </span>
          )}
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              aria-label="Export sync snapshot"
              onClick={() => void exportSync()}
              className="flex h-8 items-center gap-1 rounded-lg accent-bg-15 px-2.5 text-[11px] accent-text-strong accent-hover-bg-25"
            >
              <CloudUpload size={12} /> Export
            </button>
            <button
              type="button"
              aria-label="Import sync snapshot"
              onClick={() => void importSync()}
              className="flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25"
            >
              <RefreshCw size={12} /> Import
            </button>
          </span>
        </div>
        {syncConflicts.length > 0 && !showResolved && (
          <div data-sync-resolve-list className="mt-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-batch-resolve="local"
                aria-label="Resolve all conflicts keeping local"
                onClick={() => void resolveAllConflicts('local')}
                className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-2 text-[9px] accent-text-strong accent-hover-bg-25"
              >
                Keep all local
              </button>
              <button
                type="button"
                data-batch-resolve="union"
                aria-label="Merge all conflicts"
                onClick={() => void resolveAllConflictsUnion()}
                className="flex h-6 items-center gap-1 rounded-md bg-sky-500/15 px-2 text-[9px] text-sky-300 hover:bg-sky-500/25"
              >
                Merge all
              </button>
              <button
                type="button"
                data-batch-resolve="structured"
                aria-label="Merge all conflicts by fields"
                onClick={() => void resolveAllConflictsStructured()}
                className="flex h-6 items-center gap-1 rounded-md bg-violet-500/15 px-2 text-[9px] text-violet-300 hover:bg-violet-500/25"
              >
                Merge fields
              </button>
              <button
                type="button"
                data-batch-resolve="remote"
                aria-label="Resolve all conflicts keeping remote"
                onClick={() => void resolveAllConflicts('remote')}
                className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[9px] text-emerald-400 hover:bg-emerald-500/25"
              >
                Keep all remote
              </button>
            </div>
            {syncConflicts.map((conflict) => (
              <div
                key={`${conflict.kind}:${conflict.id}`}
                data-sync-conflict-item
                className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2"
              >
                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase text-amber-300">
                  {conflict.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">
                  {conflict.preview}
                </span>
                <button
                  type="button"
                  data-resolve-choice="local"
                  aria-label={`Keep local conflict ${conflict.id}`}
                  onClick={() => void resolveConflictItem(conflict, 'local')}
                  className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-2 text-[9px] accent-text-strong accent-hover-bg-25"
                >
                  Keep local
                </button>
                <button
                  type="button"
                  data-resolve-choice="remote"
                  aria-label={`Keep remote conflict ${conflict.id}`}
                  onClick={() => void resolveConflictItem(conflict, 'remote')}
                  className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[9px] text-emerald-400 hover:bg-emerald-500/25"
                >
                  Keep remote
                </button>
                <button
                  type="button"
                  data-resolve-union
                  aria-label={`Merge conflict ${conflict.id}`}
                  onClick={() => void resolveConflictUnionItem(conflict)}
                  className="flex h-6 items-center gap-1 rounded-md bg-sky-500/15 px-2 text-[9px] text-sky-300 hover:bg-sky-500/25"
                >
                  Merge
                </button>
                <button
                  type="button"
                  data-resolve-structured
                  aria-label={`Merge conflict ${conflict.id} by fields`}
                  onClick={() => void resolveConflictStructuredItem(conflict)}
                  className="flex h-6 items-center gap-1 rounded-md bg-violet-500/15 px-2 text-[9px] text-violet-300 hover:bg-violet-500/25"
                >
                  Merge fields
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Toggle resolved sync conflict history"
            data-sync-history-toggle
            onClick={() => void toggleResolvedHistory()}
            className="flex h-7 items-center gap-1 rounded-lg accent-bg-15 px-2 text-[10px] accent-text-strong accent-hover-bg-25"
          >
            <History size={11} />
            {showResolved ? 'Hide resolved' : 'Show resolved history'}
          </button>
          {showResolved && resolvedConflicts.length > 0 && (
            <button
              type="button"
              aria-label="Clear resolved sync conflict history"
              data-clear-resolved-history
              onClick={() => void clearResolvedHistory()}
              className="flex h-7 items-center gap-1 rounded-lg bg-rose-500/15 px-2 text-[10px] text-rose-300 hover:bg-rose-500/25"
            >
              Clear resolved
            </button>
          )}
        </div>
        {showResolved && (
          <div data-sync-resolved-list className="mt-2 space-y-1.5">
            {resolvedConflicts.map((conflict) => (
              <div
                key={`${conflict.kind}:${conflict.id}:${conflict.createdAt}`}
                data-sync-resolved-item
                className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2"
              >
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
                  {conflict.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">
                  {conflict.preview}
                </span>
                <span
                  data-resolved-choice={conflict.resolvedChoice ?? ''}
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-300"
                >
                  {conflict.resolvedChoice ?? 'unknown'}
                </span>
                <span className="text-[9px] text-slate-600">
                  {conflict.resolvedAt ? formatTime(conflict.resolvedAt) : ''}
                </span>
              </div>
            ))}
            {resolvedConflicts.length === 0 && (
              <div className="rounded-xl border border-white/5 px-3 py-2 text-[10px] text-slate-600">
                No resolved conflicts
              </div>
            )}
          </div>
        )}
        <div data-sync-audit-section className="mt-3 border-t border-white/5 pt-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Sync audit
            </span>
            <select
              aria-label="Sync audit event filter"
              data-sync-audit-filter
              value={auditFilter}
              onChange={(e) => changeAuditFilter(e.target.value)}
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
            >
              <option value="all">All events</option>
              <option value="sync.merge">merge</option>
              <option value="sync.resolve">resolve</option>
              <option value="sync.resolve.union">merge union</option>
              <option value="sync.resolve.structured">merge fields</option>
              <option value="sync.resolve.batch">batch resolve</option>
              <option value="sync.resolve.union.batch">batch union</option>
              <option value="sync.resolve.structured.batch">batch fields</option>
              <option value="sync.history.cleared">history cleared</option>
            </select>
            <select
              aria-label="Sync audit time range"
              data-sync-audit-since
              value={auditSince}
              onChange={(e) => changeAuditRange(e.target.value)}
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="custom">Custom</option>
            </select>
            {auditSince === 'custom' && (
              <>
                <input
                  type="date"
                  aria-label="Sync audit start date"
                  data-sync-audit-from
                  value={auditFromDate}
                  onChange={(e) => changeAuditFromDate(e.target.value)}
                  className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
                />
                <input
                  type="date"
                  aria-label="Sync audit end date"
                  data-sync-audit-to
                  value={auditToDate}
                  onChange={(e) => changeAuditToDate(e.target.value)}
                  className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
                />
              </>
            )}
            <select
              aria-label="Sync audit device"
              data-sync-audit-device
              value={auditDevice}
              onChange={(e) => changeAuditDevice(e.target.value)}
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40"
            >
              <option value="all">All devices</option>
              <option value="current">Current device</option>
            </select>
            <button
              type="button"
              aria-label="Export sync audit as JSON"
              data-sync-audit-export-json
              onClick={() => void exportAudit('json')}
              className="flex h-6 items-center rounded-md bg-white/5 px-2 text-[9px] text-slate-300 hover:bg-white/10"
            >
              JSON
            </button>
            <button
              type="button"
              aria-label="Export sync audit as CSV"
              data-sync-audit-export-csv
              onClick={() => void exportAudit('csv')}
              className="flex h-6 items-center rounded-md bg-white/5 px-2 text-[9px] text-slate-300 hover:bg-white/10"
            >
              CSV
            </button>
            <button
              type="button"
              aria-label="Clear sync audit log"
              data-sync-audit-clear
              onClick={() => void clearAudit()}
              className="flex h-6 items-center rounded-md bg-rose-500/10 px-2 text-[9px] text-rose-300 hover:bg-rose-500/20"
            >
              Clear
            </button>
          </div>
          <div className="mt-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wide text-slate-600">Activity</span>
              <div className="flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  type="button"
                  data-audit-granularity-day
                  aria-pressed={auditGranularity === 'day'}
                  onClick={() => changeAuditGranularity('day')}
                  className={`h-5 rounded px-1.5 text-[9px] ${
                    auditGranularity === 'day'
                      ? 'accent-bg-15 accent-text-strong'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  data-audit-granularity-week
                  aria-pressed={auditGranularity === 'week'}
                  onClick={() => changeAuditGranularity('week')}
                  className={`h-5 rounded px-1.5 text-[9px] ${
                    auditGranularity === 'week'
                      ? 'accent-bg-15 accent-text-strong'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Week
                </button>
              </div>
              <span data-sync-audit-total className="ml-auto shrink-0 text-[9px] text-slate-500">
                {auditSummary?.total ?? 0} events
              </span>
            </div>
            <div
              data-sync-audit-chart
              data-audit-granularity={auditGranularity}
              className="mt-1.5 flex h-14 items-end gap-1"
            >
              {(auditSummary?.buckets.length ?? 0) === 0 && (
                <div className="py-4 text-[9px] text-slate-600">No activity</div>
              )}
              {auditBuckets.map((bucket) => {
                const max = Math.max(1, ...auditBuckets.map((b) => b.count));
                return (
                  <div
                    key={bucket.bucket}
                    className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                  >
                    <div
                      data-sync-audit-bar
                      data-audit-bucket={bucket.bucket}
                      data-audit-count={bucket.count}
                      title={`${bucket.bucket}: ${bucket.count}`}
                      className="flex h-14 w-full flex-col justify-end gap-px overflow-hidden rounded-t-sm"
                    >
                      {bucket.count === 0 && <div className="h-1 w-full rounded-t-sm bg-white/5" />}
                      {(['merge', 'resolve', 'other'] as const).map((kind) => {
                        const count = bucket[kind];
                        if (count <= 0) return null;
                        const heightPct = (count / max) * 100;
                        return (
                          <div
                            key={kind}
                            data-sync-audit-segment
                            data-audit-kind={kind}
                            data-audit-count={count}
                            data-audit-bucket={bucket.bucket}
                            title={`${bucket.bucket} · ${kind} ${count}`}
                            className={`w-full rounded-t-sm ${
                              kind === 'merge'
                                ? 'bg-emerald-500/70'
                                : kind === 'resolve'
                                  ? 'bg-violet-500/70'
                                  : 'bg-slate-500/60'
                            }`}
                            style={{ height: `${Math.max(0.5, heightPct)}%` }}
                          />
                        );
                      })}
                    </div>
                    <span className="max-w-full truncate text-[7px] text-slate-600">
                      {bucket.bucket.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              data-sync-audit-legend
              className="mt-1.5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-1.5 text-[8px] text-slate-500"
            >
              <span data-sync-audit-legend-item="merge" className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                merge {auditMergeTotal}
              </span>
              <span
                data-sync-audit-legend-item="resolve"
                className="inline-flex items-center gap-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500/70" />
                resolve {auditResolveTotal}
              </span>
              <span data-sync-audit-legend-item="other" className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500/60" />
                other {auditOtherTotal}
              </span>
              {auditBuckets.length > 1 && (
                <span className="ml-auto inline-flex items-center gap-1">
                  <span className="h-px w-3 bg-emerald-400/70" />
                  cumulative
                </span>
              )}
            </div>
            {auditBuckets.length > 1 && (
              <svg
                data-sync-audit-trend
                className="mt-1 h-6 w-full overflow-visible text-emerald-400/70"
                viewBox="0 0 100 24"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  data-sync-audit-trend-line
                  points={auditTrendPoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
          {auditExportMessage && (
            <div
              data-sync-audit-exported
              className="mb-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-300"
            >
              {auditExportMessage}
            </div>
          )}
          <div data-sync-audit-list className="max-h-40 space-y-1 overflow-y-auto">
            {syncAudit.length === 0 && (
              <div className="rounded-lg border border-white/5 px-2 py-1.5 text-[10px] text-slate-600">
                No audit events
              </div>
            )}
            {syncAudit.map((entry) => (
              <div
                key={entry.id}
                data-sync-audit-item
                className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
              >
                <span
                  data-sync-audit-event
                  className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300"
                >
                  {entry.event}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">
                  {entry.detail}
                </span>
                <span className="shrink-0 text-[9px] text-slate-600">
                  {formatTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="Remote URL"
            className="h-9 min-w-56 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={remoteToken}
            onChange={(e) => setRemoteToken(e.target.value)}
            type="password"
            placeholder="Bearer token (optional)"
            className="h-9 min-w-40 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            aria-label="Push sync snapshot"
            onClick={() => void pushSync()}
            className="flex h-9 items-center gap-1 rounded-lg accent-bg-15 px-2.5 text-[11px] accent-text-strong accent-hover-bg-25"
          >
            <Upload size={12} /> Push
          </button>
          <button
            type="button"
            aria-label="Pull sync snapshot"
            onClick={() => void pullSync()}
            className="flex h-9 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25"
          >
            <Download size={12} /> Pull
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Toggle auto sync"
            data-auto-sync={autoSyncEnabled ? 'on' : 'off'}
            onClick={() => void toggleAutoSync()}
            className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] ${
              autoSyncEnabled
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'accent-bg-15 accent-text-strong accent-hover-bg-25'
            }`}
          >
            <RefreshCw size={12} className={autoSyncEnabled ? 'animate-spin' : ''} />
            {autoSyncEnabled ? 'Auto sync on' : 'Auto sync off'}
          </button>
          <select
            aria-label="Auto sync interval"
            value={autoSyncInterval}
            onChange={(e) => setAutoSyncInterval(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
          >
            <option value="10">10s</option>
            <option value="30">30s</option>
            <option value="60">60s</option>
            <option value="300">5m</option>
          </select>
        </div>
      </BentoCard>

      <BentoCard
        title="Webhook delivery"
        subtitle="真实 HTTP JSON 投递"
        icon={Webhook}
        colSpan={12}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Webhook URL"
            data-webhook-url
            className="h-9 min-w-0 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <select
            value={webhookMethod}
            onChange={(e) => setWebhookMethod(e.target.value)}
            aria-label="Webhook method"
            data-webhook-method
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="GET">GET</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            value={webhookToken}
            onChange={(e) => setWebhookToken(e.target.value)}
            placeholder="Bearer token"
            data-webhook-token
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Signature secret"
            data-webhook-secret
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <select
            value={webhookRetries}
            onChange={(e) => setWebhookRetries(e.target.value)}
            aria-label="Webhook retries"
            data-webhook-retries
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
          >
            <option value="0">0 retries</option>
            <option value="1">1 retry</option>
            <option value="2">2 retries</option>
            <option value="3">3 retries</option>
          </select>
        </div>
        <textarea
          value={webhookPayload}
          onChange={(e) => setWebhookPayload(e.target.value)}
          placeholder="Payload (JSON)"
          data-webhook-payload
          className="mt-2 h-20 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-webhook-deliver
            onClick={() => void deliverWebhook()}
            disabled={webhookBusy}
            className="flex h-9 items-center gap-1.5 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Webhook size={14} />
            {webhookBusy ? 'Delivering...' : 'Deliver'}
          </button>
          {webhookResult && (
            <span
              data-webhook-result
              className={`max-w-full rounded-md px-2 py-1 text-[10px] ${
                webhookResult.ok
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-rose-500/10 text-rose-300'
              }`}
            >
              {webhookResult.ok ? 'OK' : 'FAILED'} - HTTP {webhookResult.status || '-'} -{' '}
              {webhookResult.durationMs}ms -{' '}
              <span data-webhook-attempts>{webhookResult.attempts}</span> attempt(s) -{' '}
              <span data-webhook-signed>{webhookResult.signed ? 'signed' : 'unsigned'}</span> -{' '}
              {webhookResult.message}
            </span>
          )}
        </div>
        <div className="mt-3 border-t border-white/5 pt-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Scheduled rules
            </span>
            <input
              value={webhookRuleName}
              onChange={(e) => setWebhookRuleName(e.target.value)}
              placeholder="Rule name"
              data-webhook-rule-name
              className="h-7 w-36 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            <input
              type="number"
              min={5}
              value={webhookRuleInterval}
              onChange={(e) => setWebhookRuleInterval(e.target.value)}
              placeholder="Interval (s)"
              data-webhook-rule-interval
              className="h-7 w-24 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            <input
              type="number"
              min={0}
              value={webhookRuleCooldown}
              onChange={(e) => setWebhookRuleCooldown(e.target.value)}
              placeholder="Cooldown (s)"
              data-webhook-rule-cooldown
              className="h-7 w-24 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            <input
              value={webhookRuleTrigger}
              onChange={(e) => setWebhookRuleTrigger(e.target.value)}
              placeholder="Trigger event"
              data-webhook-rule-trigger-input
              className="h-7 w-36 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            <button
              type="button"
              data-webhook-rule-save
              onClick={() => void saveWebhookRule()}
              className="flex h-7 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
            >
              <Webhook size={10} /> Save rule
            </button>
          </div>
          <div data-webhook-rules className="space-y-1.5">
            {webhookRules.length === 0 && (
              <div className="rounded-lg border border-white/5 px-2 py-1.5 text-[10px] text-slate-600">
                No scheduled rules
              </div>
            )}
            {webhookRules.map((rule) => (
              <div
                key={rule.id}
                data-webhook-rule-item
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                  {rule.name}
                </span>
                <span className="max-w-40 truncate text-[9px] text-slate-500">
                  {rule.method} {rule.url}
                </span>
                {rule.triggerEvent ? (
                  <span
                    data-webhook-rule-trigger
                    className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300"
                  >
                    event: {rule.triggerEvent}
                  </span>
                ) : (
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400">
                    every {rule.intervalSeconds}s
                  </span>
                )}
                {rule.triggerEvent && rule.cooldownSeconds > 0 && (
                  <span
                    data-webhook-rule-cooldown-badge
                    className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
                  >
                    cooldown {rule.cooldownSeconds}s
                  </span>
                )}
                <span
                  data-webhook-rule-retries
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400"
                >
                  {rule.retries} retry(ies)
                </span>
                {rule.secret && (
                  <span
                    data-webhook-rule-secret
                    className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300"
                  >
                    signed
                  </span>
                )}
                <span
                  data-webhook-rule-status
                  className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                    rule.enabled
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {rule.enabled ? 'on' : 'off'} - HTTP {rule.lastStatus || '-'}
                </span>
                {rule.lastMessage && (
                  <span className="max-w-48 truncate text-[9px] text-slate-500">
                    {rule.lastMessage}
                  </span>
                )}
                <button
                  type="button"
                  data-webhook-rule-toggle
                  onClick={() => void toggleWebhookRule(rule.id, !rule.enabled)}
                  className="flex h-6 items-center rounded-md bg-white/5 px-2 text-[9px] text-slate-300 hover:bg-white/10"
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  data-webhook-rule-run
                  onClick={() => void runScheduledWebhook(rule.id)}
                  className="flex h-6 items-center rounded-md accent-bg-15 px-2 text-[9px] accent-text-strong accent-hover-bg-25"
                >
                  Run now
                </button>
                <button
                  type="button"
                  data-webhook-rule-delete
                  onClick={() => void deleteWebhookRule(rule.id)}
                  className="flex h-6 items-center rounded-md bg-rose-500/10 px-2 text-[9px] text-rose-300 hover:bg-rose-500/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
            <span className="text-[9px] text-slate-500">Event triggers</span>
            {['sync.completed', 'knowledge.indexed', 'clipboard.captured', 'error.reported'].map(
              (event) => (
                <button
                  key={event}
                  type="button"
                  data-webhook-event-trigger={event}
                  onClick={() => void fireWebhookEvent(event)}
                  className="flex h-6 items-center rounded-md bg-white/5 px-2 text-[9px] text-slate-300 hover:bg-white/10"
                >
                  {event}
                </button>
              ),
            )}
            <input
              value={webhookEventContext}
              onChange={(e) => setWebhookEventContext(e.target.value)}
              placeholder='Context JSON {"note":"hello"}'
              data-webhook-event-context
              className="h-6 w-44 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            <button
              type="button"
              data-webhook-payload-preview
              onClick={previewWebhookPayload}
              className="flex h-6 items-center rounded-md bg-white/5 px-2 text-[9px] text-slate-300 hover:bg-white/10"
            >
              Preview payload
            </button>
            {webhookPayloadPreview && (
              <span
                data-webhook-payload-preview-text
                className="max-w-64 truncate rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
              >
                {webhookPayloadPreview}
              </span>
            )}
            <button
              type="button"
              data-webhook-delivery-clear
              onClick={() => void clearWebhookDeliveries()}
              className="ml-auto flex h-6 items-center rounded-md bg-rose-500/10 px-2 text-[9px] text-rose-300 hover:bg-rose-500/20"
            >
              Clear dead
            </button>
          </div>
          <div data-webhook-deliveries className="mt-2 space-y-1">
            {webhookDeliveries.length === 0 && (
              <div className="rounded-lg border border-white/5 px-2 py-1.5 text-[10px] text-slate-600">
                No queued deliveries
              </div>
            )}
            {webhookDeliveries.slice(0, 8).map((delivery) => (
              <div
                key={delivery.id}
                data-webhook-delivery-item
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
              >
                <span
                  data-webhook-delivery-status
                  className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                    delivery.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : delivery.status === 'dead'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-sky-500/10 text-sky-300'
                  }`}
                >
                  {delivery.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                  {delivery.event || 'interval'} · {delivery.method} {delivery.url}
                </span>
                {delivery.payload && (
                  <span
                    data-webhook-delivery-payload
                    className="max-w-56 truncate rounded-md bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-slate-500"
                  >
                    {delivery.payload}
                  </span>
                )}
                <span
                  data-webhook-delivery-attempts
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400"
                >
                  {delivery.attempts}/{delivery.retries + 1}
                </span>
                {delivery.lastMessage && (
                  <span className="max-w-48 truncate text-[9px] text-slate-500">
                    {delivery.lastMessage}
                  </span>
                )}
                <button
                  type="button"
                  data-webhook-delivery-retry
                  onClick={() => void retryWebhookDelivery(delivery.id)}
                  className="flex h-6 items-center rounded-md accent-bg-15 px-2 text-[9px] accent-text-strong accent-hover-bg-25"
                >
                  Retry
                </button>
                <button
                  type="button"
                  data-webhook-delivery-delete
                  onClick={() => void deleteWebhookDelivery(delivery.id)}
                  className="flex h-6 items-center rounded-md bg-rose-500/10 px-2 text-[9px] text-rose-300 hover:bg-rose-500/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </BentoCard>

      <BentoCard title="Agent directory" subtitle="部门与 Agent 数据模型" icon={Users} colSpan={12}>
        <div className="grid gap-3 md:grid-cols-5">
          {departments.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-slate-300">{d.name}</span>
                <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
                  {d.agentCount}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{d.description}</p>
              <div className="mt-2 space-y-1">
                {agents
                  .filter((a) => a.departmentId === d.id)
                  .map((a) => (
                    <div key={a.id}>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[10px]">
                        <span className="min-w-0 flex-1 truncate text-slate-300">{a.name}</span>
                        <button
                          type="button"
                          aria-label={`Edit agent prompt: ${a.name}`}
                          onClick={() => {
                            setPromptEditAgentId(a.id);
                            setPromptDraft(a.systemPrompt);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-500 hover:text-violet-300"
                        >
                          <Pencil size={10} />
                        </button>
                        <span className="shrink-0 text-slate-600">{a.role}</span>
                      </div>
                      {a.systemPrompt && (
                        <p className="mt-0.5 truncate px-2 text-[9px] text-violet-400/70">
                          {a.systemPrompt}
                        </p>
                      )}
                      {promptEditAgentId === a.id && (
                        <div className="agent-prompt-editor mt-1 rounded-lg border border-violet-500/25 bg-violet-500/5 p-2">
                          <textarea
                            value={promptDraft}
                            onChange={(e) => setPromptDraft(e.target.value)}
                            rows={2}
                            aria-label="Agent system prompt"
                            className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-violet-500/40"
                          />
                          <div className="mt-1.5 flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label="Show prompt versions"
                              onClick={() => void togglePromptVersions(a.id)}
                              className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-400 accent-hover-text"
                            >
                              <History size={10} /> Versions
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel agent prompt"
                              onClick={() => {
                                setPromptEditAgentId(null);
                                setPromptDraft('');
                              }}
                              className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-500 hover:text-slate-300"
                            >
                              <X size={10} /> Cancel
                            </button>
                            <button
                              type="button"
                              aria-label="Save agent prompt"
                              onClick={() => void saveAgentPrompt(a.id)}
                              className="flex h-6 items-center gap-1 rounded-md bg-violet-500/20 px-1.5 text-[9px] text-violet-300 hover:bg-violet-500/30"
                            >
                              <Check size={10} /> Save
                            </button>
                          </div>
                          {versionOpenAgentId === a.id && (
                            <div className="prompt-version-list mt-1.5 space-y-1">
                              {promptVersions.length === 0 && (
                                <div className="px-1 text-[9px] text-slate-600">
                                  No versions yet
                                </div>
                              )}
                              {promptVersions.map((v, index) => (
                                <div
                                  key={v.id}
                                  className="flex items-start gap-1.5 rounded-md bg-black/20 px-1.5 py-1"
                                >
                                  <span className="shrink-0 text-[9px] text-slate-500">
                                    v{index + 1}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                                    {v.content || '(empty)'}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Restore prompt version ${index + 1}`}
                                    onClick={() => void restorePromptVersion(a.id, v.id)}
                                    className="shrink-0 text-[9px] accent-text-strong accent-hover-base"
                                  >
                                    Restore
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={agentDeptId}
            onChange={(e) => setAgentDeptId(e.target.value)}
            aria-label="Agent department"
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-300 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createAgentItem();
            }}
            placeholder="Agent name"
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={agentRole}
            onChange={(e) => setAgentRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createAgentItem();
            }}
            placeholder="Role"
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void createAgentItem()}
            aria-label="Add agent"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add agent
          </button>
        </div>
      </BentoCard>

      <div className="grid gap-4 md:grid-cols-2">
        <BentoCard title="Token budget" subtitle="跨流估算与月度上限" icon={Wallet} colSpan={6}>
          <div className="space-y-3" data-token-budget-card>
            <div className="flex items-center gap-2">
              <input
                data-token-budget-limit
                type="number"
                min="1"
                value={budgetLimitDraft}
                onChange={(e) => setBudgetLimitDraft(e.target.value)}
                onBlur={saveBudgetLimit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveBudgetLimit();
                }}
                className="h-8 w-28 rounded-xl border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
              />
              <button
                type="button"
                onClick={saveBudgetLimit}
                className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-slate-400 hover:text-emerald-300"
              >
                Set limit
              </button>
              <button
                type="button"
                data-token-budget-reset
                onClick={resetBudgetMonth}
                className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-slate-400 hover:text-rose-300"
              >
                Reset month
              </button>
              <label className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400">
                <input
                  data-token-budget-auto-degrade
                  type="checkbox"
                  checked={budgetConfig.autoDegrade}
                  onChange={toggleBudgetDegrade}
                  className="accent-emerald-500"
                />
                Auto degrade
              </label>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span data-token-budget-used>
                  {formatTokens(budgetStatus.usedTokens)} /{' '}
                  {formatTokens(budgetStatus.monthlyLimit)} tokens
                </span>
                <span>{Math.round(budgetStatus.pct)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
                <div
                  data-token-budget-bar
                  className={`h-full rounded-full ${
                    budgetStatus.over
                      ? 'bg-rose-500'
                      : budgetStatus.near
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(budgetStatus.pct, 2)}%` }}
                />
              </div>
              {budgetStatus.over && (
                <p className="mt-1.5 text-[10px] text-rose-300">
                  Over monthly token budget — AI Studio will degrade to local providers.
                </p>
              )}
            </div>
          </div>
        </BentoCard>
        <BentoCard title="Clipboard history" subtitle="本地实时监听" icon={Clipboard} colSpan={6}>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
            <Radio size={11} className="text-emerald-400" />
            <span>listening</span>
            <span className="ml-auto">{clipboard.length} items</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {clipboard.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="message-in flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-slate-300">{c.content}</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">
                    {c.source} · {formatTime(c.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {clipboard.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-600">Empty</div>
            )}
          </div>
        </BentoCard>
        <BentoCard title="Error logs" subtitle="前端与 Rust 实时诊断" icon={Terminal} colSpan={6}>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
            <span
              className={`health-dot h-1.5 w-1.5 rounded-full ${logs.some((l) => l.severity === 'error') ? 'bg-red-400' : 'bg-emerald-400'}`}
            />
            <span>{logs.some((l) => l.severity === 'error') ? 'has errors' : 'healthy'}</span>
            <span className="ml-auto">{visibleLogs.length} entries</span>
          </div>
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
              <button
                type="button"
                data-error-range-24h
                aria-pressed={errorLogRange === '24h'}
                onClick={() => changeErrorLogRange('24h')}
                className={`h-5 rounded px-1.5 text-[9px] ${
                  errorLogRange === '24h'
                    ? 'accent-bg-15 accent-text-strong'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                24h
              </button>
              <button
                type="button"
                data-error-range-7d
                aria-pressed={errorLogRange === '7d'}
                onClick={() => changeErrorLogRange('7d')}
                className={`h-5 rounded px-1.5 text-[9px] ${
                  errorLogRange === '7d'
                    ? 'accent-bg-15 accent-text-strong'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                7d
              </button>
              <button
                type="button"
                data-error-range-30d
                aria-pressed={errorLogRange === '30d'}
                onClick={() => changeErrorLogRange('30d')}
                className={`h-5 rounded px-1.5 text-[9px] ${
                  errorLogRange === '30d'
                    ? 'accent-bg-15 accent-text-strong'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                30d
              </button>
            </div>
            {errorLogPeak && (
              <span
                data-error-peak
                data-error-peak-bucket={errorLogPeak.bucket}
                data-error-peak-count={errorLogPeak.count}
                data-error-peak-ratio={errorLogPeak.ratio}
                className="flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
              >
                <AlertTriangle size={10} />
                peak {errorLogPeak.count} at {errorLogPeak.ratio}x mean
              </span>
            )}
            <select
              data-error-source-filter
              value={errorSourceFilter}
              onChange={(e) => changeErrorSourceFilter(e.target.value)}
              aria-label="Error source filter"
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
            >
              <option value="all">All sources</option>
              {errorSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              data-error-severity-filter
              value={errorSeverityFilter}
              onChange={(e) => changeErrorSeverityFilter(e.target.value)}
              aria-label="Error severity filter"
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
            >
              <option value="all">All</option>
              <option value="error">error</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
            </select>
            <select
              data-error-device-filter
              value={errorDeviceFilter}
              onChange={(e) => changeErrorDeviceFilter(e.target.value)}
              aria-label="Error device filter"
              className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
            >
              <option value="all">All devices</option>
              <option value="current">current</option>
              {errorDevices
                .filter((device) => device !== deviceId && device !== 'unknown')
                .map((device) => (
                  <option key={device} value={device}>
                    {device.slice(0, 12)}
                  </option>
                ))}
            </select>
            <span data-error-log-total className="ml-auto shrink-0 text-[9px] text-slate-500">
              {errorLogSummary?.total ?? 0} logs
            </span>
          </div>
          <div
            data-error-log-chart
            data-error-granularity={errorLogGranularity}
            className="mb-2 flex h-14 items-end gap-1"
          >
            {(errorLogSummary?.buckets.length ?? 0) === 0 && (
              <div className="py-4 text-[9px] text-slate-600">No errors</div>
            )}
            {(errorLogSummary?.buckets ?? []).map((bucket) => {
              const max = Math.max(1, ...(errorLogSummary?.buckets ?? []).map((b) => b.count));
              const height = Math.max(4, Math.round((bucket.count / max) * 42));
              return (
                <div
                  key={bucket.bucket}
                  className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                >
                  <div
                    data-error-log-bar
                    data-error-bucket={bucket.bucket}
                    data-error-count={bucket.count}
                    data-error-severity-error={bucket.error}
                    data-error-severity-warning={bucket.warning}
                    data-error-severity-info={bucket.info}
                    title={`${bucket.bucket}: error ${bucket.error}, warning ${bucket.warning}, info ${bucket.info}`}
                    className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm"
                    style={{ height }}
                  >
                    {bucket.info > 0 && (
                      <span
                        className="w-full bg-slate-500/60"
                        style={{ height: `${(bucket.info / bucket.count) * 100}%` }}
                      />
                    )}
                    {bucket.warning > 0 && (
                      <span
                        className="w-full bg-amber-400/80"
                        style={{ height: `${(bucket.warning / bucket.count) * 100}%` }}
                      />
                    )}
                    {bucket.error > 0 && (
                      <span
                        className="w-full bg-red-500/80"
                        style={{ height: `${(bucket.error / bucket.count) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="max-w-full truncate text-[7px] text-slate-600">
                    {errorLogGranularity === 'hour'
                      ? bucket.bucket.slice(11)
                      : bucket.bucket.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {visibleLogs.slice(0, 10).map((l) => (
              <div
                key={l.id}
                data-error-log-source={l.source}
                data-error-log-device={l.deviceId || 'unknown'}
                className="message-in rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-[11px] text-red-300">
                  <span className="font-medium">{l.source}</span>
                  <span className="text-[9px] text-red-400/70">
                    {(l.deviceId || 'unknown').slice(0, 12)}
                  </span>
                  <span className="text-[9px] uppercase text-red-400/70">{l.severity}</span>
                  <span className="ml-auto text-[10px] text-red-400/60">
                    {formatTime(l.timestamp)}
                  </span>
                </div>
                <p className="mt-1 break-words text-[11px] leading-relaxed text-red-200/80">
                  {l.message}
                </p>
                {l.stack && (
                  <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-red-300/60">
                    {l.stack}
                  </pre>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-600">No logs</div>
            )}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
