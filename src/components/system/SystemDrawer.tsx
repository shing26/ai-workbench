import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  CloudUpload,
  Copy,
  Database,
  Download,
  HeartPulse,
  History,
  KeyRound,
  List,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Terminal,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from '../../lib/db';
import { useWorkbenchStore } from '../../stores/workbenchStore';
import BentoCard from '../ui/BentoCard';
import ModelBadge from '../ui/ModelBadge';

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

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(value);
}

function providerModelCacheStatus(models: db.ProviderModel[] | undefined) {
  const list = models ?? [];
  if (list.length === 0) return null;
  const latest = Math.max(...list.map((m) => m.fetchedAt ?? 0));
  if (!latest) return { count: list.length, label: 'stale' };
  const fresh = Date.now() - latest <= db.MODEL_CACHE_TTL_MS;
  return { count: list.length, label: fresh ? 'fresh' : 'stale' };
}

function syncErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
  const message = err instanceof Error ? err.message : '';
  if (name) return message ? `${name}: ${message}` : `Operation failed (${name})`;
  return message || String(err ?? 'Unknown sync error');
}

const TABS = [
  { id: 'providers', label: 'Providers' },
  { id: 'sync', label: 'Sync' },
  { id: 'eventbus', label: 'Event bus' },
  { id: 'agent', label: 'Agent' },
  { id: 'clipboard', label: 'Clipboard' },
  { id: 'errorlogs', label: 'Error logs' },
  { id: 'storage', label: 'Storage' },
] as const;

type DrawerTab = (typeof TABS)[number]['id'];

type Props = {
  open: boolean;
  onClose: () => void;
  health: Record<string, db.ProviderHealth>;
  heartbeat: db.ProviderHeartbeatSnapshot | null;
  setHealth: React.Dispatch<React.SetStateAction<Record<string, db.ProviderHealth>>>;
  setHeartbeat: React.Dispatch<React.SetStateAction<db.ProviderHeartbeatSnapshot | null>>;
};

export default function SystemDrawer({
  open,
  onClose,
  health,
  heartbeat,
  setHealth,
  setHeartbeat,
}: Props) {
  const providers = useWorkbenchStore((s) => s.providers);
  const addProvider = useWorkbenchStore((s) => s.addProvider);
  const toggleProvider = useWorkbenchStore((s) => s.toggleProvider);
  const setProviderModel = useWorkbenchStore((s) => s.setProviderModel);
  const setProviderPriority = useWorkbenchStore((s) => s.setProviderPriority);
  const setProviderStreamConfig = useWorkbenchStore((s) => s.setProviderStreamConfig);
  const exportProviders = useWorkbenchStore((s) => s.exportProviders);
  const importProviders = useWorkbenchStore((s) => s.importProviders);
  const clipboard = useWorkbenchStore((s) => s.clipboard);
  const logs = useWorkbenchStore((s) => s.logs);
  const refreshSystem = useWorkbenchStore((s) => s.refreshSystem);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
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
  const [modelMetaEditOpen, setModelMetaEditOpen] = useState<Record<string, boolean>>({});
  const [modelRefreshBusy, setModelRefreshBusy] = useState<Record<string, boolean>>({});
  const [modelMetaDraft, setModelMetaDraft] = useState<
    Record<
      string,
      {
        contextWindow: string;
        inputPricePerMtok: string;
        outputPricePerMtok: string;
        rateTpm: string;
        rateRpm: string;
      }
    >
  >({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [streamDrafts, setStreamDrafts] = useState<
    Record<string, { timeoutSecs: number; retryCount: number; retryDelaySecs: number }>
  >({});
  const [providerImportOpen, setProviderImportOpen] = useState(false);
  const [snapshotPath, setSnapshotPath] = useState('');
  const [snapshots, setSnapshots] = useState<db.FileBackupEntry[]>([]);
  const [snapshotKeep, setSnapshotKeep] = useState('5');
  const [snapshotResult, setSnapshotResult] = useState('');
  const [providerImportText, setProviderImportText] = useState('');
  const [providerImportResult, setProviderImportResult] = useState('');
  const [providerExportResult, setProviderExportResult] = useState('');
  const [eventBusStats, setEventBusStats] = useState<db.EventBusStats | null>(null);
  const [eventBusEvent, setEventBusEvent] = useState('');
  const [eventBusContext, setEventBusContext] = useState('{"note":"hello"}');
  const [eventBusSource, setEventBusSource] = useState('workbench');
  const [eventBusLogs, setEventBusLogs] = useState<db.EventLogRecord[]>([]);
  const [eventBusSchemas, setEventBusSchemas] = useState<db.EventSchema[]>([]);
  const [eventBusSchemaEvent, setEventBusSchemaEvent] = useState('');
  const [eventBusSchemaJson, setEventBusSchemaJson] = useState(
    '{"required":["note"],"properties":{"note":{"type":"string"}}}',
  );
  const [eventBusSchemaEnabled, setEventBusSchemaEnabled] = useState(true);
  const [eventBusConfig, setEventBusConfig] = useState<db.EventBusConfig | null>(null);
  const [eventBusForwardEnabled, setEventBusForwardEnabled] = useState(false);
  const [eventBusForwardUrl, setEventBusForwardUrl] = useState('');
  const [eventBusForwardToken, setEventBusForwardToken] = useState('');
  const [eventBusRetentionDays, setEventBusRetentionDays] = useState('30');
  const [eventBusMaxLogs, setEventBusMaxLogs] = useState('500');
  const [eventBusSchemaStrict, setEventBusSchemaStrict] = useState(true);
  const [eventBusForwards, setEventBusForwards] = useState<db.EventForwardRecord[]>([]);
  const [eventBusMessage, setEventBusMessage] = useState('');
  const [eventBusBusy, setEventBusBusy] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastRemoteDevice, setLastRemoteDevice] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [syncEncryptEnabled, setSyncEncryptEnabled] = useState(false);
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncStrength, setSyncStrength] = useState<db.PassphraseStrength | null>(null);
  const [syncKeyStatus, setSyncKeyStatus] = useState<db.SyncKeyStatus | null>(null);
  const [syncKeyVersions, setSyncKeyVersions] = useState<db.SyncKeyVersion[]>([]);
  const [syncConfirmed, setSyncConfirmed] = useState(false);
  const [syncPairingCode, setSyncPairingCode] = useState('');
  const [syncPairInput, setSyncPairInput] = useState('');
  const [syncPairMessage, setSyncPairMessage] = useState('');
  const [syncRotateMessage, setSyncRotateMessage] = useState('');
  const [syncPairBusy, setSyncPairBusy] = useState(false);
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
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const runAutoSyncRef = useRef<() => Promise<void>>(async () => {});
  const strengthTimerRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('providers');
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void db.getSyncStatus().then((status) => {
      setDeviceId(status.deviceId);
      setLastSyncedAt(status.lastSyncedAt);
    });
    void db.getSyncKeyStatus().then((status) => {
      setSyncKeyStatus(status);
      setSyncConfirmed(status.confirmed && status.activeKeyVersion > 0);
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        document.querySelector<HTMLElement>('[data-system-drawer-toggle]')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const scrollToSection = (id: DrawerTab) => {
    setActiveTab(id);
    const el = document.getElementById(`system-drawer-${id}`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const handleBodyScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    const sections = Array.from(body.querySelectorAll<HTMLElement>('[data-system-drawer-section]'));
    let current: DrawerTab = 'providers';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 128) {
        current = (section.dataset.systemDrawerSection as DrawerTab) ?? 'providers';
      }
    }
    setActiveTab(current);
  };

  const refreshSyncKeyStatus = async () => {
    const status = await db.getSyncKeyStatus();
    setSyncKeyStatus(status);
    setSyncConfirmed(status.confirmed && status.activeKeyVersion > 0);
    void db.listSyncKeyVersions().then(setSyncKeyVersions);
    if (status.confirmed && status.activeKeyVersion > 0) {
      void db
        .getSyncPairingCode()
        .then(setSyncPairingCode)
        .catch(() => setSyncPairingCode(''));
    }
  };

  const handleSyncPassphraseChange = (value: string) => {
    setSyncPassphrase(value);
    setSyncConfirmed(false);
    if (strengthTimerRef.current !== null) {
      window.clearTimeout(strengthTimerRef.current);
    }
    if (!value.trim()) {
      setSyncStrength(null);
      return;
    }
    strengthTimerRef.current = window.setTimeout(() => {
      void db.syncPassphraseStrength(value).then(setSyncStrength);
    }, 220);
  };

  const confirmSyncPassphrase = async () => {
    setSyncError(false);
    setSyncPairMessage('');
    try {
      if (!syncConfirmed) {
        if (syncKeyStatus?.activeKeyVersion) {
          await db.confirmSyncPassphrase(syncPassphrase.trim());
        } else {
          await db.registerSyncPassphrase(deviceId, syncPassphrase.trim());
        }
        setSyncConfirmed(true);
        setSyncMessage(
          syncKeyStatus?.activeKeyVersion
            ? 'Sync passphrase re-confirmed'
            : 'Sync passphrase confirmed',
        );
      }
      await refreshSyncKeyStatus();
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const rotateSyncPassphrase = async () => {
    setSyncError(false);
    setSyncRotateMessage('');
    try {
      const credential = await db.rotateSyncPassphrase(deviceId, syncPassphrase.trim());
      await refreshSyncKeyStatus();
      setSyncRotateMessage(
        `Rotated to key version ${credential.activeKeyVersion} with a fresh salt`,
      );
      setSyncMessage(`Rotated sync key to version ${credential.activeKeyVersion}`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(syncErrorMessage(err));
    }
  };

  const copySyncPairingCode = async () => {
    try {
      await navigator.clipboard.writeText(syncPairingCode);
      setSyncPairMessage('Pairing code copied');
    } catch {
      setSyncPairMessage('Select and copy the pairing code manually');
    }
  };

  const verifySyncPairingCode = async () => {
    if (!syncPairInput.trim()) {
      setSyncPairMessage('Paste the other device pairing code first');
      return;
    }
    setSyncPairBusy(true);
    setSyncPairMessage('');
    try {
      const paired = await db.verifySyncPairingCode(syncPairInput.trim(), syncPassphrase.trim());
      setSyncPairMessage(`Paired with ${paired.deviceId.slice(0, 8)}`);
      setSyncPairInput('');
      await refreshSyncKeyStatus();
    } catch (err) {
      setSyncPairMessage(syncErrorMessage(err));
    } finally {
      setSyncPairBusy(false);
    }
  };

  const removeSyncPairedDevice = async (remoteDeviceId: string) => {
    await db.removeSyncPairedDevice(remoteDeviceId);
    await refreshSyncKeyStatus();
  };

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
    if (syncEncryptEnabled && !syncConfirmed) {
      setSyncError(true);
      setSyncMessage('Confirm the passphrase before using encrypted sync');
      return;
    }
    if (syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed) {
      await db.exportEncryptedSyncSnapshot(syncPassphrase.trim());
      setSyncMessage('Exported encrypted snapshot');
    } else {
      const snapshot = await db.exportSyncSnapshot();
      setSyncMessage(`Exported ${snapshot.clipboard.length} clips / ${snapshot.logs.length} logs`);
    }
  };

  const importSync = async () => {
    try {
      if (syncEncryptEnabled && !syncConfirmed) {
        setSyncError(true);
        setSyncMessage('Confirm the passphrase before using encrypted sync');
        return;
      }
      const result =
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
          ? await db.importEncryptedSyncSnapshot(syncPassphrase.trim())
          : await db.importSyncSnapshot();
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setLastRemoteDevice(result.deviceId);
      setSyncMessage(
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
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
      if (syncEncryptEnabled && !syncConfirmed) {
        setSyncError(true);
        setSyncMessage('Confirm the passphrase before using encrypted sync');
        return;
      }
      const result = await db.pushSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
          ? syncPassphrase.trim()
          : undefined,
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
      if (syncEncryptEnabled && !syncConfirmed) {
        setSyncError(true);
        setSyncMessage('Confirm the passphrase before using encrypted sync');
        return;
      }
      const result = await db.pullSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
          ? syncPassphrase.trim()
          : undefined,
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
      if (syncEncryptEnabled && !syncConfirmed) {
        setSyncError(true);
        setSyncMessage('Confirm the passphrase before using encrypted sync');
        return;
      }
      const pulled = await db.pullSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
          ? syncPassphrase.trim()
          : undefined,
      );
      await refreshSystem();
      await loadConflicts();
      await loadAudit();
      const pushed = await db.pushSyncSnapshot(
        remoteUrl.trim(),
        remoteToken,
        syncEncryptEnabled && syncPassphrase.trim() && syncConfirmed
          ? syncPassphrase.trim()
          : undefined,
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
    if (confirmAction !== 'clear-resolved') {
      setConfirmAction('clear-resolved');
      return;
    }
    setConfirmAction(null);
    const cleared = await db.clearResolvedSyncConflicts();
    setResolvedConflicts(await db.listSyncConflicts('resolved'));
    await loadAudit();
    setSyncError(false);
    setSyncMessage(`Cleared ${cleared} resolved conflict(s)`);
  };

  const clearAudit = async () => {
    if (confirmAction !== 'clear-audit') {
      setConfirmAction('clear-audit');
      return;
    }
    setConfirmAction(null);
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

  const loadEventBusData = useCallback(async () => {
    const [stats, eventLogs, schemas, config, forwards] = await Promise.all([
      db.getEventBusStats(),
      db.listEventLogs(undefined, 20),
      db.listEventSchemas(),
      db.getEventBusConfig(),
      db.listEventForwards(undefined, 20),
    ]);
    setEventBusStats(stats);
    setEventBusLogs(eventLogs);
    setEventBusSchemas(schemas);
    setEventBusConfig(config);
    setEventBusForwardEnabled(config.forwardEnabled);
    setEventBusForwardUrl(config.forwardUrl);
    setEventBusForwardToken(config.forwardToken);
    setEventBusRetentionDays(String(config.retentionDays));
    setEventBusMaxLogs(String(config.maxLogs));
    setEventBusSchemaStrict(config.schemaStrict);
    setEventBusForwards(forwards);
  }, []);

  const emitEventBus = async () => {
    if (!eventBusEvent.trim()) {
      setEventBusMessage('Event name required');
      return;
    }
    let context: Record<string, unknown> = {};
    if (eventBusContext.trim()) {
      try {
        context = JSON.parse(eventBusContext) as Record<string, unknown>;
      } catch {
        setEventBusMessage('Event context must be valid JSON');
        return;
      }
    }
    setEventBusBusy(true);
    try {
      const result = await db.emitEventBusEvent(
        eventBusEvent.trim(),
        context,
        eventBusSource.trim() || 'workbench',
        deviceId,
      );
      setEventBusMessage(
        `${result.validated ? 'Accepted' : `Rejected: ${result.rejectedReason}`} · ${
          result.forwarded
        } forwarded`,
      );
      await loadEventBusData();
    } catch (err) {
      setEventBusMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setEventBusBusy(false);
    }
  };

  const saveEventBusSchema = async () => {
    if (!eventBusSchemaEvent.trim()) {
      setEventBusMessage('Schema event name required');
      return;
    }
    try {
      await db.setEventSchema(
        eventBusSchemaEvent.trim(),
        eventBusSchemaJson.trim() || '{}',
        eventBusSchemaEnabled,
      );
      setEventBusSchemas(await db.listEventSchemas());
      setEventBusMessage(`Schema saved for ${eventBusSchemaEvent.trim()}`);
    } catch (err) {
      setEventBusMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const selectEventBusSchema = (schema: db.EventSchema) => {
    setEventBusSchemaEvent(schema.event);
    setEventBusSchemaJson(schema.schema);
    setEventBusSchemaEnabled(schema.enabled);
  };

  const saveEventBusConfig = async () => {
    const config = await db.setEventBusConfig(
      eventBusForwardEnabled,
      eventBusForwardUrl,
      eventBusForwardToken,
      Number(eventBusRetentionDays) || 30,
      Number(eventBusMaxLogs) || 500,
      eventBusSchemaStrict,
    );
    setEventBusConfig(config);
    setEventBusMessage(
      `Event bus config saved (${config.retentionDays}d / ${config.maxLogs} logs)`,
    );
  };

  const retryEventForwardItem = async (id: string) => {
    await db.retryEventForward(id);
    setEventBusForwards(await db.listEventForwards(undefined, 20));
    setEventBusMessage('Event forward requeued');
  };

  const deleteEventForwardItem = async (id: string) => {
    await db.deleteEventForward(id);
    setEventBusForwards(await db.listEventForwards(undefined, 20));
    setEventBusMessage('Event forward deleted');
  };

  const clearEventBusLogs = async () => {
    if (confirmAction !== 'clear-event-logs') {
      setConfirmAction('clear-event-logs');
      return;
    }
    setConfirmAction(null);
    const removed = await db.clearEventLogs();
    setEventBusMessage(`Cleared ${removed} event logs`);
    await loadEventBusData();
  };

  const clearEventBusForwards = async () => {
    if (confirmAction !== 'clear-event-forwards') {
      setConfirmAction('clear-event-forwards');
      return;
    }
    setConfirmAction(null);
    const removed = await db.clearEventForwards();
    setEventBusMessage(`Cleared ${removed} event forwards`);
    await loadEventBusData();
  };

  useEffect(() => {
    void loadEventBusData();
    const onEventBusUpdated = () => void loadEventBusData();
    window.addEventListener('workbench:event-bus-updated', onEventBusUpdated);
    return () => window.removeEventListener('workbench:event-bus-updated', onEventBusUpdated);
  }, [loadEventBusData]);

  useEffect(() => {
    let disposed = false;
    const ids = providers.map((p) => p.id);
    void (async () => {
      for (const id of ids) {
        try {
          const cached = await db.listCachedProviderModels(id);
          if (disposed) return;
          setProviderModels((prev) => ({ ...prev, [id]: cached }));
          const stale =
            cached.length > 0 &&
            cached.every((m) => Date.now() - (m.fetchedAt ?? 0) > db.MODEL_CACHE_TTL_MS);
          if (stale) {
            const fresh = await db.refreshProviderModels(id);
            if (!disposed) setProviderModels((prev) => ({ ...prev, [id]: fresh }));
          }
        } catch {
          // unreachable providers stay uncached until manual detect
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [providers]);

  const create = async () => {
    if (!name.trim() || !baseUrl.trim()) return;
    await addProvider(name.trim(), baseUrl.trim(), apiKey.trim(), model.trim());
    setName('');
    setBaseUrl('');
    setApiKey('');
    setModel('');
  };

  const hotSwapProvider = async (id: string) => {
    const others = providers.filter((p) => p.isActive && p.id !== id);
    for (const other of others) await toggleProvider(other.id, false);
    if (!providers.find((p) => p.id === id)?.isActive) await toggleProvider(id, true);
  };

  const loadSnapshots = async (pathValue: string) => {
    if (!pathValue.trim()) {
      setSnapshotResult('请输入项目路径');
      return;
    }
    try {
      const list = await db.listSnapshots(pathValue.trim());
      setSnapshots(list);
      setSnapshotResult(`共 ${list.length} 个快照`);
    } catch (err) {
      setSnapshotResult(err instanceof Error ? err.message : String(err));
    }
  };

  const pruneSnapshots = async () => {
    if (!snapshotPath.trim()) return;
    try {
      const keep = Math.max(0, Number(snapshotKeep) || 0);
      const removed = await db.pruneSnapshots(snapshotPath.trim(), keep);
      setSnapshotResult(`已清理 ${removed} 个快照`);
      await loadSnapshots(snapshotPath);
    } catch (err) {
      setSnapshotResult(err instanceof Error ? err.message : String(err));
    }
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
    setModelRefreshBusy((prev) => ({ ...prev, [id]: true }));
    try {
      const models = await db.refreshProviderModels(id);
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
    } finally {
      setModelRefreshBusy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const pickProviderModel = async (id: string, modelId: string) => {
    setModelDrafts((prev) => ({ ...prev, [id]: modelId }));
    setProviderModelOpen((prev) => ({ ...prev, [id]: false }));
    await saveProviderModel(id, modelId);
    await db.touchProviderModelUsage(id, modelId).catch(() => {});
    const models = await db.listCachedProviderModels(id);
    setProviderModels((prev) => ({ ...prev, [id]: models }));
  };

  const toggleProviderModelFavorite = async (id: string, modelId: string) => {
    const current = providerModels[id]?.find((m) => m.id === modelId);
    await db.setProviderModelFavorite(id, modelId, !current?.isFavorite);
    const models = await db.listCachedProviderModels(id);
    setProviderModels((prev) => ({ ...prev, [id]: models }));
  };

  const saveProviderModelMeta = async (id: string, modelId: string) => {
    const draft = modelMetaDraft[`${id}:${modelId}`];
    if (!draft) return;
    await db.updateProviderModelMeta(id, modelId, {
      contextWindow: Number(draft.contextWindow) || 0,
      inputPricePerMtok: Number(draft.inputPricePerMtok) || 0,
      outputPricePerMtok: Number(draft.outputPricePerMtok) || 0,
      rateTpm: Number(draft.rateTpm) || 0,
      rateRpm: Number(draft.rateRpm) || 0,
    });
    const models = await db.listCachedProviderModels(id);
    setProviderModels((prev) => ({ ...prev, [id]: models }));
    setModelMetaEditOpen((prev) => {
      const next = { ...prev };
      delete next[`${id}:${modelId}`];
      return next;
    });
  };

  const saveProviderStreamConfig = async (
    id: string,
    patch: Partial<{ timeoutSecs: number; retryCount: number; retryDelaySecs: number }>,
  ) => {
    const provider = providers.find((p) => p.id === id);
    const current = streamDrafts[id] ?? {
      timeoutSecs: provider?.timeoutSecs ?? 30,
      retryCount: provider?.retryCount ?? 1,
      retryDelaySecs: provider?.retryDelaySecs ?? 1,
    };
    const next = { ...current, ...patch };
    await setProviderStreamConfig(id, next.timeoutSecs, next.retryCount, next.retryDelaySecs);
    setStreamDrafts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleProviderExport = async () => {
    const text = await exportProviders();
    const parsed = JSON.parse(text) as { providers?: unknown[] };
    const count = Array.isArray(parsed.providers) ? parsed.providers.length : 0;
    setProviderExportResult(`Exported ${count} provider(s)`);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard is optional in headless verification */
    }
  };

  const handleProviderImport = async () => {
    const count = await importProviders(providerImportText);
    setProviderImportResult(`Imported ${count} provider(s)`);
    setProviderImportText('');
    setProviderImportOpen(false);
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
    <aside
      data-system-drawer
      aria-hidden={!open}
      className={`absolute right-0 top-0 bottom-0 z-40 flex w-[420px] max-w-[94vw] flex-col border-l border-white/10 bg-[#16161A] shadow-[-24px_0_70px_rgba(0,0,0,0.5)] transition-[transform,opacity] duration-[150ms] ease-out motion-reduce:transition-none ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-200">System config</h2>
          <p className="truncate text-[10px] text-slate-500">Sync · Event bus · Agent · 明细配置</p>
        </div>
        <button
          type="button"
          data-system-drawer-close
          onClick={onClose}
          aria-label="Close system config"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 hover:border-rose-500/30 hover:text-rose-300"
        >
          <X size={14} />
        </button>
      </div>
      <div
        data-system-drawer-tabs
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-system-drawer-tab={tab.id}
            aria-pressed={activeTab === tab.id}
            onClick={() => scrollToSection(tab.id)}
            className={`flex h-6 shrink-0 items-center rounded-md px-2 text-[9px] transition-[background-color,color] duration-[120ms] ease-out motion-reduce:transition-none ${
              activeTab === tab.id
                ? 'accent-bg-15 accent-text-strong'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        data-system-drawer-sections
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        <section
          id="system-drawer-providers"
          data-system-drawer-section="providers"
          className="scroll-mt-2"
        >
          <BentoCard title="Providers" subtitle="AI 节点配置与健康度" icon={Activity} tier="fold">
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
                  {heartbeat.checkedAt
                    ? new Date(heartbeat.checkedAt).toLocaleTimeString('zh-CN')
                    : ''}
                </span>
              </div>
            )}
            <div className="mb-3 grid gap-2">
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
                      <button
                        type="button"
                        data-provider-set-active={p.id}
                        onClick={() => void hotSwapProvider(p.id)}
                        className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25"
                        title="设为当前 API（热切）"
                      >
                        ⚡ 设为当前 API
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
                      {(() => {
                        const status = providerModelCacheStatus(providerModels[p.id]);
                        return status ? (
                          <span
                            data-provider-model-cache-status={p.id}
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] ${
                              status.label === 'fresh'
                                ? 'bg-sky-500/10 text-sky-300'
                                : 'bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {status.count} · {status.label}
                          </span>
                        ) : null;
                      })()}
                      {modelRefreshBusy[p.id] && (
                        <span
                          data-provider-model-refresh-busy={p.id}
                          className="shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-300"
                        >
                          refresh
                        </span>
                      )}
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
                        className="mt-1.5 grid max-h-40 gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-[#101014] p-1"
                      >
                        {providerModels[p.id].map((m) => {
                          const metaKey = `${p.id}:${m.id}`;
                          const draft = modelMetaDraft[metaKey] ?? {
                            contextWindow: String(m.contextWindow ?? 0),
                            inputPricePerMtok: String(m.inputPricePerMtok ?? 0),
                            outputPricePerMtok: String(m.outputPricePerMtok ?? 0),
                            rateTpm: String(m.rateTpm ?? 0),
                            rateRpm: String(m.rateRpm ?? 0),
                          };
                          return (
                            <div
                              key={m.id}
                              className="rounded-md border border-transparent hover:border-white/10"
                            >
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-provider-model-option={m.id}
                                  onClick={() => void pickProviderModel(p.id, m.id)}
                                  className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] ${
                                    m.id === (modelDrafts[p.id] ?? p.model)
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'text-slate-300 hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <span className="truncate">{m.id}</span>
                                  {m.contextWindow ? (
                                    <span className="shrink-0 rounded bg-sky-500/10 px-1 text-[8px] text-sky-300">
                                      ctx {formatCompact(m.contextWindow)}
                                    </span>
                                  ) : null}
                                  {(m.inputPricePerMtok ?? 0) > 0 ||
                                  (m.outputPricePerMtok ?? 0) > 0 ? (
                                    <span className="shrink-0 rounded bg-emerald-500/10 px-1 text-[8px] text-emerald-300">
                                      ${m.inputPricePerMtok ?? 0}/{m.outputPricePerMtok ?? 0}
                                    </span>
                                  ) : null}
                                  {(m.rateTpm ?? 0) > 0 ? (
                                    <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[8px] text-amber-300">
                                      TPM {formatCompact(m.rateTpm ?? 0)}
                                    </span>
                                  ) : null}
                                  {m.ownedBy ? (
                                    <span className="shrink-0 text-slate-600">{m.ownedBy}</span>
                                  ) : null}
                                </button>
                                <button
                                  type="button"
                                  data-model-favorite={m.id}
                                  aria-label={m.isFavorite ? 'Unfavorite model' : 'Favorite model'}
                                  onClick={() => void toggleProviderModelFavorite(p.id, m.id)}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                    m.isFavorite
                                      ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-amber-300'
                                  }`}
                                >
                                  <Star size={9} fill={m.isFavorite ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                  type="button"
                                  data-model-meta-edit={m.id}
                                  aria-label={`Edit ${m.id} metadata`}
                                  onClick={() =>
                                    setModelMetaEditOpen((prev) => ({
                                      ...prev,
                                      [metaKey]: !prev[metaKey],
                                    }))
                                  }
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-500 hover:border-sky-500/30 hover:text-sky-300"
                                >
                                  <SlidersHorizontal size={9} />
                                </button>
                              </div>
                              {modelMetaEditOpen[metaKey] && (
                                <div
                                  data-model-meta-editor={m.id}
                                  className="mt-1 grid grid-cols-5 gap-1 px-1 pb-1"
                                >
                                  {(
                                    [
                                      'contextWindow',
                                      'inputPricePerMtok',
                                      'outputPricePerMtok',
                                      'rateTpm',
                                      'rateRpm',
                                    ] as const
                                  ).map((field) => (
                                    <label key={field} className="flex flex-col gap-0.5">
                                      <span className="text-[8px] text-slate-600">{field}</span>
                                      <input
                                        data-model-meta-input={field}
                                        value={draft[field]}
                                        onChange={(e) =>
                                          setModelMetaDraft((prev) => ({
                                            ...prev,
                                            [metaKey]: {
                                              ...draft,
                                              [field]: e.target.value,
                                            },
                                          }))
                                        }
                                        className="h-5 min-w-0 rounded border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-300"
                                      />
                                    </label>
                                  ))}
                                  <button
                                    type="button"
                                    data-model-meta-save={m.id}
                                    onClick={() => void saveProviderModelMeta(p.id, m.id)}
                                    className="col-span-5 h-5 rounded-md bg-sky-500/15 text-[9px] text-sky-300 hover:bg-sky-500/25"
                                  >
                                    Save metadata
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {providerModelError[p.id] && (
                      <p
                        data-provider-model-error
                        className="mt-1 truncate text-[9px] text-rose-300"
                      >
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
                      <span className="text-slate-500">
                        {state ? `${state.latencyMs}ms` : '- ms'}
                      </span>
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
                    <div
                      className="mt-2 flex items-center gap-1.5"
                      data-provider-priority-row={p.id}
                    >
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
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ['timeout', 'Timeout', 'timeoutSecs'],
                          ['retry', 'Retries', 'retryCount'],
                          ['delay', 'Delay', 'retryDelaySecs'],
                        ] as const
                      ).map(([key, label, field]) => {
                        const draft = streamDrafts[p.id] ?? {
                          timeoutSecs: p.timeoutSecs ?? 30,
                          retryCount: p.retryCount ?? 1,
                          retryDelaySecs: p.retryDelaySecs ?? 1,
                        };
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-1 text-[9px] text-slate-500"
                          >
                            <span className="shrink-0">{label}</span>
                            <input
                              type="number"
                              {...{ [`data-provider-${key}`]: p.id }}
                              value={draft[field]}
                              min={key === 'timeout' ? 1 : 0}
                              max={key === 'timeout' ? 300 : key === 'retry' ? 5 : 30}
                              onChange={(e) =>
                                setStreamDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] ?? {
                                      timeoutSecs: p.timeoutSecs ?? 30,
                                      retryCount: p.retryCount ?? 1,
                                      retryDelaySecs: p.retryDelaySecs ?? 1,
                                    }),
                                    [field]: Number(e.target.value),
                                  },
                                }))
                              }
                              onBlur={(e) =>
                                void saveProviderStreamConfig(p.id, {
                                  [field]: Number(e.target.value),
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="h-5 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
                            />
                          </label>
                        );
                      })}
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
                data-provider-export
                onClick={() => void handleProviderExport()}
                className="flex h-9 items-center gap-1 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30"
              >
                <Download size={14} /> Export
              </button>
              {providerExportResult && (
                <span
                  data-provider-export-result
                  className="flex h-9 items-center rounded-xl bg-emerald-500/10 px-3 text-xs text-emerald-300"
                >
                  {providerExportResult}
                </span>
              )}
              <button
                type="button"
                data-provider-import
                onClick={() => setProviderImportOpen((open) => !open)}
                className="flex h-9 items-center gap-1 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30"
              >
                <Upload size={14} /> Import
              </button>
              {providerImportOpen && (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <textarea
                    data-provider-import-text
                    value={providerImportText}
                    onChange={(e) => setProviderImportText(e.target.value)}
                    rows={4}
                    placeholder='{"version":1,"providers":[]}'
                    className="min-h-20 flex-1 resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    data-provider-import-apply
                    onClick={() => void handleProviderImport()}
                    className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/15 px-3 text-xs text-emerald-300 hover:bg-emerald-500/25"
                  >
                    Apply import
                  </button>
                </div>
              )}
              {providerImportResult && (
                <span
                  data-provider-import-result
                  className="flex h-9 items-center rounded-xl bg-emerald-500/10 px-3 text-xs text-emerald-300"
                >
                  {providerImportResult}
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
        </section>

        <section id="system-drawer-sync" data-system-drawer-section="sync" className="scroll-mt-2">
          <BentoCard
            title="Sync snapshot"
            subtitle="剪贴板与日志跨设备同步"
            icon={CloudUpload}
            tier="fold"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-400">
                <input
                  type="checkbox"
                  data-sync-e2e-toggle
                  checked={syncEncryptEnabled}
                  onChange={(e) => {
                    setSyncEncryptEnabled(e.target.checked);
                    if (!e.target.checked) setSyncConfirmed(false);
                  }}
                  className="h-3 w-3 accent-violet-400"
                />
                E2E encrypt
              </label>
              {syncEncryptEnabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={syncPassphrase}
                    onChange={(e) => handleSyncPassphraseChange(e.target.value)}
                    placeholder="Passphrase"
                    data-sync-passphrase
                    className="h-7 w-52 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-violet-500/40 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => void confirmSyncPassphrase()}
                    disabled={!syncPassphrase.trim()}
                    data-sync-confirm
                    className="flex h-7 items-center gap-1 rounded-lg bg-violet-500/15 px-2 text-[10px] text-violet-300 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShieldCheck size={11} />
                    {syncConfirmed ? 'Confirmed' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rotateSyncPassphrase()}
                    disabled={!syncConfirmed || !syncPassphrase.trim()}
                    data-sync-rotate
                    className="flex h-7 items-center gap-1 rounded-lg bg-amber-500/15 px-2 text-[10px] text-amber-300 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <KeyRound size={11} />
                    Rotate
                  </button>
                </div>
              )}
              {syncEncryptEnabled && syncStrength && (
                <div className="flex w-full items-center gap-2" data-sync-strength>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      data-sync-strength-bar
                      className={`h-full rounded-full transition-all ${
                        syncStrength.score < 40
                          ? 'bg-rose-500'
                          : syncStrength.score < 70
                            ? 'bg-amber-400'
                            : syncStrength.score < 90
                              ? 'bg-emerald-400'
                              : 'bg-cyan-300'
                      }`}
                      style={{ width: `${Math.max(4, syncStrength.score)}%` }}
                    />
                  </div>
                  <span data-sync-strength-score className="text-[10px] font-medium text-slate-300">
                    {syncStrength.score}
                  </span>
                  <span
                    data-sync-strength-label
                    className="text-[9px] uppercase tracking-normal text-slate-500"
                  >
                    {syncStrength.label}
                  </span>
                  {syncStrength.feedback.length > 0 && (
                    <span className="text-[9px] text-slate-600">
                      {syncStrength.feedback.join(' / ')}
                    </span>
                  )}
                </div>
              )}
              {syncEncryptEnabled && syncKeyStatus && syncKeyStatus.activeKeyVersion > 0 && (
                <>
                  <div
                    data-sync-key-status
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 text-[9px] text-slate-500"
                  >
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={10} />
                      {syncConfirmed ? 'confirmed' : 'registered'}
                    </span>
                    <span>
                      key v{syncKeyStatus.activeKeyVersion} · {syncKeyStatus.iterations} PBKDF2 ·{' '}
                      {syncKeyStatus.activeFingerprint.slice(0, 10)}…
                    </span>
                    <span>
                      salt {syncKeyStatus.activeSalt.slice(0, 10)}… ·{' '}
                      {syncKeyStatus.pairedDevices.length} paired
                    </span>
                    {syncRotateMessage && (
                      <span className="text-amber-300">{syncRotateMessage}</span>
                    )}
                  </div>
                  {syncKeyVersions.length > 1 && (
                    <div data-sync-key-versions className="flex w-full flex-wrap gap-1.5">
                      {syncKeyVersions.map((version) => (
                        <span
                          key={version.version}
                          className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] ${
                            version.active
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-white/[0.03] text-slate-600'
                          }`}
                        >
                          v{version.version} {version.active ? 'active' : 'rotated'} ·{' '}
                          {version.fingerprint.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              <span
                data-sync-e2e-status
                className={
                  syncEncryptEnabled && syncConfirmed
                    ? 'rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300'
                    : 'text-[9px] text-slate-600'
                }
              >
                {syncEncryptEnabled && syncConfirmed ? 'encrypted' : 'plain'}
              </span>
              {syncEncryptEnabled && syncConfirmed && syncPairingCode && (
                <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                  <span className="text-[9px] text-slate-500">Pairing code</span>
                  <code
                    data-sync-pairing-code
                    className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-emerald-300"
                  >
                    {syncPairingCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copySyncPairingCode()}
                    data-sync-pair-copy
                    className="flex h-6 items-center gap-1 rounded-md bg-white/[0.05] px-1.5 text-[9px] text-slate-400 hover:bg-white/[0.1]"
                  >
                    <Copy size={10} /> Copy
                  </button>
                  <input
                    value={syncPairInput}
                    onChange={(e) => setSyncPairInput(e.target.value)}
                    placeholder="Paste other device pairing code"
                    data-sync-pair-input
                    className="h-6 w-56 rounded-md border border-white/10 bg-white/[0.03] px-2 font-mono text-[9px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => void verifySyncPairingCode()}
                    disabled={syncPairBusy || !syncPairInput.trim() || !syncPassphrase.trim()}
                    data-sync-pair-verify
                    className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-400 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Check size={10} /> Verify
                  </button>
                  {syncPairMessage && (
                    <span className="text-[9px] text-slate-400">{syncPairMessage}</span>
                  )}
                </div>
              )}
              {syncEncryptEnabled && syncKeyStatus && syncKeyStatus.pairedDevices.length > 0 && (
                <div data-sync-paired-list className="flex w-full flex-wrap gap-1.5">
                  {syncKeyStatus.pairedDevices.map((paired) => (
                    <span
                      key={paired.deviceId}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-400"
                    >
                      <Users size={9} />
                      {paired.deviceId.slice(0, 12)} · {paired.fingerprint.slice(0, 8)}
                      <button
                        type="button"
                        onClick={() => void removeSyncPairedDevice(paired.deviceId)}
                        className="text-slate-600 hover:text-rose-400"
                        aria-label={`Remove paired device ${paired.deviceId}`}
                      >
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                <span
                  data-sync-message
                  className={syncError ? 'text-rose-400' : 'text-emerald-400'}
                >
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
                <>
                  <button
                    type="button"
                    aria-label="Clear resolved sync conflict history"
                    data-clear-resolved-history
                    onClick={() => void clearResolvedHistory()}
                    className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] ${
                      confirmAction === 'clear-resolved'
                        ? 'bg-rose-500/25 text-rose-200'
                        : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    }`}
                  >
                    {confirmAction === 'clear-resolved' ? 'Confirm?' : 'Clear resolved'}
                  </button>
                  {confirmAction === 'clear-resolved' && (
                    <button
                      type="button"
                      data-clear-resolved-history-cancel
                      onClick={() => setConfirmAction(null)}
                      className="flex h-7 items-center rounded-lg border border-white/10 px-2 text-[10px] text-slate-400 hover:bg-white/[0.06]"
                    >
                      取消
                    </button>
                  )}
                </>
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
                  className={`flex h-6 items-center rounded-md px-2 text-[9px] ${
                    confirmAction === 'clear-audit'
                      ? 'bg-rose-500/25 text-rose-200'
                      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  }`}
                >
                  {confirmAction === 'clear-audit' ? '确认清除？' : 'Clear'}
                </button>
                {confirmAction === 'clear-audit' && (
                  <button
                    type="button"
                    data-sync-audit-clear-cancel
                    onClick={() => setConfirmAction(null)}
                    className="flex h-6 items-center rounded-md border border-white/10 px-2 text-[9px] text-slate-400 hover:bg-white/[0.06]"
                  >
                    取消
                  </button>
                )}
              </div>
              <div className="mt-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-wide text-slate-600">
                    Activity
                  </span>
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
                  <span
                    data-sync-audit-total
                    className="ml-auto shrink-0 text-[9px] text-slate-500"
                  >
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
                          {bucket.count === 0 && (
                            <div className="h-1 w-full rounded-t-sm bg-white/5" />
                          )}
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
                  <span
                    data-sync-audit-legend-item="merge"
                    className="inline-flex items-center gap-1"
                  >
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
                  <span
                    data-sync-audit-legend-item="other"
                    className="inline-flex items-center gap-1"
                  >
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
        </section>

        <section
          id="system-drawer-eventbus"
          data-system-drawer-section="eventbus"
          className="scroll-mt-2"
        >
          <BentoCard
            title="Event bus"
            subtitle="持久化日志、Schema 校验与跨设备转发"
            icon={Radio}
            tier="fold"
          >
            <div
              data-event-bus-stats
              className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2"
            >
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-slate-300">
                  {eventBusStats?.total ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">total</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-emerald-300">
                  {eventBusStats?.accepted ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">accepted</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-rose-300">
                  {eventBusStats?.rejected ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">rejected</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-cyan-300">
                  {eventBusStats?.forwarded ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">forwarded</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-amber-300">
                  {eventBusStats?.pending ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">pending</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="text-sm font-semibold text-orange-300">
                  {eventBusStats?.failed ?? 0}
                </span>
                <span className="text-[9px] text-slate-500">failed</span>
              </div>
            </div>

            <div className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                value={eventBusEvent}
                onChange={(e) => setEventBusEvent(e.target.value)}
                placeholder="Event name (e.g. daily.summary)"
                data-event-bus-event
                className="h-9 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
              />
              <input
                value={eventBusSource}
                onChange={(e) => setEventBusSource(e.target.value)}
                placeholder="Source (default workbench)"
                data-event-bus-source
                className="h-9 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
              />
              <button
                type="button"
                data-event-bus-emit
                onClick={() => void emitEventBus()}
                disabled={eventBusBusy}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={14} />
                {eventBusBusy ? 'Emitting...' : 'Emit'}
              </button>
            </div>
            <textarea
              value={eventBusContext}
              onChange={(e) => setEventBusContext(e.target.value)}
              placeholder="Event context (JSON)"
              data-event-bus-context
              className="mb-2 h-16 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
            />
            {eventBusMessage && (
              <span
                data-event-bus-message
                className="mb-2 block max-w-full truncate rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-300"
              >
                {eventBusMessage}
              </span>
            )}

            <div className="grid gap-3">
              <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-400">Event logs</span>
                  <button
                    type="button"
                    data-event-bus-logs-clear
                    onClick={() => void clearEventBusLogs()}
                    className={`flex h-6 items-center gap-1 rounded-md px-2 text-[9px] ${
                      confirmAction === 'clear-event-logs'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Trash2 size={10} />
                    {confirmAction === 'clear-event-logs' ? '确认清除？' : 'Clear'}
                  </button>
                  {confirmAction === 'clear-event-logs' && (
                    <button
                      type="button"
                      data-event-bus-logs-clear-cancel
                      onClick={() => setConfirmAction(null)}
                      className="flex h-6 items-center rounded-md border border-white/10 px-2 text-[9px] text-slate-400 hover:bg-white/[0.06]"
                    >
                      取消
                    </button>
                  )}
                </div>
                {eventBusLogs.map((log) => (
                  <div
                    key={log.id}
                    data-event-log-item
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        data-event-log-status
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] ${
                          log.status === 'accepted'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-300">
                        {log.event}
                      </span>
                      <span className="shrink-0 text-[9px] text-slate-600">
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-slate-500">
                      {log.source}
                      {log.deviceId ? ` · ${log.deviceId}` : ''} · schema v{log.schemaVersion}
                    </p>
                    {log.rejectedReason && (
                      <p
                        data-event-log-reason
                        className="mt-1 break-words rounded-md bg-rose-500/10 px-1.5 py-1 text-[9px] text-rose-300"
                      >
                        {log.rejectedReason}
                      </p>
                    )}
                    <pre className="mt-1 max-h-12 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-slate-500">
                      {log.context}
                    </pre>
                  </div>
                ))}
                {eventBusLogs.length === 0 && (
                  <div className="py-6 text-center text-[10px] text-slate-600">No event logs</div>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                <span className="text-[10px] font-medium text-slate-400">Schema registry</span>
                <input
                  value={eventBusSchemaEvent}
                  onChange={(e) => setEventBusSchemaEvent(e.target.value)}
                  placeholder="Schema event name"
                  data-event-schema-event
                  className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 font-mono text-[10px] outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                <textarea
                  value={eventBusSchemaJson}
                  onChange={(e) => setEventBusSchemaJson(e.target.value)}
                  placeholder='{"required":["note"],"properties":{"note":{"type":"string"}}}'
                  data-event-schema-json
                  className="h-20 w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <input
                    type="checkbox"
                    data-event-schema-enabled
                    checked={eventBusSchemaEnabled}
                    onChange={(e) => setEventBusSchemaEnabled(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Enforce schema
                </label>
                <button
                  type="button"
                  data-event-schema-save
                  onClick={() => void saveEventBusSchema()}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-lg accent-bg-20 text-[10px] accent-text-strong accent-hover-bg-30"
                >
                  <Database size={12} />
                  Save schema
                </button>
                <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1">
                  {eventBusSchemas.map((schema) => (
                    <button
                      key={schema.event}
                      type="button"
                      data-event-schema-item
                      onClick={() => selectEventBusSchema(schema)}
                      className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-left hover:bg-white/[0.06]"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-slate-300">
                        {schema.event}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1 text-[8px] ${
                          schema.enabled
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {schema.enabled ? 'on' : 'off'}
                      </span>
                    </button>
                  ))}
                  {eventBusSchemas.length === 0 && (
                    <div className="py-3 text-center text-[9px] text-slate-600">No schemas</div>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-400">Forwarding</span>
                  <label className="flex items-center gap-1.5 text-[9px] text-slate-400">
                    <input
                      type="checkbox"
                      data-event-bus-forward-enabled
                      checked={eventBusForwardEnabled}
                      onChange={(e) => setEventBusForwardEnabled(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    enabled
                  </label>
                </div>
                <input
                  value={eventBusForwardUrl}
                  onChange={(e) => setEventBusForwardUrl(e.target.value)}
                  placeholder="Forward URL"
                  data-event-bus-forward-url
                  className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 font-mono text-[10px] outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                <input
                  value={eventBusForwardToken}
                  onChange={(e) => setEventBusForwardToken(e.target.value)}
                  placeholder="Bearer token"
                  type="password"
                  data-event-bus-forward-token
                  className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={eventBusRetentionDays}
                    onChange={(e) => setEventBusRetentionDays(e.target.value)}
                    type="number"
                    aria-label="Event retention days"
                    data-event-bus-forward-retention
                    className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] outline-none focus:border-emerald-500/40"
                  />
                  <input
                    value={eventBusMaxLogs}
                    onChange={(e) => setEventBusMaxLogs(e.target.value)}
                    type="number"
                    aria-label="Max event logs"
                    data-event-bus-forward-max
                    className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] outline-none focus:border-emerald-500/40"
                  />
                  <label className="flex h-8 items-center justify-center gap-1 rounded-lg bg-white/[0.03] text-[9px] text-slate-400">
                    <input
                      type="checkbox"
                      data-event-bus-forward-strict
                      checked={eventBusSchemaStrict}
                      onChange={(e) => setEventBusSchemaStrict(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    strict
                  </label>
                </div>
                <button
                  type="button"
                  data-event-bus-forward-save
                  onClick={() => void saveEventBusConfig()}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-lg accent-bg-20 text-[10px] accent-text-strong accent-hover-bg-30"
                >
                  <RefreshCw size={12} />
                  Save config
                </button>
                {eventBusConfig && (
                  <p className="truncate text-[9px] text-slate-600">
                    config {eventBusConfig.retentionDays}d / {eventBusConfig.maxLogs} logs
                  </p>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[9px] text-slate-500">Queue</span>
                  <button
                    type="button"
                    data-event-bus-forwards-clear
                    onClick={() => void clearEventBusForwards()}
                    className={`flex h-5 items-center gap-1 rounded-md px-1.5 text-[8px] ${
                      confirmAction === 'clear-event-forwards'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {confirmAction === 'clear-event-forwards' ? '确认清除？' : 'Clear'}
                  </button>
                  {confirmAction === 'clear-event-forwards' && (
                    <button
                      type="button"
                      data-event-bus-forwards-clear-cancel
                      onClick={() => setConfirmAction(null)}
                      className="flex h-5 items-center rounded-md border border-white/10 px-1.5 text-[8px] text-slate-400 hover:bg-white/[0.06]"
                    >
                      取消
                    </button>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1">
                  {eventBusForwards.map((forward) => (
                    <div
                      key={forward.id}
                      data-event-forward-item
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          data-event-forward-status
                          className={`shrink-0 rounded px-1 py-0.5 text-[8px] ${
                            forward.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : forward.status === 'queued' || forward.status === 'delivering'
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'bg-rose-500/10 text-rose-300'
                          }`}
                        >
                          {forward.status}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                          {forward.targetUrl}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[8px] text-slate-600">
                        attempts {forward.attempts} · {formatTime(forward.updatedAt)}
                        {forward.lastMessage ? ` · ${forward.lastMessage}` : ''}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          data-event-forward-retry
                          onClick={() => void retryEventForwardItem(forward.id)}
                          className="flex h-5 items-center rounded bg-white/5 px-1.5 text-[8px] text-slate-400 hover:bg-white/10"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          data-event-forward-delete
                          onClick={() => void deleteEventForwardItem(forward.id)}
                          className="flex h-5 items-center rounded bg-rose-500/10 px-1.5 text-[8px] text-rose-300 hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {eventBusForwards.length === 0 && (
                    <div className="py-4 text-center text-[9px] text-slate-600">No forwards</div>
                  )}
                </div>
              </div>
            </div>
          </BentoCard>
        </section>

        <section
          id="system-drawer-agent"
          data-system-drawer-section="agent"
          className="scroll-mt-2"
        >
          <BentoCard
            title="Agent directory"
            subtitle="部门与 Agent 数据模型"
            icon={Users}
            tier="fold"
          >
            <div className="grid gap-3">
              {departments.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-slate-300">
                      {d.name}
                    </span>
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
        </section>

        <section
          id="system-drawer-clipboard"
          data-system-drawer-section="clipboard"
          className="scroll-mt-2"
        >
          <BentoCard title="Clipboard history" subtitle="本地实时监听" icon={Clipboard} tier="fold">
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
        </section>

        <section
          id="system-drawer-errorlogs"
          data-system-drawer-section="errorlogs"
          className="scroll-mt-2"
        >
          <BentoCard title="Error logs" subtitle="前端与 Rust 实时诊断" icon={Terminal} tier="fold">
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
        </section>

        <section data-system-drawer-section="storage" className="scroll-mt-2">
          <BentoCard
            title="Storage & backups"
            subtitle="快照清理与本地瘦身"
            icon={Database}
            tier="fold"
          >
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-slate-500">项目路径</span>
                <input
                  data-snapshot-path
                  value={snapshotPath}
                  onChange={(e) => setSnapshotPath(e.target.value)}
                  placeholder="如 D:/projects/my-app"
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-snapshot-list
                  onClick={() => void loadSnapshots(snapshotPath)}
                  className="flex h-7 items-center rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 hover:bg-white/[0.06]"
                >
                  <Database size={10} /> 查看快照
                </button>
                <label className="flex items-center gap-1 text-[9px] text-slate-500">
                  保留最近
                  <input
                    data-snapshot-keep
                    type="number"
                    min={0}
                    value={snapshotKeep}
                    onChange={(e) => setSnapshotKeep(e.target.value)}
                    className="h-7 w-14 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[10px] text-slate-300"
                  />
                </label>
                <button
                  type="button"
                  data-snapshot-prune
                  onClick={() => void pruneSnapshots()}
                  className="flex h-7 items-center gap-1 rounded-md bg-rose-500/15 px-2 text-[10px] text-rose-300 hover:bg-rose-500/25"
                >
                  🧹 清理快照
                </button>
              </div>
              <span data-snapshot-result className="block text-[9px] text-slate-500">
                {snapshotResult}
              </span>
              {snapshots.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {snapshots.slice(0, 20).map((s) => (
                    <div
                      key={s.backupId}
                      className="truncate rounded-md bg-white/[0.02] px-1.5 py-1 font-mono text-[9px] text-slate-500"
                      title={s.targetPath}
                    >
                      {s.backupId.slice(0, 24)} → {s.targetPath}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </BentoCard>
        </section>
      </div>
    </aside>
  );
}
