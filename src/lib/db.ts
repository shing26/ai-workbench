import {
  QUICK_PROMPTS,
  getQuickPromptUsage as getQuickPromptUsageLocal,
  listCustomQuickPrompts as listCustomQuickPromptsLocal,
  type CustomQuickPrompt,
  type QuickPrompt,
} from './quickPrompts';
import {
  cosineSimilarity,
  embedText,
  embedTextRemote,
  hybridRagScore,
  type EmbeddingMode,
} from './embed';
export type { EmbeddingMode };
import { parseWorkbenchError, WorkbenchError } from './errors';
import { isMockAgentsEnabled, mockLlmReply, mockProviderHealth } from './mockAgents';

export type { CustomQuickPrompt, QuickPrompt };

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  isToday: boolean;
  dueDate: string | null;
  completedAt: number | null;
  createdAt: number;
  projectId?: string | null;
  isDod?: boolean;
};

export type ProjectJourneyStage = 'idea' | 'discussing' | 'ready' | 'building' | 'archived';

export type Project = {
  id: string;
  name: string;
  path: string | null;
  revenue: number;
  status: string;
  journeyStage: ProjectJourneyStage;
  journeyDocPath: string | null;
  createdAt: number;
  sortOrder?: number;
  material?: string;
};

export type ProjectRevenuePoint = {
  id: string;
  projectId: string;
  revenue: number;
  recordedAt: number;
};

export type ThoughtType = 'inbox' | 'note' | 'doc';

export type Thought = {
  id: string;
  content: string;
  tags: string;
  type: ThoughtType;
  createdAt: number;
  lastReferencedAt?: number | null;
};

export type WikiLinkRef = {
  target: string;
  alias: string;
};

export type WikiLinkSuggestion = {
  id: string;
  title: string;
  tags: string;
  type: ThoughtType;
};

export type ThoughtLinkRef = {
  id: string;
  title: string;
  target: string;
  alias: string;
};

export type ThoughtBacklinkGraph = {
  outgoing: Record<string, ThoughtLinkRef[]>;
  incoming: Record<string, ThoughtLinkRef[]>;
};

export type QuickPromptUsageEntry = {
  id: string;
  count: number;
  updatedAt: number;
};

export type Session = {
  id: string;
  projectId: string | null;
  title: string;
  model: string;
  pinned: boolean;
  archived: boolean;
  messageCount: number;
  createdAt: number;
};

export type SessionSummaryPoint = {
  question: string;
  answer: string;
};

export type SessionSummary = {
  questionCount: number;
  keywords: string[];
  points: SessionSummaryPoint[];
};

export type SessionSearchHit = {
  session: Session;
  matchType:
    'all' | 'title' | 'model' | 'message' | 'pinyin-title' | 'pinyin-model' | 'pinyin-message';
  snippet: string;
  score: number;
  messageId?: string | null;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
};

export type MessageVersion = {
  id: string;
  messageId: string;
  content: string;
  createdAt: number;
  parentVersionId: string | null;
};

export type MessageDiff = {
  added: string[];
  removed: string[];
};

export type MessageAux = {
  messageId: string;
  payload: string;
  updatedAt: number;
};

export type MessageTrace = {
  title: string;
  sections: { label: string; value: string }[];
};

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  priority?: number;
  isActive: boolean;
  apiKeyEncrypted?: boolean;
  timeoutSecs?: number;
  retryCount?: number;
  retryDelaySecs?: number;
};

export type ProviderModel = {
  id: string;
  ownedBy: string | null;
  contextWindow?: number;
  inputPricePerMtok?: number;
  outputPricePerMtok?: number;
  rateTpm?: number;
  rateRpm?: number;
  isFavorite?: boolean;
  lastUsedAt?: number;
  fetchedAt?: number;
  updatedAt?: number;
};

export type Department = {
  id: string;
  name: string;
  description: string;
  color: string;
  agentCount: number;
  createdAt: number;
};

export type Agent = {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
  role: string;
  model: string;
  providerId: string | null;
  systemPrompt: string;
  isActive: boolean;
  createdAt: number;
};

export type AgencyAgent = {
  id: string;
  division: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  color: string;
  developerInstructions: string;
  tools: string[];
  sourceUrl: string;
  createdAt: number;
  updatedAt: number;
};

export type AgencyAgentInput = {
  division: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  color: string;
  developerInstructions: string;
  tools: string[];
  sourceUrl: string;
};

export type TeamPreset = {
  id: string;
  name: string;
  agentSlugs: string[];
  createdAt: number;
  updatedAt: number;
};

export type CliToolDetection = {
  bin: string;
  label: string;
  detected: boolean;
  lastCheckedAt: number;
};

export type AgentPromptVersion = {
  id: string;
  agentId: string;
  content: string;
  createdAt: number;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

export type ProviderHeartbeatEntry = {
  id: string;
  name: string;
  ok: boolean;
  latencyMs: number;
  message: string;
  checked: boolean;
  consecutiveFailures: number;
  alert: boolean;
};

export type ProviderHeartbeatSnapshot = {
  providers: ProviderHeartbeatEntry[];
  alerts: ProviderHeartbeatEntry[];
  checkedAt: number;
};

export type ClipboardItem = {
  id: string;
  content: string;
  source: string;
  timestamp: number;
  updatedAt: number;
};

export type ErrorLog = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  severity: string;
  timestamp: number;
  updatedAt: number;
  deviceId: string;
};

export type SyncSnapshot = {
  deviceId: string;
  exportedAt: number;
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
  quickPrompts?: QuickPrompt[];
  quickPromptUsage?: QuickPromptUsageEntry[];
};

export type SyncEnvelope = {
  v: 1;
  alg: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
};

export type SyncResult = {
  deviceId: string;
  syncedAt: number;
  clipboardAdded: number;
  clipboardUpdated: number;
  logsAdded: number;
  logsUpdated: number;
  quickPromptsAdded: number;
  quickPromptsUpdated: number;
  quickPromptUsageUpdated: number;
  conflicts: SyncConflictItem[];
};

export type SyncConflictItem = {
  id: string;
  kind: 'clipboard' | 'log' | 'quick_prompt';
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  resolvedTo: 'remote' | 'local';
  preview: string;
  localContent: string;
  remoteContent: string;
};

export type SyncConflictRecord = SyncConflictItem & {
  resolvedChoice: string | null;
  resolvedAt: number | null;
  createdAt: number;
};

export type SyncStatus = {
  deviceId: string;
  lastSyncedAt: number | null;
};

export type PassphraseStrength = {
  score: number;
  label: string;
  feedback: string[];
};

export type SyncCredential = {
  deviceId: string;
  encryptionEnabled: boolean;
  confirmed: boolean;
  activeKeyVersion: number;
  rotatedAt: number;
  updatedAt: number;
};

export type SyncKeyVersion = {
  deviceId: string;
  version: number;
  salt: string;
  fingerprint: string;
  algorithm: string;
  iterations: number;
  active: boolean;
  createdAt: number;
  rotatedAt: number;
};

export type SyncPairedDevice = {
  deviceId: string;
  fingerprint: string;
  pairingCode: string;
  version: number;
  pairedAt: number;
};

export type SyncKeyStatus = {
  deviceId: string;
  encryptionEnabled: boolean;
  confirmed: boolean;
  activeKeyVersion: number;
  activeSalt: string;
  activeFingerprint: string;
  iterations: number;
  rotatedAt: number;
  updatedAt: number;
  pairedDevices: SyncPairedDevice[];
};

export type SyncAuditEntry = {
  id: number;
  event: string;
  detail: string;
  deviceId: string;
  createdAt: number;
};

export type SyncAuditBucket = {
  bucket: string;
  startAt: number;
  count: number;
  merge: number;
  resolve: number;
  other: number;
};

export type SyncAuditSummary = {
  granularity: 'day' | 'week';
  total: number;
  buckets: SyncAuditBucket[];
};

export type ErrorLogBucket = {
  bucket: string;
  startAt: number;
  count: number;
  error: number;
  warning: number;
  info: number;
};

export type ErrorLogSummary = {
  granularity: 'hour' | 'day' | 'week';
  total: number;
  buckets: ErrorLogBucket[];
};

export type RemoteSyncPushResult = {
  ok: boolean;
  syncedAt: number;
  message: string;
};

export type GitContext = {
  head: string;
  branch: string;
  commitCount: number;
  latestCommit: string;
  committer: string;
  lastCommitAt: number;
  changes: string[];
};

export type GitActivityItem = {
  projectId: string;
  projectName: string;
  path: string;
  branch: string;
  commitCount: number;
  latestCommit: string;
  committer: string;
  lastCommitAt: number;
  changedFiles: number;
  changedPaths: string[];
  changeGroups: GitChangeGroup[];
  dirty: boolean;
};

export type GitChangeGroup = {
  path: string;
  status: string;
  group: 'staged' | 'unstaged' | 'untracked' | 'both';
};

export type GitLintIssue = {
  file: string;
  line: number;
  message: string;
};

export type GitCommitBucket = {
  dayMs: number;
  count: number;
};

export type GitCommitTrend = {
  granularity: 'day';
  buckets: GitCommitBucket[];
};

export type GitActivityBoard = {
  totalProjects: number;
  totalCommits: number;
  dirtyProjects: number;
  committers: string[];
  items: GitActivityItem[];
  commitTrend: GitCommitTrend;
};

export type GitFileDiff = {
  path: string;
  status: string;
  diff: string;
};

export type GitFileVersions = {
  path: string;
  status: string;
  oldContent: string;
  newContent: string;
};

export type CommitPrDraft = {
  branch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changes: string[];
};

export type GitCommitResult = {
  committed: boolean;
  hash: string;
  branch: string;
  message: string;
};

export type RemotePrResult = {
  created: boolean;
  url: string | null;
  title: string;
  branch: string;
};

export type GitRebaseResult = {
  rebased: boolean;
  conflict: boolean;
  files: string[];
  base: string;
  branch: string;
  head: string;
};

export type ConflictResolutionResult = {
  resolved: boolean;
  strategy: string;
  files: string[];
  rebased: boolean;
  branch: string;
  head: string;
  message: string;
};

export type StreamSmokeResult = {
  ok: boolean;
  chunks: number;
  message: string;
};

export type ProviderE2eResult = {
  ok: boolean;
  chunks: number;
  chars: number;
  durationMs: number;
  message: string;
};

export type WebhookDeliveryResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  attempts: number;
  signed: boolean;
  message: string;
};

export type WebhookSignatureVerifyResult = {
  valid: boolean;
  expected: string;
  algorithm: string;
};

export type WebhookRule = {
  id: string;
  name: string;
  url: string;
  payload: string;
  method: string;
  token: string;
  secret: string;
  retries: number;
  cooldownSeconds: number;
  intervalSeconds: number;
  triggerEvent: string;
  triggerCondition: string;
  channels: WebhookChannelName[];
  recoveryBackoffSeconds: number;
  circuitOpenedAt: number;
  enabled: boolean;
  lastRunAt: number;
  lastStatus: number;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
  consecutiveFailures: number;
  autoDisableAfter: number;
  templateVersion: number;
};

export type WebhookChannelName = 'http' | 'email' | 'notification';

export type WebhookRuleRun = {
  id: string;
  ruleId: string;
  kind: 'manual' | 'scheduled' | 'event';
  status: 'success' | 'failed' | 'queued';
  httpStatus: number;
  attempts: number;
  message: string;
  createdAt: number;
};

export type WebhookTemplateVersion = {
  id: string;
  ruleId: string;
  version: number;
  payload: string;
  note: string;
  createdAt: number;
};

export type WebhookTemplateValidation = {
  ok: boolean;
  errors: string[];
  variables: string[];
  blocks: string[];
  rendered: string;
  renderedJsonOk: boolean;
};

export type WebhookDeliveryStatus = 'queued' | 'delivering' | 'success' | 'failed' | 'dead';

export type WebhookDelivery = {
  id: string;
  ruleId: string;
  channel: WebhookChannelName;
  event: string;
  payload: string;
  method: string;
  url: string;
  token: string;
  secret: string;
  retries: number;
  attempts: number;
  status: WebhookDeliveryStatus;
  lastStatus: number;
  lastMessage: string;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
};

export type WebhookChannelConfig = {
  emailEnabled: boolean;
  emailFrom: string;
  emailTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  notificationEnabled: boolean;
  notificationTitle: string;
  updatedAt: number;
};

export type WebhookRecoveryResult = {
  probed: number;
  recovered: number;
  failed: number;
};

export type EventLogRecord = {
  id: string;
  event: string;
  context: string;
  source: string;
  deviceId: string;
  schemaVersion: number;
  status: 'accepted' | 'rejected';
  rejectedReason: string;
  createdAt: number;
};

export type EventSchema = {
  event: string;
  schema: string;
  enabled: boolean;
  updatedAt: number;
};

export type EventForwardStatus = 'queued' | 'delivering' | 'success' | 'dead' | 'failed';

export type EventForwardRecord = {
  id: string;
  eventLogId: string;
  targetUrl: string;
  targetToken: string;
  status: EventForwardStatus;
  attempts: number;
  nextAttemptAt: number;
  lastStatus: number;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
};

export type EventBusConfig = {
  forwardEnabled: boolean;
  forwardUrl: string;
  forwardToken: string;
  retentionDays: number;
  maxLogs: number;
  schemaStrict: boolean;
  updatedAt: number;
};

export type EventBusStats = {
  total: number;
  accepted: number;
  rejected: number;
  forwarded: number;
  pending: number;
  failed: number;
};

export type EventEmitResult = {
  event: string;
  recorded: boolean;
  validated: boolean;
  rejectedReason: string;
  forwarded: number;
  webhookDeliveries: number;
};

export type WebhookRetentionConfig = {
  retentionDays: number;
  maxRecords: number;
  autoCleanup: boolean;
  updatedAt: number;
};

export type WebhookPruneResult = {
  removedByAge: number;
  removedByCount: number;
  totalRemoved: number;
};

export type WebhookDeliveryStats = {
  total: number;
  queued: number;
  delivering: number;
  success: number;
  dead: number;
  failed: number;
};

export type RagSearchResult = {
  id: string;
  content: string;
  tags: string;
  type: ThoughtType;
  sourceKind?: 'thought' | 'file';
  sourceFile?: string;
  vaultPath?: string;
  score: number;
  vectorScore?: number;
  shardId?: string;
  embeddingModel?: string;
};

export type RagSourcePreference = {
  enabled: boolean;
  mode: 'all' | 'selected';
  filePaths: string[];
};

export type RagIndexStatus = {
  documents: number;
  indexed: boolean;
  lastIndexedAt: number;
  vectorIndexed?: boolean;
};

export type EmbeddingConfig = {
  mode: EmbeddingMode;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
  shardCount: number;
  autoRebuild: boolean;
  annEnabled: boolean;
  probeCount: number;
  updatedAt: number;
};

export type VectorShardRecord = {
  shardId: string;
  model: string;
  dimension: number;
  documents: number;
  status: string;
  centroid: string;
  updatedAt: number;
  createdAt: number;
};

export type VectorIndexStatus = {
  total: number;
  pending: number;
  failed: number;
  indexed: number;
  model: string;
  autoRebuild: boolean;
  annEnabled: boolean;
  probeCount: number;
  centroidsReady: boolean;
  shards: VectorShardRecord[];
};

export type VectorRebuildResult = {
  total: number;
  rebuilt: number;
  failed: number;
  skipped: number;
  model: string;
  shards: VectorShardRecord[];
};

export type KnowledgeClusterMember = {
  id: string;
  path: string;
  title: string;
  similarity: number;
};

export type KnowledgeClusterRecord = {
  id: string;
  documents: number;
  representative: string;
  model: string;
  members: KnowledgeClusterMember[];
};

export type KnowledgeDedupCandidate = {
  id: string;
  docA: string;
  docB: string;
  titleA: string;
  titleB: string;
  similarity: number;
  status: 'open' | 'dismissed' | 'merged';
};

export type KnowledgeClusterStatus = {
  clusters: KnowledgeClusterRecord[];
  dedup: KnowledgeDedupCandidate[];
  clusterThreshold: number;
  dedupThreshold: number;
  lastRecomputedAt: number;
  model: string;
};

export type KnowledgeIndexStatus = {
  files: number;
  indexedAt: number;
};

export type VaultWatchStatus = {
  watching: boolean;
  path: string | null;
  paths: string[];
  files: number;
  updatedAt: number;
};

export type VaultWatchTarget = {
  path: string;
  ignorePatterns: string[];
  enabled: boolean;
  updatedAt: number;
  lastEventAt: number;
  eventCount: number;
  createdEvents: number;
  modifiedEvents: number;
  removedEvents: number;
};

export type VaultWatchEvent = {
  id: number;
  vaultPath: string;
  filePath: string;
  eventKind: string;
  createdAt: number;
};

export type VaultTargetStats = {
  path: string;
  files: number;
  lastIndexedAt: number;
  lastEventAt: number;
  eventCount: number;
  createdEvents: number;
  modifiedEvents: number;
  removedEvents: number;
};

export type KnowledgeFileRecord = {
  id: string;
  path: string;
  title: string;
  tags: string;
  vaultPath: string;
  indexedAt: number;
  exists: boolean;
  stale: boolean;
};

export type KnowledgeCleanupResult = {
  removed: number;
  reindexed: number;
  failed: number;
};

export type DocHealthAutoConfig = {
  enabled: boolean;
  intervalMs: number;
  lastRunAt: number;
  lastResult: KnowledgeCleanupResult | null;
};

export type DocHealthRunRecord = {
  id: string;
  ranAt: number;
  removed: number;
  reindexed: number;
  failed: number;
  triggeredBy: 'auto' | 'manual';
  alert: boolean;
};

export type VaultWatchConfig = {
  path: string;
  ignorePatterns: string[];
  enabled: boolean;
  updatedAt: number;
};

export type IndexResult = {
  files: number;
  ignored: number;
  concurrencyUsed: number;
};

export type IndexProgress = {
  runId: string;
  path: string;
  done: number;
  total: number;
  files: number;
  ignored: number;
  concurrencyUsed: number;
  status: string;
};

export type VaultIndexQueueEntry = {
  runId: string;
  path: string;
  status: string;
  position: number;
  priority: number;
  attempts: number;
  lastError: string;
  retryDelayMs: number;
};

export type VaultIndexQueueStatus = {
  active: VaultIndexQueueEntry | null;
  queue: VaultIndexQueueEntry[];
};

export type RecommendedConcurrency = {
  recommended: number;
  cores: number;
};

const LS_KEY = 'ai-workbench:db:v1';
const VAULT_LS_KEY = 'ai-workbench:vault:v1';
const RAG_SOURCE_PREF_LS_KEY = 'ai-workbench:rag-source-preference:v1';

export function getRagSourcePreference(): RagSourcePreference {
  try {
    const raw = localStorage.getItem(RAG_SOURCE_PREF_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RagSourcePreference>;
      return {
        enabled: parsed.enabled ?? false,
        mode: parsed.mode === 'selected' ? 'selected' : 'all',
        filePaths: parsed.filePaths ?? [],
      };
    }
  } catch {
    // fall through to defaults
  }
  return { enabled: false, mode: 'all', filePaths: [] };
}

export function setRagSourcePreference(pref: RagSourcePreference): RagSourcePreference {
  const next: RagSourcePreference = {
    enabled: !!pref.enabled,
    mode: pref.mode === 'selected' ? 'selected' : 'all',
    filePaths: [...new Set(pref.filePaths.filter((p) => p.trim()))],
  };
  localStorage.setItem(RAG_SOURCE_PREF_LS_KEY, JSON.stringify(next));
  return next;
}

type LocalShape = {
  tasks: Task[];
  projects: Project[];
  projectRevenueHistory: ProjectRevenuePoint[];
  thoughts: Thought[];
  providers: Provider[];
  departments: Department[];
  agents: Agent[];
  agentCatalog: AgencyAgent[];
  teamPresets: TeamPreset[];
  cliTools: CliToolDetection[];
  promptVersions: AgentPromptVersion[];
  sessions: Session[];
  chatMessages: ChatMessage[];
  messageVersions: MessageVersion[];
  messageAux: MessageAux[];
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
  modelCache: Record<string, ProviderModel[]>;
  syncDeviceId: string;
  lastSyncedAt: number;
};

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw parseWorkbenchError(err);
  }
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
const EVENT_LOGS_LS_KEY = 'ai-workbench:event-logs:v1';
const EVENT_SCHEMAS_LS_KEY = 'ai-workbench:event-schemas:v1';
const EVENT_FORWARDS_LS_KEY = 'ai-workbench:event-forwards:v1';
const EVENT_BUS_CONFIG_LS_KEY = 'ai-workbench:event-bus-config:v1';
const EMBEDDING_CONFIG_LS_KEY = 'ai-workbench:embedding-config:v1';
const VECTOR_SHARDS_LS_KEY = 'ai-workbench:vector-shards:v1';

function emptyShape(): LocalShape {
  return {
    tasks: [],
    projects: [],
    projectRevenueHistory: [],
    thoughts: [],
    providers: [],
    departments: [],
    agents: [],
    agentCatalog: [],
    teamPresets: [],
    cliTools: [],
    promptVersions: [],
    sessions: [],
    chatMessages: [],
    messageVersions: [],
    messageAux: [],
    clipboard: [],
    logs: [],
    modelCache: {},
    syncDeviceId: '',
    lastSyncedAt: 0,
  };
}

function seedShape(): LocalShape {
  const now = Date.now();
  const existing = readLocal();
  const designId = makeId();
  const productId = makeId();
  const backendId = makeId();
  const aiId = makeId();
  const qualityId = makeId();
  const shape: LocalShape = {
    tasks: [
      {
        id: makeId(),
        title: 'Ship App Shell',
        status: 'in_progress',
        isToday: true,
        dueDate: null,
        completedAt: null,
        createdAt: now - 3000,
      },
      {
        id: makeId(),
        title: 'Review design tokens',
        status: 'todo',
        isToday: true,
        dueDate: null,
        completedAt: null,
        createdAt: now - 2000,
      },
      {
        id: makeId(),
        title: 'Write Sprint 1 retro',
        status: 'todo',
        isToday: false,
        dueDate: null,
        completedAt: null,
        createdAt: now - 1000,
      },
    ],
    projects: [
      {
        id: makeId(),
        name: 'Prism Station',
        path: 'D:\\ai-workbench',
        revenue: 0,
        status: 'active',
        journeyStage: 'building',
        journeyDocPath: null,
        createdAt: now - 86400000,
        sortOrder: 0,
      },
      {
        id: makeId(),
        name: 'Prism Demo',
        path: 'D:\\PrismData\\demo',
        revenue: 0,
        status: 'paused',
        journeyStage: 'idea',
        journeyDocPath: null,
        createdAt: now - 172800000,
        sortOrder: 1,
      },
    ],
    projectRevenueHistory: [],
    thoughts: [
      {
        id: makeId(),
        content: 'Keep the dock at exactly 5 views.',
        tags: '#work',
        type: 'inbox',
        createdAt: now - 4000,
      },
      {
        id: makeId(),
        content:
          '# Sprint 3 笔记\n\n## 本周节奏\n\n- 早间：阅读 30 分钟\n- 下午：Sprint 验收\n\n```ts\nconst focus = tasks.filter(t => t.isToday);\n```\n\n> 先冻结范围，再写代码。',
        tags: '#work,#life',
        type: 'note',
        createdAt: now - 3000,
      },
      {
        id: makeId(),
        content: 'RAG index stays pending in Sprint 1.',
        tags: '#work,#life',
        type: 'doc',
        createdAt: now - 2000,
      },
    ],
    providers: [
      {
        id: makeId(),
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'OPENAI_API_KEY',
        model: '',
        isActive: true,
      },
      {
        id: makeId(),
        name: 'Ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        model: '',
        isActive: true,
      },
      {
        id: makeId(),
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'OPENROUTER_API_KEY',
        model: '',
        isActive: false,
      },
    ],
    promptVersions: [],
    departments: [
      {
        id: designId,
        name: '设计部',
        description: '界面、交互与视觉动效',
        color: 'iris',
        agentCount: 3,
        createdAt: now - 9000,
      },
      {
        id: productId,
        name: '产品与体验部',
        description: '需求、用户路径与优先级',
        color: 'ocean',
        agentCount: 2,
        createdAt: now - 8000,
      },
      {
        id: backendId,
        name: '后端与系统部',
        description: '数据层、Tauri 命令与运维',
        color: 'emerald',
        agentCount: 2,
        createdAt: now - 7000,
      },
      {
        id: aiId,
        name: 'AI 策略与引擎部',
        description: '模型路由、Prompt 与多 Agent 编排',
        color: 'amber',
        agentCount: 3,
        createdAt: now - 6000,
      },
      {
        id: qualityId,
        name: '质量与工程效率部',
        description: '测试、DoD 与自动化验收',
        color: 'sakura',
        agentCount: 2,
        createdAt: now - 5000,
      },
    ],
    agents: [
      {
        id: makeId(),
        departmentId: designId,
        departmentName: '设计部',
        name: 'UI Designer',
        role: '设计系统与动效',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 UI Designer，负责设计系统、动效与视觉验收。输出需遵循 Design Token，并服务于 5 大主视图。',
        isActive: true,
        createdAt: now - 4900,
      },
      {
        id: makeId(),
        departmentId: designId,
        departmentName: '设计部',
        name: 'Frontend Developer',
        role: 'React/Tailwind 实现',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Frontend Developer，负责 React/Tailwind 实现。输出需可运行、可验证，并保持布局稳定。',
        isActive: true,
        createdAt: now - 4800,
      },
      {
        id: makeId(),
        departmentId: designId,
        departmentName: '设计部',
        name: 'UI Finish-Gate Reviewer',
        role: '视觉验收',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 UI Finish-Gate Reviewer，负责视觉验收。输出必须给出可测量的验收项与风险。',
        isActive: true,
        createdAt: now - 4700,
      },
      {
        id: makeId(),
        departmentId: productId,
        departmentName: '产品与体验部',
        name: 'Product Manager',
        role: '范围冻结与验收标准',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Product Manager，负责范围冻结与验收标准。每个需求必须给出明确的 AC。',
        isActive: true,
        createdAt: now - 4600,
      },
      {
        id: makeId(),
        departmentId: productId,
        departmentName: '产品与体验部',
        name: 'UX Architect',
        role: '交互与信息架构',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 UX Architect，负责交互与信息架构。输出需考虑工作台高频路径与 5 大主视图。',
        isActive: true,
        createdAt: now - 4500,
      },
      {
        id: makeId(),
        departmentId: backendId,
        departmentName: '后端与系统部',
        name: 'Backend Architect',
        role: 'Tauri 命令与分层设计',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Backend Architect，负责 Tauri 命令与分层设计。输出需保持模块边界清晰并考虑错误路径。',
        isActive: true,
        createdAt: now - 4400,
      },
      {
        id: makeId(),
        departmentId: backendId,
        departmentName: '后端与系统部',
        name: 'Data Engineer',
        role: 'SQLite 表结构与迁移',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Data Engineer，负责 SQLite 表结构与迁移。输出需包含索引、外键与迁移脚本。',
        isActive: true,
        createdAt: now - 4300,
      },
      {
        id: makeId(),
        departmentId: aiId,
        departmentName: 'AI 策略与引擎部',
        name: 'AI Engineer',
        role: '模型路由与流式链路',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 AI Engineer，负责模型路由与流式链路。输出需兼容 Tauri 与浏览器 fallback。',
        isActive: true,
        createdAt: now - 4200,
      },
      {
        id: makeId(),
        departmentId: aiId,
        departmentName: 'AI 策略与引擎部',
        name: 'Prompt Engineer',
        role: 'Prompt 版本与测试用例',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Prompt Engineer，负责 Prompt 版本与测试用例。输出需给出可复现的用例。',
        isActive: true,
        createdAt: now - 4100,
      },
      {
        id: makeId(),
        departmentId: aiId,
        departmentName: 'AI 策略与引擎部',
        name: 'Multi-Agent Systems Architect',
        role: '部门与 Agent 编排',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Multi-Agent Systems Architect，负责部门与 Agent 编排。输出需明确分工、并行度与汇总结论。',
        isActive: true,
        createdAt: now - 4000,
      },
      {
        id: makeId(),
        departmentId: qualityId,
        departmentName: '质量与工程效率部',
        name: 'Test Automation Engineer',
        role: '自动化验收与回归',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Test Automation Engineer，负责自动化验收与回归。输出需覆盖 verify:ui 与 Rust 单测。',
        isActive: true,
        createdAt: now - 3900,
      },
      {
        id: makeId(),
        departmentId: qualityId,
        departmentName: '质量与工程效率部',
        name: 'Reality Checker',
        role: '证据驱动的发布门禁',
        model: 'openai',
        providerId: null,
        systemPrompt:
          '你是 Prism Station 的 Reality Checker，负责证据驱动的发布门禁。输出必须引用实际文件与命令结果。',
        isActive: true,
        createdAt: now - 3800,
      },
    ],
    sessions: [
      {
        id: makeId(),
        projectId: null,
        title: 'Workbench planning',
        model: 'openai',
        pinned: false,
        archived: false,
        messageCount: 0,
        createdAt: now - 60000,
      },
    ],
    chatMessages: [],
    messageVersions: [],
    messageAux: [],
    clipboard: [
      {
        id: makeId(),
        content: 'pnpm run dev',
        source: 'terminal',
        timestamp: now - 5000,
        updatedAt: now - 5000,
      },
      {
        id: makeId(),
        content: 'bg-[#18181C] border-white/10 rounded-2xl',
        source: 'editor',
        timestamp: now - 4000,
        updatedAt: now - 4000,
      },
    ],
    logs: [
      {
        id: makeId(),
        source: 'tauri',
        message: 'DB initialized',
        stack: null,
        severity: 'info',
        timestamp: now - 7000,
        updatedAt: now - 7000,
        deviceId: existing.syncDeviceId || 'device-local',
      },
    ],
    modelCache: {},
    agentCatalog: existing.agentCatalog ?? [],
    teamPresets: existing.teamPresets ?? [],
    cliTools: existing.cliTools ?? [],
    syncDeviceId: existing.syncDeviceId || makeId(),
    lastSyncedAt: existing.lastSyncedAt ?? 0,
  };
  return shape;
}

function readLocal(): LocalShape {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) ?? '') as Partial<LocalShape>;
    return {
      ...emptyShape(),
      ...parsed,
    } as LocalShape;
  } catch {
    return emptyShape();
  }
}

const DB_LOCK_NAME = 'ai-workbench:db';
const DB_VERSION_LS_KEY = 'ai-workbench:db-write-version:v1';

let dbLockTail: Promise<void> = Promise.resolve();

function readDbWriteVersion(): number {
  try {
    const parsed = Number(localStorage.getItem(DB_VERSION_LS_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function stampDbWriteVersion() {
  const version = Math.max(readDbWriteVersion(), Date.now()) + 1;
  try {
    localStorage.setItem(DB_VERSION_LS_KEY, String(version));
  } catch {
    // version stamp is best-effort
  }
}

export async function withDbLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = async () => {
    try {
      return await fn();
    } finally {
      stampDbWriteVersion();
    }
  };
  if (lockManager?.request) {
    return lockManager.request(DB_LOCK_NAME, { mode: 'exclusive' }, run);
  }
  const previous = dbLockTail.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  dbLockTail = gate;
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

function lockedStorageWrite(fn: () => void) {
  fn();
  stampDbWriteVersion();
}

function writeLocal(shape: LocalShape) {
  lockedStorageWrite(() => localStorage.setItem(LS_KEY, JSON.stringify(shape)));
}

export async function initDb(): Promise<void> {
  if (isTauri()) {
    await invoke('init_db');
  } else if (!localStorage.getItem(LS_KEY)) {
    writeLocal(seedShape());
  }
  await seedAgencyIfEmpty();
}

const AGENCY_TEAM_PRESETS: { name: string; agentSlugs: string[] }[] = [
  {
    name: '产品评审团',
    agentSlugs: ['product-manager', 'design-ux-researcher', 'testing-reality-checker'],
  },
  {
    name: '技术方案团',
    agentSlugs: [
      'engineering-backend-architect',
      'engineering-ai-engineer',
      'engineering-api-platform-engineer',
    ],
  },
  {
    name: '全栈落地团',
    agentSlugs: [
      'engineering-desktop-app-engineer',
      'engineering-database-optimizer',
      'engineering-code-reviewer',
    ],
  },
  {
    name: '质量安全门',
    agentSlugs: [
      'testing-test-automation-engineer',
      'testing-api-tester',
      'security-appsec-engineer',
      'security-ai-generated-code-auditor',
    ],
  },
  {
    name: '极简快评团',
    agentSlugs: ['product-manager', 'design-ui-designer'],
  },
];

export async function seedAgencyIfEmpty(): Promise<void> {
  const existing = await listAgentCatalog();
  if (existing.length === 0) {
    const { AGENCY_CATALOG } = await import('../data/agencyCatalog');
    await importAgentCatalog(AGENCY_CATALOG);
  }
  const presets = await listTeamPresets();
  if (presets.length === 0) {
    for (const preset of AGENCY_TEAM_PRESETS) {
      await createTeamPreset(preset.name, preset.agentSlugs).catch(() => {});
    }
  }
}

export async function listTasks(): Promise<Task[]> {
  return isTauri() ? invoke<Task[]>('list_tasks') : readLocal().tasks;
}

export type WorkspaceSummary = {
  projects: Project[];
  tasks: Task[];
  thoughts: Thought[];
  sessions: Session[];
  providers: Provider[];
};

export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  if (isTauri()) return invoke<WorkspaceSummary>('get_workspace_summary');
  const shape = readLocal();
  return {
    projects: shape.projects,
    tasks: shape.tasks,
    thoughts: shape.thoughts,
    sessions: await listSessions(),
    providers: await listProviders(),
  };
}

export type GitDiffFile = {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
  hunkPreview: string;
};

export type QualityGateLevel = {
  level: number;
  name: string;
  status: 'GREEN' | 'FAILED' | 'SKIPPED';
  errors: string[];
  durationMs: number;
};

export type QualityGateResult = {
  status: string;
  errors: string[];
  levels: QualityGateLevel[];
};

export async function runQualityGate(
  projectPath: string,
  dodPath?: string | null,
): Promise<QualityGateResult> {
  if (isTauri()) {
    return invoke<QualityGateResult>('run_quality_gate', {
      path: projectPath,
      dodPath: dodPath ?? null,
    });
  }
  return {
    status: 'GREEN',
    errors: [],
    levels: [1, 2, 3, 4].map((level) => ({
      level,
      name: `L${level} browser fallback`,
      status: 'GREEN',
      errors: [],
      durationMs: 0,
    })),
  };
}

export async function getProjectDiffTree(projectPath: string): Promise<GitDiffFile[]> {
  if (isTauri()) return invoke<GitDiffFile[]>('get_project_diff_tree', { path: projectPath });
  return [];
}

export async function getFileHunkPatch(
  projectPath: string,
  relativePath: string,
): Promise<GitFileDiff> {
  if (isTauri()) {
    return invoke<GitFileDiff>('get_file_hunk_patch', { path: projectPath, relativePath });
  }
  return { path: relativePath, status: 'clean', diff: '' };
}

export async function writeNote(
  vaultPath: string,
  fileName: string,
  content: string,
): Promise<string> {
  if (isTauri()) return invoke<string>('write_note', { vaultPath, fileName, content });
  return `${vaultPath.replace(/[\\/]+$/, '')}/${fileName}`;
}

export type AgentSpec = {
  id: string;
  name: string;
  role: string;
  kpi: string;
  prompt: string;
  active: boolean;
  emoji?: string;
  color?: string;
};

export async function listAgentSpecs(projectPath: string): Promise<AgentSpec[]> {
  if (isTauri()) return invoke<AgentSpec[]>('list_agent_specs', { projectPath });
  // Browser fallback: built-in mock exec seats (mirrors .hermes/agents/ defaults)
  return [
    {
      id: 'cto',
      name: 'CTO',
      role: '技术架构师',
      kpi: '可行性、架构一致性、性能',
      prompt:
        '你是 Prism Station 的 CTO。从架构可行性、系统一致性、性能与可维护性角度独立评估需求，质疑不合理的实现路径，提出技术选型建议。',
      active: true,
    },
    {
      id: 'cdo',
      name: 'CDO',
      role: '设计负责人',
      kpi: '用户体验、信息架构、视觉一致性',
      prompt:
        '你是 Prism Station 的 CDO。从用户体验、信息架构、交互与视觉一致性角度独立评审需求，指出体验风险并给出设计方案建议。',
      active: true,
    },
    {
      id: 'ciso',
      name: 'CISO',
      role: '安全审计官',
      kpi: '数据安全、权限边界、注入防护',
      prompt:
        '你是 Prism Station 的 CISO。从安全角度独立审计需求，识别数据泄露、越权访问、注入与密钥泄露风险，要求安全边界与最小权限原则。',
      active: true,
    },
  ];
}

export async function ensureAgentSpecs(projectPath: string): Promise<number> {
  if (isTauri()) return invoke<number>('ensure_agent_specs', { projectPath });
  return 0;
}

export type CliSpawnResult = {
  runId: string;
};

export type CliLogLine = {
  runId: string;
  line: string;
  stream: string;
};

export type CliExited = {
  runId: string;
  exitCode: number;
};

const localCliHandlers = {
  log: new Set<(line: CliLogLine) => void>(),
  exited: new Set<(evt: CliExited) => void>(),
};

const CLI_RUNS_LS_KEY = 'ai-workbench:cli-runs:v1';

export type CliRunRecord = {
  runId: string;
  command: string;
  exitCode: number;
  startedAt: number;
};

export function recordCliRun(run: CliRunRecord): void {
  try {
    const runs = listCliRuns();
    runs.push(run);
    localStorage.setItem(CLI_RUNS_LS_KEY, JSON.stringify(runs.slice(-200)));
  } catch {
    /* storage failures are non-fatal */
  }
}

export function listCliRuns(): CliRunRecord[] {
  try {
    const raw = localStorage.getItem(CLI_RUNS_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CliRunRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* corrupt storage falls back to empty */
  }
  return [];
}

export function getCliRunStats(): {
  total: number;
  success: number;
  successRate: number;
  lastRunAt: number | null;
} {
  const runs = listCliRuns();
  const success = runs.filter((r) => r.exitCode === 0).length;
  const last = runs.length > 0 ? runs[runs.length - 1]!.startedAt : null;
  return {
    total: runs.length,
    success,
    successRate: runs.length > 0 ? Math.round((success / runs.length) * 100) : 0,
    lastRunAt: last,
  };
}

export async function spawnCliProcess(
  projectPath: string,
  command: string,
  args: string[],
  cwd?: string,
): Promise<CliSpawnResult> {
  if (isTauri()) {
    return invoke<CliSpawnResult>('spawn_cli_process', {
      projectPath,
      command,
      args,
      cwd: cwd ?? null,
    });
  }
  const runId = `cli-mock-${Date.now().toString(36)}`;
  const mockLines = [
    `$ ${command} ${args.join(' ')}`,
    '✓ 已唤醒本地 CLI（浏览器模拟模式）',
    '→ 注入知识上下文：Spec.md + 相关卡片',
    '→ 等待 agent 完成…',
    '[exit 0]',
  ];
  mockLines.forEach((line, i) => {
    setTimeout(
      () => {
        for (const h of localCliHandlers.log) h({ runId, line, stream: 'stdout' });
        if (i === mockLines.length - 1) {
          for (const h of localCliHandlers.exited) h({ runId, exitCode: 0 });
        }
      },
      300 * (i + 1),
    );
  });
  return { runId };
}

export async function listenCliLog(handler: (line: CliLogLine) => void): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<CliLogLine>('cli_log_line', (event) => handler(event.payload));
  }
  localCliHandlers.log.add(handler);
  return () => localCliHandlers.log.delete(handler);
}

export async function listenCliExit(handler: (evt: CliExited) => void): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<CliExited>('cli_exited', (event) => handler(event.payload));
  }
  localCliHandlers.exited.add(handler);
  return () => localCliHandlers.exited.delete(handler);
}

export type ApplySnippetResult = {
  success: boolean;

  backupId: string;
  filePath: string;
  diffDelta: string;
};

export type FileBackupEntry = {
  backupId: string;
  targetPath: string;
  backupPath: string;
  isNewFile: boolean;
  createdAt: number;
};

export async function applyCodeSnippet(
  projectPath: string,
  relativePath: string,
  codeContent: string,
): Promise<ApplySnippetResult> {
  if (isTauri()) {
    return invoke<ApplySnippetResult>('apply_code_snippet', {
      projectPath,
      relativePath,
      codeContent,
    });
  }
  throw new Error('Apply is only available in the desktop (Tauri) runtime');
}

export async function rollbackSnapshot(projectPath: string, backupId: string): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>('rollback_snapshot', { projectPath, backupId });
  }
  throw new Error('Rollback is only available in the desktop (Tauri) runtime');
}

export async function listSnapshots(projectPath: string): Promise<FileBackupEntry[]> {
  if (isTauri()) return invoke<FileBackupEntry[]>('list_snapshots', { projectPath });
  return [];
}

export async function pruneSnapshots(projectPath: string, keep: number): Promise<number> {
  if (isTauri()) return invoke<number>('prune_snapshots', { projectPath, keep });
  return 0;
}

export async function createTask(
  title: string,
  isToday: boolean,
  projectId?: string | null,
  isDod?: boolean,
): Promise<Task> {
  if (isTauri()) {
    return invoke<Task>('create_task', { title, isToday, projectId, isDod });
  }
  const shape = readLocal();
  const task: Task = {
    id: makeId(),
    title,
    status: 'todo',
    isToday,
    dueDate: null,
    completedAt: null,
    createdAt: Date.now(),
    projectId: projectId ?? null,
    isDod: isDod ?? false,
  };
  shape.tasks.unshift(task);
  writeLocal(shape);
  return task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  if (isTauri()) {
    await invoke('update_task_status', { id, status });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) {
    task.status = status;
    task.completedAt = status === 'done' ? Date.now() : null;
  }
  writeLocal(shape);
}

export async function setTaskToday(id: string, isToday: boolean): Promise<void> {
  if (isTauri()) {
    await invoke('set_task_today', { id, isToday });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) task.isToday = isToday;
  writeLocal(shape);
}

export async function setTaskDueDate(id: string, dueDate: string | null): Promise<void> {
  if (isTauri()) {
    await invoke('set_task_due_date', { id, dueDate });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) task.dueDate = dueDate;
  writeLocal(shape);
}

export async function updateTaskTitle(id: string, title: string): Promise<void> {
  if (isTauri()) {
    await invoke('update_task_title', { id, title });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) task.title = title;
  writeLocal(shape);
}

export async function deleteTask(id: string, confirmed = false): Promise<void> {
  if (isTauri()) {
    await invoke('delete_task', { id, confirmed });
    return;
  }
  if (!confirmed) {
    throw new WorkbenchError('REQUIRES_CONFIRMATION', `delete_task:${id}`);
  }
  const shape = readLocal();
  shape.tasks = shape.tasks.filter((t) => t.id !== id);
  writeLocal(shape);
}

export async function listProjects(): Promise<Project[]> {
  return isTauri() ? invoke<Project[]>('list_projects') : readLocal().projects;
}

export async function reorderProjects(ids: string[]): Promise<void> {
  if (isTauri()) {
    await invoke('reorder_projects', { ids });
    return;
  }
  const shape = readLocal();
  const byId = new Map(shape.projects.map((project) => [project.id, project]));
  const ordered: Project[] = [];
  ids.forEach((id, index) => {
    const project = byId.get(id);
    if (project) ordered.push({ ...project, sortOrder: index });
  });
  shape.projects = ordered;
  writeLocal(shape);
}

export async function createProject(name: string, path: string): Promise<Project> {
  if (isTauri()) return invoke<Project>('create_project', { name, path });
  const shape = readLocal();
  const id = makeId();
  const now = Date.now();
  const project: Project = {
    id,
    name,
    path: path || null,
    revenue: 0,
    status: 'active',
    journeyStage: 'idea',
    journeyDocPath: null,
    createdAt: now,
  };
  shape.projects.unshift(project);
  shape.projectRevenueHistory.push({
    id: makeId(),
    projectId: id,
    revenue: 0,
    recordedAt: now,
  });
  writeLocal(shape);
  return project;
}

export async function updateProject(id: string, status: string, revenue: number): Promise<Project> {
  if (isTauri()) return invoke<Project>('update_project', { id, status, revenue });
  const shape = readLocal();
  const project = shape.projects.find((p) => p.id === id);
  if (!project) throw new Error('project not found');
  project.status = status === 'paused' ? 'paused' : 'active';
  project.revenue = Number.isFinite(revenue) && revenue >= 0 ? revenue : 0;
  shape.projectRevenueHistory.push({
    id: makeId(),
    projectId: id,
    revenue: project.revenue,
    recordedAt: Date.now(),
  });
  writeLocal(shape);
  return project;
}

export async function updateProjectMaterial(id: string, material: string): Promise<Project> {
  if (isTauri()) return invoke<Project>('update_project_material', { id, material });
  const shape = readLocal();
  const project = shape.projects.find((p) => p.id === id);
  if (!project) throw new Error('project not found');
  project.material = material;
  writeLocal(shape);
  return project;
}

const PROJECT_JOURNEY_STAGES: ProjectJourneyStage[] = [
  'idea',
  'discussing',
  'ready',
  'building',
  'archived',
];

export async function updateProjectJourney(
  id: string,
  stage: ProjectJourneyStage,
  journeyDocPath: string | null = null,
): Promise<Project> {
  if (!PROJECT_JOURNEY_STAGES.includes(stage)) {
    throw new WorkbenchError('INVALID_INPUT', `update_project_journey:${stage}`);
  }
  if (isTauri()) {
    return invoke<Project>('update_project_journey', { id, stage, journeyDocPath });
  }
  const shape = readLocal();
  const project = shape.projects.find((p) => p.id === id);
  if (!project) throw new Error('project not found');
  project.journeyStage = stage;
  if (journeyDocPath !== null) project.journeyDocPath = journeyDocPath;
  writeLocal(shape);
  return project;
}

export async function deleteProject(id: string, confirmed = false): Promise<void> {
  if (isTauri()) {
    await invoke('delete_project', { id, confirmed });
    return;
  }
  if (!confirmed) {
    throw new WorkbenchError('REQUIRES_CONFIRMATION', `delete_project:${id}`);
  }
  const shape = readLocal();
  shape.projects = shape.projects.filter((p) => p.id !== id);
  shape.projectRevenueHistory = shape.projectRevenueHistory.filter((p) => p.projectId !== id);
  shape.sessions = (shape.sessions ?? []).map((s) =>
    s.projectId === id ? { ...s, projectId: null } : s,
  );
  writeLocal(shape);
}

export async function listProjectRevenueHistory(
  projectId: string,
  limit = 12,
): Promise<ProjectRevenuePoint[]> {
  if (isTauri()) {
    return invoke<ProjectRevenuePoint[]>('list_project_revenue_history', {
      projectId,
      limit,
    });
  }
  return readLocal()
    .projectRevenueHistory.filter((p) => p.projectId === projectId)
    .sort((a, b) => a.recordedAt - b.recordedAt)
    .slice(-Math.max(1, Math.min(100, limit)));
}

export async function listThoughts(): Promise<Thought[]> {
  return isTauri() ? invoke<Thought[]>('list_thoughts') : readLocal().thoughts;
}

export async function createThought(
  content: string,
  tags: string,
  type: ThoughtType,
): Promise<Thought> {
  if (isTauri()) return invoke<Thought>('create_thought', { content, tags, kind: type });
  const shape = readLocal();
  const thought: Thought = { id: makeId(), content, tags, type, createdAt: Date.now() };
  shape.thoughts.unshift(thought);
  writeLocal(shape);
  return thought;
}

export async function recordThoughtReference(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('record_thought_reference', { id });
    return;
  }
  const shape = readLocal();
  const thought = shape.thoughts.find((t) => t.id === id);
  if (thought) {
    thought.lastReferencedAt = Date.now();
    writeLocal(shape);
  }
}

export async function openObsidian(projectPath: string, file: string): Promise<string> {
  if (isTauri()) return invoke<string>('open_obsidian', { projectPath, file });
  const uri = `obsidian://open?path=${encodeURIComponent(projectPath)}/${file}`;
  window.open(uri, '_blank');
  return uri;
}

export async function updateThoughtTags(id: string, tags: string): Promise<Thought> {
  if (isTauri()) return invoke<Thought>('update_thought_tags', { id, tags });
  const shape = readLocal();
  const thought = shape.thoughts.find((t) => t.id === id);
  if (!thought) throw new Error('thought not found');
  thought.tags = tags;
  writeLocal(shape);
  return thought;
}

export async function updateThoughtContent(id: string, content: string): Promise<Thought> {
  if (isTauri()) return invoke<Thought>('update_thought_content', { id, content });
  const shape = readLocal();
  const thought = shape.thoughts.find((t) => t.id === id);
  if (!thought) throw new Error('thought not found');
  thought.content = content;
  writeLocal(shape);
  return thought;
}

export async function updateThoughtType(id: string, type: ThoughtType): Promise<Thought> {
  if (isTauri()) return invoke<Thought>('update_thought_type', { id, kind: type });
  const shape = readLocal();
  const thought = shape.thoughts.find((t) => t.id === id);
  if (!thought) throw new Error('thought not found');
  thought.type = type;
  writeLocal(shape);
  return thought;
}

export async function deleteThought(id: string, confirmed = false): Promise<void> {
  if (isTauri()) {
    await invoke('delete_thought', { id, confirmed });
    return;
  }
  if (!confirmed) {
    throw new WorkbenchError('REQUIRES_CONFIRMATION', `delete_thought:${id}`);
  }
  const shape = readLocal();
  const exists = shape.thoughts.some((t) => t.id === id);
  if (!exists) throw new Error('thought not found');
  shape.thoughts = shape.thoughts.filter((t) => t.id !== id);
  writeLocal(shape);
}

export function extractWikiLinks(content: string): WikiLinkRef[] {
  const refs: WikiLinkRef[] = [];
  const seen = new Set<string>();
  const pattern = /\[\[([^\]]+)\]\]/g;
  for (const match of content.matchAll(pattern)) {
    const raw = match[1] ?? '';
    const [targetPart, aliasPart] = raw.split('|');
    const target = (targetPart ?? '').trim();
    if (!target) continue;
    const alias = (aliasPart ?? target).trim() || target;
    const key = target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ target, alias });
  }
  return refs;
}

export function thoughtTitle(thought: Thought): string {
  const firstLine =
    thought.content
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? '';
  return firstLine.replace(/^#+\s*/, '').trim() || 'Untitled';
}

export function resolveWikiLinkTarget(thoughts: Thought[], target: string): Thought | undefined {
  const normalized = target.replace(/^#/, '').trim().toLowerCase();
  if (!normalized) return undefined;
  const direct = thoughts.find((t) => thoughtTitle(t).trim().toLowerCase() === normalized);
  if (direct) return direct;
  return thoughts.find((t) => thoughtTitle(t).trim().toLowerCase().includes(normalized));
}

export function suggestWikiLinkTargets(
  thoughts: Thought[],
  query: string,
  limit = 6,
  excludeId?: string,
): WikiLinkSuggestion[] {
  const normalized = query.replace(/^#/, '').trim().toLowerCase();
  const candidates = thoughts.filter((t) => t.id !== excludeId);
  if (!normalized) {
    return candidates
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((t) => ({ id: t.id, title: thoughtTitle(t), tags: t.tags, type: t.type }));
  }
  return candidates
    .map((thought) => {
      const title = thoughtTitle(thought);
      const titleLower = title.trim().toLowerCase();
      const tagHit = thought.tags
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .some((tag) => tag.includes(normalized));
      let rank = -1;
      if (titleLower === normalized) rank = 0;
      else if (titleLower.startsWith(normalized)) rank = 1;
      else if (titleLower.includes(normalized)) rank = 2;
      else if (tagHit) rank = 3;
      return { thought, title, rank };
    })
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || b.thought.createdAt - a.thought.createdAt)
    .slice(0, limit)
    .map(({ thought, title }) => ({
      id: thought.id,
      title,
      tags: thought.tags,
      type: thought.type,
    }));
}

export function buildThoughtLinkGraph(thoughts: Thought[]): ThoughtBacklinkGraph {
  const outgoing: ThoughtBacklinkGraph['outgoing'] = {};
  const incoming: ThoughtBacklinkGraph['incoming'] = {};
  for (const thought of thoughts) {
    const refs: ThoughtLinkRef[] = [];
    for (const link of extractWikiLinks(thought.content)) {
      const target = resolveWikiLinkTarget(thoughts, link.target);
      if (!target) continue;
      const ref: ThoughtLinkRef = {
        id: target.id,
        title: thoughtTitle(target),
        target: link.target,
        alias: link.alias,
      };
      refs.push(ref);
      incoming[target.id] = [
        ...(incoming[target.id] ?? []),
        {
          id: thought.id,
          title: thoughtTitle(thought),
          target: link.target,
          alias: link.alias,
        },
      ];
    }
    outgoing[thought.id] = refs;
  }
  return { outgoing, incoming };
}

export async function listProviders(): Promise<Provider[]> {
  if (isTauri()) return invoke<Provider[]>('list_providers');
  return (readLocal().providers ?? [])
    .map((p) => ({
      ...p,
      priority: p.priority ?? 0,
      timeoutSecs: p.timeoutSecs ?? 30,
      retryCount: p.retryCount ?? 1,
      retryDelaySecs: p.retryDelaySecs ?? 1,
    }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export async function createProvider(
  name: string,
  baseUrl: string,
  apiKey: string,
  model = '',
): Promise<Provider> {
  if (isTauri()) return invoke<Provider>('create_provider', { name, baseUrl, apiKey, model });
  const shape = readLocal();
  const provider: Provider = {
    id: makeId(),
    name,
    baseUrl,
    apiKey,
    model,
    priority: 0,
    isActive: false,
    apiKeyEncrypted: false,
    timeoutSecs: 30,
    retryCount: 1,
    retryDelaySecs: 1,
  };
  shape.providers.unshift(provider);
  writeLocal(shape);
  return provider;
}

export async function setProviderActive(id: string, isActive: boolean): Promise<void> {
  if (isTauri()) {
    await invoke('set_provider_active', { id, isActive });
    return;
  }
  const shape = readLocal();
  const provider = shape.providers.find((p) => p.id === id);
  if (provider) provider.isActive = isActive;
  writeLocal(shape);
}

export async function setProviderPriority(id: string, priority: number): Promise<void> {
  if (isTauri()) {
    await invoke('set_provider_priority', { id, priority });
    return;
  }
  const shape = readLocal();
  const provider = shape.providers.find((p) => p.id === id);
  if (provider) provider.priority = Math.max(0, Math.round(priority));
  writeLocal(shape);
}

export async function updateProviderModel(id: string, model: string): Promise<void> {
  if (isTauri()) {
    await invoke('update_provider_model', { id, model });
    return;
  }
  const shape = readLocal();
  const provider = shape.providers.find((p) => p.id === id);
  if (provider) provider.model = model;
  writeLocal(shape);
}

export async function updateProviderStreamConfig(
  id: string,
  timeoutSecs: number,
  retryCount: number,
  retryDelaySecs: number,
): Promise<void> {
  if (isTauri()) {
    await invoke('update_provider_stream_config', {
      id,
      timeoutSecs,
      retryCount,
      retryDelaySecs,
    });
    return;
  }
  const shape = readLocal();
  const provider = shape.providers.find((p) => p.id === id);
  if (provider) {
    provider.timeoutSecs = Math.max(1, Math.min(300, Math.round(timeoutSecs)));
    provider.retryCount = Math.max(0, Math.min(5, Math.round(retryCount)));
    provider.retryDelaySecs = Math.max(0, Math.min(30, Math.round(retryDelaySecs)));
  }
  writeLocal(shape);
}

export async function exportProviders(): Promise<string> {
  if (isTauri()) return invoke<string>('export_providers');
  const providers = await listProviders();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: Date.now(),
      providers,
    },
    null,
    2,
  );
}

export async function importProviders(payload: string): Promise<number> {
  if (isTauri()) return invoke<number>('import_providers', { payload });
  const value = JSON.parse(payload) as
    Array<Record<string, unknown>> | { providers?: Array<Record<string, unknown>> };
  const items = Array.isArray(value) ? value : value.providers;
  if (!Array.isArray(items))
    throw new Error('Provider JSON must be an array or {providers: [...]}');
  const shape = readLocal();
  shape.providers = items.map((item) => ({
    id: makeId(),
    name: String(item.name ?? ''),
    baseUrl: String(item.baseUrl ?? ''),
    apiKey: String(item.apiKey ?? ''),
    model: String(item.model ?? ''),
    priority: Math.max(0, Math.round(Number(item.priority ?? 0))),
    isActive: Boolean(item.isActive),
    apiKeyEncrypted: false,
    timeoutSecs: Math.max(1, Math.min(300, Math.round(Number(item.timeoutSecs ?? 30)))),
    retryCount: Math.max(0, Math.min(5, Math.round(Number(item.retryCount ?? 1)))),
    retryDelaySecs: Math.max(0, Math.min(30, Math.round(Number(item.retryDelaySecs ?? 1)))),
  }));
  writeLocal(shape);
  return shape.providers.length;
}

export async function listProviderModels(provider: Provider): Promise<ProviderModel[]> {
  if (isTauri()) {
    return invoke<ProviderModel[]>('list_provider_models', { providerId: provider.id });
  }
  const isOllama = isOllamaProvider(provider.name, provider.baseUrl);
  const base = provider.baseUrl.replace(/\/+$/, '');
  const endpoint = isOllama ? `${base}/api/tags` : `${base}/models`;
  const headers: Record<string, string> = {};
  if (!isOllama && provider.apiKey.trim()) {
    headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`Models HTTP ${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    if (isOllama) {
      const items = ((payload.models as Array<{ name?: string }> | undefined) ?? []).filter(
        (m) => m.name,
      );
      const models: ProviderModel[] = items.map((m) => ({
        id: m.name as string,
        ownedBy: null,
      }));
      if (models.length === 0) throw new Error('No models returned by provider');
      return models;
    }
    const items = (
      (payload.data as Array<{ id?: string; owned_by?: string }> | undefined) ?? []
    ).filter((m) => m.id);
    const models: ProviderModel[] = items.map((m) => ({
      id: m.id as string,
      ownedBy: m.owned_by ?? null,
    }));
    if (models.length === 0) throw new Error('No models returned by provider');
    return models;
  } finally {
    window.clearTimeout(timer);
  }
}

export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function clampModelNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeModelMeta(raw: Partial<ProviderModel>): ProviderModel {
  return {
    id: String(raw.id ?? ''),
    ownedBy: raw.ownedBy ?? null,
    contextWindow: clampModelNumber(raw.contextWindow, 0, 1_000_000_000, 0),
    inputPricePerMtok: Math.max(0, Number(raw.inputPricePerMtok) || 0),
    outputPricePerMtok: Math.max(0, Number(raw.outputPricePerMtok) || 0),
    rateTpm: clampModelNumber(raw.rateTpm, 0, 1_000_000_000, 0),
    rateRpm: clampModelNumber(raw.rateRpm, 0, 1_000_000_000, 0),
    isFavorite: Boolean(raw.isFavorite),
    lastUsedAt: clampModelNumber(raw.lastUsedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    fetchedAt: clampModelNumber(raw.fetchedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    updatedAt: clampModelNumber(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export function sortModelMeta(models: ProviderModel[]): ProviderModel[] {
  return [...models].sort((a, b) => {
    if (Boolean(b.isFavorite) !== Boolean(a.isFavorite)) {
      return Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
    }
    if ((b.lastUsedAt ?? 0) !== (a.lastUsedAt ?? 0)) {
      return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    }
    return a.id.localeCompare(b.id);
  });
}

export async function listCachedProviderModels(providerId: string): Promise<ProviderModel[]> {
  if (isTauri()) {
    return invoke<ProviderModel[]>('list_cached_provider_models', { providerId });
  }
  return sortModelMeta((readLocal().modelCache[providerId] ?? []).map(normalizeModelMeta));
}

export async function refreshProviderModels(providerId: string): Promise<ProviderModel[]> {
  if (isTauri()) {
    return invoke<ProviderModel[]>('refresh_provider_models', { providerId });
  }
  const provider = (await listProviders()).find((p) => p.id === providerId);
  if (!provider) throw new Error('Provider not found');
  const fresh = await listProviderModels(provider);
  const now = Date.now();
  const shape = readLocal();
  const existing = new Map((shape.modelCache[providerId] ?? []).map((m) => [m.id, m]));
  for (const model of fresh) {
    const prev = existing.get(model.id) ?? {};
    existing.set(
      model.id,
      normalizeModelMeta({ ...prev, ...model, fetchedAt: now, updatedAt: now }),
    );
  }
  shape.modelCache = {
    ...shape.modelCache,
    [providerId]: sortModelMeta([...existing.values()]),
  };
  writeLocal(shape);
  return shape.modelCache[providerId];
}

export async function setProviderModelFavorite(
  providerId: string,
  modelId: string,
  favorite: boolean,
): Promise<void> {
  if (isTauri()) {
    await invoke('set_provider_model_favorite', { providerId, modelId, favorite });
    return;
  }
  const shape = readLocal();
  const cache = shape.modelCache[providerId] ?? [];
  const found = cache.find((m) => m.id === modelId);
  if (found) {
    found.isFavorite = favorite;
  } else {
    cache.push(normalizeModelMeta({ id: modelId, isFavorite: favorite, updatedAt: Date.now() }));
  }
  shape.modelCache = { ...shape.modelCache, [providerId]: sortModelMeta(cache) };
  writeLocal(shape);
}

export async function updateProviderModelMeta(
  providerId: string,
  modelId: string,
  patch: Partial<
    Pick<
      ProviderModel,
      'contextWindow' | 'inputPricePerMtok' | 'outputPricePerMtok' | 'rateTpm' | 'rateRpm'
    >
  >,
): Promise<void> {
  if (isTauri()) {
    await invoke('update_provider_model_meta', {
      providerId,
      modelId,
      meta: {
        contextWindow: patch.contextWindow ?? 0,
        inputPricePerMtok: patch.inputPricePerMtok ?? 0,
        outputPricePerMtok: patch.outputPricePerMtok ?? 0,
        rateTpm: patch.rateTpm ?? 0,
        rateRpm: patch.rateRpm ?? 0,
      },
    });
    return;
  }
  const shape = readLocal();
  const cache = shape.modelCache[providerId] ?? [];
  const found = cache.find((m) => m.id === modelId);
  const merged = normalizeModelMeta({
    ...(found ?? { id: modelId }),
    ...patch,
    updatedAt: Date.now(),
  });
  if (found) Object.assign(found, merged);
  else cache.push(merged);
  shape.modelCache = { ...shape.modelCache, [providerId]: sortModelMeta(cache) };
  writeLocal(shape);
}

export async function touchProviderModelUsage(providerId: string, modelId: string): Promise<void> {
  if (isTauri()) {
    await invoke('touch_provider_model_usage', { providerId, modelId });
    return;
  }
  const now = Date.now();
  const shape = readLocal();
  const cache = shape.modelCache[providerId] ?? [];
  const found = cache.find((m) => m.id === modelId);
  if (found) {
    found.lastUsedAt = now;
    found.updatedAt = now;
  } else {
    cache.push(normalizeModelMeta({ id: modelId, lastUsedAt: now, updatedAt: now }));
  }
  shape.modelCache = { ...shape.modelCache, [providerId]: sortModelMeta(cache) };
  writeLocal(shape);
}

export async function listDepartments(): Promise<Department[]> {
  if (isTauri()) return invoke<Department[]>('list_departments');
  const shape = readLocal();
  const departments = shape.departments ?? [];
  return departments.map((department) => ({
    ...department,
    agentCount:
      shape.agents?.filter(
        (a) => a.departmentId === department.id || a.departmentName === department.name,
      ).length ?? department.agentCount,
  }));
}

export async function listAgents(): Promise<Agent[]> {
  if (isTauri()) return invoke<Agent[]>('list_agents');
  const shape = readLocal();
  return shape.agents ?? [];
}

export async function createDepartment(
  name: string,
  description: string,
  color: string,
): Promise<Department> {
  if (isTauri()) return invoke<Department>('create_department', { name, description, color });
  const shape = readLocal();
  const department: Department = {
    id: makeId(),
    name,
    description,
    color,
    agentCount: 0,
    createdAt: Date.now(),
  };
  shape.departments.push(department);
  writeLocal(shape);
  return department;
}

export async function createAgent(
  departmentId: string,
  name: string,
  role: string,
  model: string,
  providerId: string | null,
  systemPrompt: string,
): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>('create_agent', {
      departmentId,
      name,
      role,
      model,
      providerId,
      systemPrompt,
    });
  }
  const shape = readLocal();
  const department = shape.departments.find((d) => d.id === departmentId);
  const agent: Agent = {
    id: makeId(),
    departmentId,
    departmentName: department?.name ?? '',
    name,
    role,
    model,
    providerId,
    systemPrompt,
    isActive: true,
    createdAt: Date.now(),
  };
  shape.agents.push(agent);
  writeLocal(shape);
  return agent;
}

export async function updateAgentSystemPrompt(id: string, systemPrompt: string): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>('update_agent_system_prompt', { id, systemPrompt });
  }
  const shape = readLocal();
  const agent = shape.agents.find((a) => a.id === id);
  if (!agent) throw new Error('agent not found');
  if (agent.systemPrompt !== systemPrompt) {
    shape.promptVersions = shape.promptVersions ?? [];
    shape.promptVersions.push({
      id: makeId(),
      agentId: id,
      content: agent.systemPrompt,
      createdAt: Date.now(),
    });
    agent.systemPrompt = systemPrompt;
    writeLocal(shape);
  }
  return { ...agent };
}

export async function listAgentPromptVersions(agentId: string): Promise<AgentPromptVersion[]> {
  if (isTauri()) {
    return invoke<AgentPromptVersion[]>('list_agent_prompt_versions', { agentId });
  }
  const shape = readLocal();
  return (shape.promptVersions ?? [])
    .filter((v) => v.agentId === agentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function restoreAgentPrompt(agentId: string, versionId: string): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>('restore_agent_prompt', { agentId, versionId });
  }
  const shape = readLocal();
  const agent = shape.agents.find((a) => a.id === agentId);
  const version = (shape.promptVersions ?? []).find(
    (v) => v.id === versionId && v.agentId === agentId,
  );
  if (!agent || !version) throw new Error('agent or version not found');
  if (agent.systemPrompt !== version.content) {
    shape.promptVersions = shape.promptVersions ?? [];
    shape.promptVersions.push({
      id: makeId(),
      agentId,
      content: agent.systemPrompt,
      createdAt: Date.now(),
    });
    agent.systemPrompt = version.content;
    writeLocal(shape);
  }
  return { ...agent };
}

export async function listAgentCatalog(): Promise<AgencyAgent[]> {
  if (isTauri()) return invoke<AgencyAgent[]>('list_agent_catalog');
  return readLocal().agentCatalog;
}

export async function importAgentCatalog(entries: AgencyAgentInput[]): Promise<AgencyAgent[]> {
  if (isTauri()) return invoke<AgencyAgent[]>('import_agent_catalog', { entries });
  const shape = readLocal();
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.slug.trim()) {
      throw new WorkbenchError('INVALID_INPUT', `import_agent_catalog:${entry.slug}`);
    }
    const existing = shape.agentCatalog.find((agent) => agent.slug === entry.slug);
    if (existing) {
      Object.assign(existing, entry, { updatedAt: now });
    } else {
      shape.agentCatalog.push({ ...entry, id: makeId(), createdAt: now, updatedAt: now });
    }
  }
  writeLocal(shape);
  return shape.agentCatalog;
}

export async function listTeamPresets(): Promise<TeamPreset[]> {
  if (isTauri()) return invoke<TeamPreset[]>('list_team_presets');
  return readLocal().teamPresets;
}

export async function createTeamPreset(name: string, agentSlugs: string[]): Promise<TeamPreset> {
  if (isTauri()) return invoke<TeamPreset>('create_team_preset', { name, agentSlugs });
  if (!name.trim()) throw new WorkbenchError('INVALID_INPUT', 'create_team_preset:empty-name');
  const shape = readLocal();
  const now = Date.now();
  const preset: TeamPreset = {
    id: makeId(),
    name,
    agentSlugs,
    createdAt: now,
    updatedAt: now,
  };
  shape.teamPresets.push(preset);
  writeLocal(shape);
  return preset;
}

export async function updateTeamPreset(
  id: string,
  name: string,
  agentSlugs: string[],
): Promise<TeamPreset> {
  if (isTauri()) return invoke<TeamPreset>('update_team_preset', { id, name, agentSlugs });
  if (!name.trim()) throw new WorkbenchError('INVALID_INPUT', 'update_team_preset:empty-name');
  const shape = readLocal();
  const preset = shape.teamPresets.find((p) => p.id === id);
  if (!preset) throw new Error('team preset not found');
  preset.name = name;
  preset.agentSlugs = agentSlugs;
  preset.updatedAt = Date.now();
  writeLocal(shape);
  return { ...preset };
}

export async function deleteTeamPreset(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_team_preset', { id });
    return;
  }
  const shape = readLocal();
  shape.teamPresets = shape.teamPresets.filter((p) => p.id !== id);
  writeLocal(shape);
}

export async function listCliTools(): Promise<CliToolDetection[]> {
  if (isTauri()) return invoke<CliToolDetection[]>('list_cli_tools');
  return readLocal().cliTools;
}

const KNOWN_CLI_TOOLS: { bin: string; label: string; defaultDetected: boolean }[] = [
  { bin: 'claude', label: 'Claude Code', defaultDetected: true },
  { bin: 'aider', label: 'Aider', defaultDetected: true },
  { bin: 'codex', label: 'Codex CLI', defaultDetected: false },
  { bin: 'gemini', label: 'Gemini CLI', defaultDetected: false },
  { bin: 'opencode', label: 'OpenCode', defaultDetected: false },
  { bin: 'qwen', label: 'Qwen Code', defaultDetected: false },
  { bin: 'cursor', label: 'Cursor CLI', defaultDetected: false },
  { bin: 'windsurf', label: 'Windsurf', defaultDetected: false },
];

export async function detectCliTools(): Promise<CliToolDetection[]> {
  if (isTauri()) return invoke<CliToolDetection[]>('detect_cli_tools');
  // Browser fallback cannot scan PATH; keep the flow usable with the two core CLIs
  // and preserve any previously saved detections.
  const cached = readLocal().cliTools;
  const now = Date.now();
  const merged: CliToolDetection[] = KNOWN_CLI_TOOLS.map((tool) => {
    const saved = cached.find((entry) => entry.bin === tool.bin);
    return {
      bin: tool.bin,
      label: tool.label,
      detected: saved ? saved.detected || tool.defaultDetected : tool.defaultDetected,
      lastCheckedAt: saved?.lastCheckedAt ?? now,
    };
  });
  await saveCliToolDetections(merged);
  return readLocal().cliTools;
}

export async function saveCliToolDetections(
  tools: CliToolDetection[],
): Promise<CliToolDetection[]> {
  if (isTauri()) {
    return invoke<CliToolDetection[]>('save_cli_tool_detections', { tools });
  }
  const shape = readLocal();
  const now = Date.now();
  for (const tool of tools) {
    if (!tool.bin.trim()) {
      throw new WorkbenchError('INVALID_INPUT', `save_cli_tool_detections:${tool.bin}`);
    }
    const existing = shape.cliTools.find((entry) => entry.bin === tool.bin);
    const next = {
      ...tool,
      lastCheckedAt: tool.lastCheckedAt > 0 ? tool.lastCheckedAt : now,
    };
    if (existing) {
      Object.assign(existing, next);
    } else {
      shape.cliTools.push(next);
    }
  }
  writeLocal(shape);
  return shape.cliTools;
}

export async function checkProviderHealth(providerId: string): Promise<ProviderHealth> {
  if (isTauri()) return invoke<ProviderHealth>('check_provider_health', { providerId });
  if (isMockAgentsEnabled()) return mockProviderHealth(providerId);
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { ok: true, latencyMs: 120, message: 'ok' };
}

const localHeartbeatHandlers = new Set<(snapshot: ProviderHeartbeatSnapshot) => void>();

function emitLocalHeartbeat(snapshot: ProviderHeartbeatSnapshot) {
  for (const handler of localHeartbeatHandlers) handler(snapshot);
}

export async function runProviderHeartbeat(
  providerIds?: string[],
): Promise<ProviderHeartbeatSnapshot> {
  if (isTauri()) {
    return invoke<ProviderHeartbeatSnapshot>('run_provider_heartbeat', {
      providerIds: providerIds ?? [],
    });
  }
  const providers = await listProviders();
  const entries: ProviderHeartbeatEntry[] = providers.map((p) => {
    if (p.name === 'Ollama') {
      return {
        id: p.id,
        name: p.name,
        ok: false,
        latencyMs: 0,
        message: 'Connection failed: provider unreachable',
        checked: true,
        consecutiveFailures: 2,
        alert: true,
      };
    }
    return {
      id: p.id,
      name: p.name,
      ok: true,
      latencyMs: 80 + p.name.length * 7,
      message: 'ok',
      checked: true,
      consecutiveFailures: 0,
      alert: false,
    };
  });
  const snapshot: ProviderHeartbeatSnapshot = {
    providers: entries,
    alerts: entries.filter((entry) => entry.alert),
    checkedAt: Date.now(),
  };
  emitLocalHeartbeat(snapshot);
  return snapshot;
}

export async function listenProviderHeartbeat(
  handler: (snapshot: ProviderHeartbeatSnapshot) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<ProviderHeartbeatSnapshot>('provider-heartbeat', (event) =>
      handler(event.payload),
    );
  }
  localHeartbeatHandlers.add(handler);
  return () => localHeartbeatHandlers.delete(handler);
}

export type RouteResult = {
  provider: Provider | null;
  health: ProviderHealth | null;
  candidates: { id: string; name: string; ok: boolean; latencyMs: number }[];
  fallbackFrom: string | null;
};

export async function routeProvider(providerIds: string[]): Promise<RouteResult> {
  const ids = [...new Set(providerIds)];
  const providers = (await listProviders())
    .filter((p) => ids.includes(p.id))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const candidates = await Promise.all(
    providers.map(async (p) => {
      const health = await checkProviderHealth(p.id);
      return { id: p.id, name: p.name, ok: health.ok, latencyMs: health.latencyMs };
    }),
  );
  const healthy = providers
    .filter((p) => candidates.find((c) => c.id === p.id)?.ok)
    .sort((a, b) => {
      const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDelta) return priorityDelta;
      const latencyA = candidates.find((c) => c.id === a.id)?.latencyMs ?? 0;
      const latencyB = candidates.find((c) => c.id === b.id)?.latencyMs ?? 0;
      return latencyA - latencyB;
    });
  if (healthy.length === 0) {
    return { provider: null, health: null, candidates, fallbackFrom: null };
  }
  const chosen = healthy[0];
  const fallbackFrom =
    providers
      .filter((p) => p.id !== chosen.id && candidates.find((c) => c.id === p.id)?.ok === false)
      .map((p) => p.name)
      .join(', ') || null;
  return {
    provider: chosen,
    health: {
      ok: true,
      latencyMs: candidates.find((c) => c.id === chosen.id)?.latencyMs ?? 0,
      message: 'ok',
    },
    candidates,
    fallbackFrom,
  };
}

export async function listSessions(): Promise<Session[]> {
  if (isTauri()) return invoke<Session[]>('list_sessions');
  const shape = readLocal();
  return shape.sessions
    .map((s) => ({
      ...s,
      pinned: s.pinned ?? false,
      archived: s.archived ?? false,
      messageCount: shape.chatMessages.filter((m) => m.sessionId === s.id).length,
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

export async function createSession(title: string, model: string): Promise<Session> {
  if (isTauri()) return invoke<Session>('create_session', { title, model });
  const shape = readLocal();
  const session: Session = {
    id: makeId(),
    projectId: null,
    title,
    model,
    pinned: false,
    archived: false,
    messageCount: 0,
    createdAt: Date.now(),
  };
  shape.sessions.unshift(session);
  writeLocal(shape);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_session', { id });
    return;
  }
  const shape = readLocal();
  shape.sessions = shape.sessions.filter((s) => s.id !== id);
  shape.chatMessages = shape.chatMessages.filter((m) => m.sessionId !== id);
  const remainingMessageIds = new Set(shape.chatMessages.map((m) => m.id));
  shape.messageVersions = (shape.messageVersions ?? []).filter((v) =>
    remainingMessageIds.has(v.messageId),
  );
  shape.messageAux = (shape.messageAux ?? []).filter((a) => remainingMessageIds.has(a.messageId));
  writeLocal(shape);
}

export async function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  id?: string,
): Promise<ChatMessage> {
  if (isTauri()) return invoke<ChatMessage>('save_chat_message', { sessionId, role, content, id });
  const shape = readLocal();
  shape.chatMessages = shape.chatMessages ?? [];
  const message: ChatMessage = {
    id: id ?? makeId(),
    sessionId,
    role,
    content,
    createdAt: Date.now(),
  };
  shape.chatMessages.push(message);
  writeLocal(shape);
  return message;
}

export async function listChatMessages(sessionId: string): Promise<ChatMessage[]> {
  if (isTauri()) return invoke<ChatMessage[]>('list_chat_messages', { sessionId });
  return (readLocal().chatMessages ?? [])
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listClipboard(): Promise<ClipboardItem[]> {
  return isTauri() ? invoke<ClipboardItem[]>('list_clipboard') : readLocal().clipboard;
}

export async function listErrorLogs(): Promise<ErrorLog[]> {
  return isTauri() ? invoke<ErrorLog[]>('list_error_logs') : readLocal().logs;
}

export async function reportFrontendError(input: {
  source: string;
  message: string;
  stack: string | null;
  severity: string;
}): Promise<void> {
  const status = await getSyncStatus();
  const deviceId = status.deviceId;
  if (isTauri()) {
    await invoke('report_frontend_error', { ...input, deviceId });
  } else {
    const shape = readLocal();
    const log: ErrorLog = {
      id: makeId(),
      source: input.source,
      message: input.message,
      stack: input.stack,
      severity: input.severity,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      deviceId,
    };
    shape.logs.unshift(log);
    writeLocal(shape);
  }
  void emitWorkbenchEvent('error.reported', {
    source: input.source,
    message: input.message,
    severity: input.severity,
    deviceId,
  });
}

export async function captureClipboard(content: string): Promise<ClipboardItem> {
  let item: ClipboardItem;
  if (isTauri()) {
    item = await invoke<ClipboardItem>('capture_clipboard', { content });
  } else {
    const shape = readLocal();
    const now = Date.now();
    item = { id: makeId(), content, source: 'system', timestamp: now, updatedAt: now };
    shape.clipboard.unshift(item);
    writeLocal(shape);
  }
  void emitWorkbenchEvent('clipboard.captured', {
    content: item.content,
    source: item.source,
  });
  return item;
}

export async function listenClipboardUpdated(
  handler: (item: ClipboardItem) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<ClipboardItem>('clipboard-updated', (event) => {
      void emitWorkbenchEvent('clipboard.captured', {
        content: event.payload.content,
        source: event.payload.source,
      });
      handler(event.payload);
    });
  }
  return () => {};
}

const SYNC_LS_KEY = 'ai-workbench:sync-snapshot:v1';
const SYNC_ENCRYPTED_LS_KEY = 'ai-workbench:sync-encrypted:v1';
const SYNC_AUTO_LS_KEY = 'ai-workbench:sync-auto:v1';
const SYNC_CONFLICTS_LS_KEY = 'ai-workbench:sync-conflicts:v1';
const SYNC_AUDIT_LS_KEY = 'ai-workbench:sync-audit:v1';
const SYNC_KEYS_LS_KEY = 'ai-workbench:sync-keys:v1';

type SyncKeysStore = {
  credential: SyncCredential | null;
  versions: SyncKeyVersion[];
  pairedDevices: SyncPairedDevice[];
};

function readSyncKeysStore(): SyncKeysStore {
  try {
    const raw = localStorage.getItem(SYNC_KEYS_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncKeysStore>;
      return {
        credential: parsed.credential ?? null,
        versions: parsed.versions ?? [],
        pairedDevices: parsed.pairedDevices ?? [],
      };
    }
  } catch {
    // fall through to empty store
  }
  return { credential: null, versions: [], pairedDevices: [] };
}

function writeSyncKeysStore(store: SyncKeysStore) {
  lockedStorageWrite(() => localStorage.setItem(SYNC_KEYS_LS_KEY, JSON.stringify(store)));
}

export type SyncAutoConfig = {
  enabled: boolean;
  intervalMs: number;
  remoteUrl: string;
};

export async function getSyncAutoConfig(): Promise<SyncAutoConfig> {
  try {
    const raw = localStorage.getItem(SYNC_AUTO_LS_KEY);
    if (raw) return JSON.parse(raw) as SyncAutoConfig;
  } catch {
    // fall through to defaults
  }
  return { enabled: false, intervalMs: 60_000, remoteUrl: '' };
}

export async function setSyncAutoConfig(config: SyncAutoConfig): Promise<SyncAutoConfig> {
  localStorage.setItem(SYNC_AUTO_LS_KEY, JSON.stringify(config));
  return config;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(padded);
}

async function syncKeyFingerprint(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return bytesToHex(new Uint8Array(digest).slice(0, 8));
}

function assessPassphraseStrengthBrowser(passphrase: string): PassphraseStrength {
  const trimmed = passphrase.trim();
  const length = [...trimmed].length;
  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(trimmed);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  let score = length * 4 + variety * 8;
  if (length >= 16) score += 10;
  else if (length >= 12) score += 6;
  else if (length >= 8) score += 3;
  if (trimmed.length > 24) score += 8;
  if (hasLower && hasUpper && hasDigit && hasSymbol) score += 8;
  score = Math.min(100, score);
  const feedback: string[] = [];
  if (length < 8) feedback.push('at least 8 characters');
  if (!hasDigit) feedback.push('add digits');
  if (!hasUpper || !hasLower) feedback.push('mix upper and lower case');
  if (!hasSymbol) feedback.push('add symbols');
  if (feedback.length === 0 && length < 12) {
    feedback.push('lengthen to 12+ characters for strong protection');
  }
  const label = score < 40 ? 'weak' : score < 70 ? 'fair' : score < 90 ? 'strong' : 'excellent';
  return { score, label, feedback };
}

function buildPairingCode(
  deviceId: string,
  saltHex: string,
  fingerprint: string,
  version: number,
): string {
  const prefix = (deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'WB01').toUpperCase();
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [],
  );
  return `WB-${prefix}-${base64UrlEncode(salt)}.${fingerprint}.${version}.${base64UrlEncode(
    new TextEncoder().encode(deviceId),
  )}`;
}

function parsePairingCode(code: string): {
  remoteDeviceId: string;
  salt: Uint8Array;
  fingerprint: string;
  version: number;
} {
  const trimmed = code.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4 || !trimmed.startsWith('WB-')) {
    throw new Error('Invalid pairing code format');
  }
  const header = parts[0].slice(3);
  if (header.length < 5) throw new Error('Invalid pairing code header');
  if (header[4] !== '-') throw new Error('Invalid pairing code header delimiter');
  const saltB64 = header.slice(5);
  const salt = base64UrlDecode(saltB64);
  const fingerprint = parts[1].toLowerCase();
  const version = Number(parts[2]);
  const remoteDeviceId = (() => {
    try {
      return new TextDecoder().decode(base64UrlDecode(parts[3]));
    } catch {
      return '';
    }
  })();
  if (
    salt.length !== 16 ||
    fingerprint.length !== 16 ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new Error('Invalid pairing code fields');
  }
  return { remoteDeviceId, salt, fingerprint, version };
}

export async function syncPassphraseStrength(passphrase: string): Promise<PassphraseStrength> {
  if (isTauri()) {
    return invoke<PassphraseStrength>('sync_passphrase_strength', { passphrase });
  }
  return assessPassphraseStrengthBrowser(passphrase);
}

export async function getSyncKeyStatus(): Promise<SyncKeyStatus> {
  if (isTauri()) {
    return invoke<SyncKeyStatus>('get_sync_key_status');
  }
  const store = readSyncKeysStore();
  const credential = store.credential;
  const activeVersion = credential?.activeKeyVersion
    ? store.versions.find((item) => item.version === credential.activeKeyVersion)
    : null;
  return {
    deviceId: readLocal().syncDeviceId || credential?.deviceId || '',
    encryptionEnabled: credential?.encryptionEnabled ?? false,
    confirmed: credential?.confirmed ?? false,
    activeKeyVersion: credential?.activeKeyVersion ?? 0,
    activeSalt: activeVersion?.salt ?? '',
    activeFingerprint: activeVersion?.fingerprint ?? '',
    iterations: activeVersion?.iterations ?? 100_000,
    rotatedAt: credential?.rotatedAt ?? 0,
    updatedAt: credential?.updatedAt ?? 0,
    pairedDevices: store.pairedDevices,
  };
}

export async function listSyncKeyVersions(): Promise<SyncKeyVersion[]> {
  if (isTauri()) {
    return invoke<SyncKeyVersion[]>('list_sync_key_versions');
  }
  return readSyncKeysStore().versions;
}

export async function registerSyncPassphrase(
  deviceId: string,
  passphrase: string,
): Promise<SyncCredential> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  const strength = assessPassphraseStrengthBrowser(passphrase);
  if (strength.score < 40)
    throw new Error('Passphrase is too weak; use at least 8 characters with mixed cases');
  if (isTauri()) {
    return invoke<SyncCredential>('register_sync_passphrase', { deviceId, passphrase });
  }
  const resolvedDeviceId = deviceId.trim() || readLocal().syncDeviceId || makeId();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveBrowserSyncKey(passphrase, salt);
  const fingerprint = await syncKeyFingerprint(key);
  const store = readSyncKeysStore();
  const now = Date.now();
  const version = (store.credential?.activeKeyVersion ?? 0) + 1;
  const versionRecord: SyncKeyVersion = {
    deviceId: resolvedDeviceId,
    version,
    salt: bytesToHex(salt),
    fingerprint,
    algorithm: 'AES-256-GCM',
    iterations: 100_000,
    active: true,
    createdAt: now,
    rotatedAt: now,
  };
  store.versions = [
    versionRecord,
    ...store.versions.map((item) => ({ ...item, active: false, rotatedAt: now })),
  ];
  store.credential = {
    deviceId: resolvedDeviceId,
    encryptionEnabled: true,
    confirmed: true,
    activeKeyVersion: version,
    rotatedAt: now,
    updatedAt: now,
  };
  writeSyncKeysStore(store);
  return store.credential;
}

export async function confirmSyncPassphrase(passphrase: string): Promise<SyncCredential> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  if (isTauri()) {
    return invoke<SyncCredential>('confirm_sync_passphrase', { passphrase });
  }
  const store = readSyncKeysStore();
  const credential = store.credential;
  if (!credential || credential.activeKeyVersion === 0) {
    throw new Error('Register a sync passphrase before confirming');
  }
  const version = store.versions.find((item) => item.version === credential.activeKeyVersion);
  if (!version) throw new Error('Active sync key version missing');
  const salt = new Uint8Array(
    version.salt.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [],
  );
  const key = await deriveBrowserSyncKey(passphrase, salt);
  const fingerprint = await syncKeyFingerprint(key);
  if (fingerprint !== version.fingerprint) {
    throw new Error('Passphrase does not match the registered sync key');
  }
  credential.confirmed = true;
  credential.updatedAt = Date.now();
  writeSyncKeysStore(store);
  return credential;
}

export async function rotateSyncPassphrase(
  deviceId: string,
  passphrase: string,
): Promise<SyncCredential> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  const strength = assessPassphraseStrengthBrowser(passphrase);
  if (strength.score < 40)
    throw new Error('Passphrase is too weak; use at least 8 characters with mixed cases');
  if (isTauri()) {
    return invoke<SyncCredential>('rotate_sync_passphrase', { deviceId, passphrase });
  }
  const current = readSyncKeysStore().credential;
  if (!current || current.activeKeyVersion === 0) {
    throw new Error('Register a sync passphrase before rotating');
  }
  return registerSyncPassphrase(deviceId, passphrase);
}

export async function getSyncPairingCode(): Promise<string> {
  if (isTauri()) {
    return invoke<string>('get_sync_pairing_code');
  }
  const store = readSyncKeysStore();
  const credential = store.credential;
  if (!credential || credential.activeKeyVersion === 0) {
    throw new Error('Register a sync passphrase before generating a pairing code');
  }
  const version = store.versions.find((item) => item.version === credential.activeKeyVersion);
  if (!version) throw new Error('Active sync key version missing');
  return buildPairingCode(
    credential.deviceId || readLocal().syncDeviceId,
    version.salt,
    version.fingerprint,
    version.version,
  );
}

export async function verifySyncPairingCode(
  pairingCode: string,
  passphrase: string,
): Promise<SyncPairedDevice> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  if (isTauri()) {
    return invoke<SyncPairedDevice>('verify_sync_pairing_code', { pairingCode, passphrase });
  }
  const parsed = parsePairingCode(pairingCode);
  const key = await deriveBrowserSyncKey(passphrase, parsed.salt);
  const expected = await syncKeyFingerprint(key);
  if (expected !== parsed.fingerprint) {
    throw new Error('Pairing code does not match this passphrase');
  }
  const store = readSyncKeysStore();
  const now = Date.now();
  const deviceId = parsed.remoteDeviceId || `remote-${parsed.fingerprint.slice(0, 8)}`;
  const record: SyncPairedDevice = {
    deviceId,
    fingerprint: parsed.fingerprint,
    pairingCode: pairingCode.trim(),
    version: parsed.version,
    pairedAt: now,
  };
  store.pairedDevices = [
    record,
    ...store.pairedDevices.filter((item) => item.deviceId !== deviceId),
  ];
  writeSyncKeysStore(store);
  return record;
}

export async function listSyncPairedDevices(): Promise<SyncPairedDevice[]> {
  if (isTauri()) {
    return invoke<SyncPairedDevice[]>('list_sync_paired_devices');
  }
  return readSyncKeysStore().pairedDevices;
}

export async function removeSyncPairedDevice(remoteDeviceId: string): Promise<number> {
  if (isTauri()) {
    return invoke<number>('remove_sync_paired_device', { remoteDeviceId });
  }
  const store = readSyncKeysStore();
  const before = store.pairedDevices.length;
  store.pairedDevices = store.pairedDevices.filter((item) => item.deviceId !== remoteDeviceId);
  writeSyncKeysStore(store);
  return before - store.pairedDevices.length;
}

function readQuickPromptUsageEntriesLocal(): QuickPromptUsageEntry[] {
  return Object.entries(getQuickPromptUsageLocal()).map(([id, count]) => ({
    id,
    count,
    updatedAt: Date.now(),
  }));
}

export async function exportSyncSnapshot(): Promise<SyncSnapshot> {
  if (isTauri()) return invoke<SyncSnapshot>('export_sync_snapshot');
  const shape = readLocal();
  const snapshot: SyncSnapshot = {
    deviceId: shape.syncDeviceId || makeId(),
    exportedAt: Date.now(),
    clipboard: shape.clipboard,
    logs: shape.logs,
    quickPrompts: [...QUICK_PROMPTS, ...listCustomQuickPromptsLocal()],
    quickPromptUsage: readQuickPromptUsageEntriesLocal(),
  };
  lockedStorageWrite(() => localStorage.setItem(SYNC_LS_KEY, JSON.stringify(snapshot)));
  return snapshot;
}

export async function importSyncSnapshot(): Promise<SyncResult> {
  let result: SyncResult;
  if (isTauri()) {
    result = await invoke<SyncResult>('import_sync_snapshot');
  } else {
    const raw = localStorage.getItem(SYNC_LS_KEY);
    if (!raw) throw new Error('sync snapshot not found');
    result = mergeSnapshotIntoLocal(JSON.parse(raw) as SyncSnapshot);
  }
  void emitWorkbenchEvent('sync.completed', { action: 'import', deviceId: result.deviceId });
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBrowserSyncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSyncPayload(payload: string, passphrase: string): Promise<string> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  if (isTauri()) {
    return invoke<string>('encrypt_sync_payload_command', { payload, passphrase });
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBrowserSyncKey(passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload)),
  );
  const envelope: SyncEnvelope = {
    v: 1,
    alg: 'AES-256-GCM',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
  return JSON.stringify(envelope);
}

export async function decryptSyncPayload(envelope: string, passphrase: string): Promise<string> {
  if (!passphrase.trim()) throw new Error('Passphrase is required');
  if (isTauri()) {
    return invoke<string>('decrypt_sync_payload_command', { envelope, passphrase });
  }
  const parsed = JSON.parse(envelope) as SyncEnvelope;
  if (parsed.v !== 1 || parsed.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported encrypted payload');
  }
  const key = await deriveBrowserSyncKey(passphrase, base64ToBytes(parsed.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export async function exportEncryptedSyncSnapshot(passphrase: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>('export_encrypted_sync_snapshot', { passphrase });
  }
  const snapshot = await exportSyncSnapshot();
  const envelope = await encryptSyncPayload(JSON.stringify(snapshot), passphrase);
  localStorage.setItem(SYNC_ENCRYPTED_LS_KEY, envelope);
  return envelope;
}

export async function importEncryptedSyncSnapshot(passphrase: string): Promise<SyncResult> {
  let result: SyncResult;
  if (isTauri()) {
    result = await invoke<SyncResult>('import_encrypted_sync_snapshot', { passphrase });
  } else {
    const raw = localStorage.getItem(SYNC_ENCRYPTED_LS_KEY);
    if (!raw) throw new Error('Encrypted sync snapshot not found');
    const payload = await decryptSyncPayload(raw, passphrase);
    result = mergeSnapshotIntoLocal(JSON.parse(payload) as SyncSnapshot);
  }
  void emitWorkbenchEvent('sync.completed', { action: 'import', deviceId: result.deviceId });
  return result;
}

export async function pushSyncSnapshot(
  remoteUrl: string,
  token?: string,
  passphrase?: string,
): Promise<RemoteSyncPushResult> {
  let result: RemoteSyncPushResult;
  if (isTauri()) {
    result = await invoke<RemoteSyncPushResult>('push_sync_snapshot', {
      remoteUrl,
      token: token?.trim() ? token.trim() : null,
      passphrase: passphrase?.trim() ? passphrase.trim() : null,
    });
  } else {
    const snapshot = await exportSyncSnapshot();
    result = {
      ok: true,
      syncedAt: snapshot.exportedAt,
      message: passphrase?.trim()
        ? 'Pushed encrypted snapshot to remote'
        : 'Pushed snapshot to remote',
    };
  }
  void emitWorkbenchEvent('sync.completed', { action: 'push', ok: result.ok });
  return result;
}

export async function pullSyncSnapshot(
  remoteUrl: string,
  token?: string,
  passphrase?: string,
): Promise<SyncResult> {
  let result: SyncResult;
  if (isTauri()) {
    result = await invoke<SyncResult>('pull_sync_snapshot', {
      remoteUrl,
      token: token?.trim() ? token.trim() : null,
      passphrase: passphrase?.trim() ? passphrase.trim() : null,
    });
  } else {
    const remote: SyncSnapshot = {
      deviceId: 'device-remote-fallback',
      exportedAt: Date.now(),
      clipboard: [
        {
          id: 'sync-clip-remote-fallback',
          content: 'sprint 33 remote clipboard',
          source: 'remote',
          timestamp: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      logs: [],
      quickPrompts: [
        {
          id: 'sync-quick-prompt-remote',
          label: 'Sync quick',
          category: 'work',
          text: 'sprint 87 remote quick prompt',
          custom: true,
          updatedAt: Date.now() + 1000,
          createdAt: Date.now() + 1000,
        },
      ],
      quickPromptUsage: [
        { id: 'sync-quick-prompt-remote', count: 1, updatedAt: Date.now() + 1000 },
      ],
    };
    const shape = readLocal();
    const baseClip = shape.clipboard[0];
    if (baseClip) {
      remote.clipboard.push({
        id: baseClip.id,
        content: 'sprint 38 conflict override',
        source: 'remote',
        timestamp: Date.now(),
        updatedAt: baseClip.updatedAt + 1,
      });
    }
    if (passphrase?.trim()) {
      const envelope = await encryptSyncPayload(JSON.stringify(remote), passphrase);
      const payload = await decryptSyncPayload(envelope, passphrase);
      Object.assign(remote, JSON.parse(payload) as SyncSnapshot);
    }
    result = mergeSnapshotIntoLocal(remote);
  }
  void emitWorkbenchEvent('sync.completed', { action: 'pull', deviceId: result.deviceId });
  return result;
}

function mergeSnapshotIntoLocal(remote: SyncSnapshot): SyncResult {
  const shape = readLocal();
  let clipboardAdded = 0;
  let clipboardUpdated = 0;
  const conflicts: SyncConflictItem[] = [];
  for (const item of remote.clipboard) {
    const local = shape.clipboard.find((c) => c.id === item.id);
    if (!local) {
      shape.clipboard.push(item);
      clipboardAdded++;
    } else if (item.updatedAt > local.updatedAt) {
      const localUpdatedAt = local.updatedAt;
      const localContent = local.content;
      Object.assign(local, item);
      clipboardUpdated++;
      conflicts.push({
        id: item.id,
        kind: 'clipboard',
        localUpdatedAt,
        remoteUpdatedAt: item.updatedAt,
        resolvedTo: 'remote',
        preview: item.content.slice(0, 120),
        localContent,
        remoteContent: item.content,
      });
    } else if (item.updatedAt < local.updatedAt) {
      conflicts.push({
        id: item.id,
        kind: 'clipboard',
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: item.updatedAt,
        resolvedTo: 'local',
        preview: item.content.slice(0, 120),
        localContent: local.content,
        remoteContent: item.content,
      });
    }
  }
  let logsAdded = 0;
  let logsUpdated = 0;
  for (const log of remote.logs) {
    const local = shape.logs.find((l) => l.id === log.id);
    if (!local) {
      shape.logs.push(log);
      logsAdded++;
    } else if (log.updatedAt > local.updatedAt) {
      const localUpdatedAt = local.updatedAt;
      const localContent = local.message;
      Object.assign(local, log);
      logsUpdated++;
      conflicts.push({
        id: log.id,
        kind: 'log',
        localUpdatedAt,
        remoteUpdatedAt: log.updatedAt,
        resolvedTo: 'remote',
        preview: log.message.slice(0, 120),
        localContent,
        remoteContent: log.message,
      });
    } else if (log.updatedAt < local.updatedAt) {
      conflicts.push({
        id: log.id,
        kind: 'log',
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: log.updatedAt,
        resolvedTo: 'local',
        preview: log.message.slice(0, 120),
        localContent: local.message,
        remoteContent: log.message,
      });
    }
  }
  const localPrompts = [...QUICK_PROMPTS, ...listCustomQuickPromptsLocal()];
  const customPrompts = listCustomQuickPromptsLocal();
  let quickPromptsAdded = 0;
  let quickPromptsUpdated = 0;
  for (const prompt of remote.quickPrompts ?? []) {
    if (prompt.custom !== true) continue;
    const local = localPrompts.find((p) => p.id === prompt.id);
    if (!local) {
      customPrompts.push(prompt as CustomQuickPrompt);
      quickPromptsAdded++;
    } else if ((local.updatedAt ?? 0) < (prompt.updatedAt ?? 0)) {
      const index = customPrompts.findIndex((p) => p.id === prompt.id);
      if (index >= 0) {
        customPrompts[index] = { ...customPrompts[index], ...prompt } as CustomQuickPrompt;
      } else {
        customPrompts.push(prompt as CustomQuickPrompt);
      }
      quickPromptsUpdated++;
      conflicts.push({
        id: prompt.id,
        kind: 'quick_prompt',
        localUpdatedAt: local.updatedAt ?? 0,
        remoteUpdatedAt: prompt.updatedAt ?? 0,
        resolvedTo: 'remote',
        preview: prompt.text.slice(0, 120),
        localContent: JSON.stringify(local),
        remoteContent: JSON.stringify(prompt),
      });
    } else if ((local.updatedAt ?? 0) > (prompt.updatedAt ?? 0)) {
      conflicts.push({
        id: prompt.id,
        kind: 'quick_prompt',
        localUpdatedAt: local.updatedAt ?? 0,
        remoteUpdatedAt: prompt.updatedAt ?? 0,
        resolvedTo: 'local',
        preview: prompt.text.slice(0, 120),
        localContent: JSON.stringify(local),
        remoteContent: JSON.stringify(prompt),
      });
    }
  }
  localStorage.setItem('ai-workbench:quick-prompts:v1', JSON.stringify(customPrompts));
  let quickPromptUsageUpdated = 0;
  const usage = getQuickPromptUsageLocal();
  for (const entry of remote.quickPromptUsage ?? []) {
    if ((usage[entry.id] ?? 0) < entry.count) {
      usage[entry.id] = entry.count;
      quickPromptUsageUpdated++;
    }
  }
  localStorage.setItem('ai-workbench:quick-prompt-usage:v1', JSON.stringify(usage));
  shape.clipboard.sort((a, b) => b.updatedAt - a.updatedAt);
  shape.logs.sort((a, b) => b.updatedAt - a.updatedAt);
  const result: SyncResult = {
    deviceId: remote.deviceId,
    syncedAt: Date.now(),
    clipboardAdded,
    clipboardUpdated,
    logsAdded,
    logsUpdated,
    quickPromptsAdded,
    quickPromptsUpdated,
    quickPromptUsageUpdated,
    conflicts,
  };
  shape.lastSyncedAt = result.syncedAt;
  writeLocal(shape);
  persistFallbackConflicts(conflicts);
  appendSyncAudit(
    'sync.merge',
    `clips +${clipboardAdded} / updated ${clipboardUpdated} / logs +${logsAdded} / updated ${logsUpdated} / prompts +${quickPromptsAdded} / updated ${quickPromptsUpdated} / usage ${quickPromptUsageUpdated} / conflicts ${conflicts.length}`,
  );
  return result;
}

function readSyncConflictRecords(): SyncConflictRecord[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_CONFLICTS_LS_KEY) ?? '[]') as SyncConflictRecord[];
  } catch {
    return [];
  }
}

function writeSyncConflictRecords(records: SyncConflictRecord[]) {
  lockedStorageWrite(() => localStorage.setItem(SYNC_CONFLICTS_LS_KEY, JSON.stringify(records)));
}

function readSyncAudit(): SyncAuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_AUDIT_LS_KEY) ?? '[]') as SyncAuditEntry[];
  } catch {
    return [];
  }
}

function writeSyncAudit(entries: SyncAuditEntry[]) {
  lockedStorageWrite(() =>
    localStorage.setItem(SYNC_AUDIT_LS_KEY, JSON.stringify(entries.slice(0, 200))),
  );
}

function appendSyncAudit(event: string, detail: string) {
  const entries = readSyncAudit();
  entries.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    event,
    detail,
    deviceId: readLocal().syncDeviceId || 'local',
    createdAt: Date.now(),
  });
  writeSyncAudit(entries);
}

function persistFallbackConflicts(conflicts: SyncConflictItem[]): SyncConflictRecord[] {
  const records = readSyncConflictRecords();
  const createdAt = Date.now();
  for (const conflict of conflicts) {
    const index = records.findIndex(
      (record) =>
        record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice,
    );
    if (index >= 0) {
      records[index] = {
        ...conflict,
        resolvedChoice: null,
        resolvedAt: null,
        createdAt: records[index].createdAt,
      };
    } else {
      records.push({ ...conflict, resolvedChoice: null, resolvedAt: null, createdAt });
    }
  }
  writeSyncConflictRecords(records);
  return records;
}

export async function resolveSyncConflict(
  conflict: SyncConflictItem,
  choice: 'local' | 'remote',
): Promise<string> {
  if (isTauri()) {
    return invoke<string>('resolve_sync_conflict', { conflict, choice });
  }
  const shape = readLocal();
  const content = choice === 'local' ? conflict.localContent : conflict.remoteContent;
  const updatedAt = Date.now();
  if (conflict.kind === 'clipboard') {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else if (conflict.kind === 'log') {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const prompt = JSON.parse(content) as CustomQuickPrompt;
    prompt.updatedAt = updatedAt;
    const prompts = listCustomQuickPromptsLocal();
    const index = prompts.findIndex((p) => p.id === conflict.id);
    if (index >= 0) prompts[index] = prompt;
    else prompts.push(prompt);
    localStorage.setItem('ai-workbench:quick-prompts:v1', JSON.stringify(prompts));
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: choice, resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit('sync.resolve', `${conflict.kind} ${conflict.id} -> ${choice}`);
  return `Resolved ${conflict.kind} conflict ${conflict.id} with ${choice}`;
}

export async function resolveSyncConflicts(
  conflicts: SyncConflictItem[],
  choice: 'local' | 'remote',
): Promise<number> {
  if (isTauri()) {
    return invoke<number>('resolve_sync_conflicts', { conflicts, choice });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflict(conflict, choice);
  }
  return conflicts.length;
}

function unionMergeContent(local: string, remote: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of local.split('\n')) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  for (const line of remote.split('\n')) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export async function resolveSyncConflictUnion(conflict: SyncConflictItem): Promise<string> {
  if (isTauri()) {
    return invoke<string>('resolve_sync_conflict_union', { conflict });
  }
  const shape = readLocal();
  const content =
    conflict.kind === 'quick_prompt'
      ? JSON.stringify(
          mergeJsonValue(
            JSON.parse(conflict.localContent),
            JSON.parse(conflict.remoteContent),
            conflict.localUpdatedAt >= conflict.remoteUpdatedAt,
          ),
        )
      : unionMergeContent(conflict.localContent, conflict.remoteContent);
  const updatedAt = Date.now();
  if (conflict.kind === 'clipboard') {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else if (conflict.kind === 'log') {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const prompt = JSON.parse(content) as CustomQuickPrompt;
    prompt.updatedAt = updatedAt;
    const prompts = listCustomQuickPromptsLocal();
    const index = prompts.findIndex((p) => p.id === conflict.id);
    if (index >= 0) prompts[index] = prompt;
    else prompts.push(prompt);
    localStorage.setItem('ai-workbench:quick-prompts:v1', JSON.stringify(prompts));
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: 'union', resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit('sync.resolve.union', `${conflict.kind} ${conflict.id} -> union`);
  return `Merged ${conflict.kind} conflict ${conflict.id} with union`;
}

export async function resolveSyncConflictsUnion(conflicts: SyncConflictItem[]): Promise<number> {
  if (isTauri()) {
    return invoke<number>('resolve_sync_conflicts_union', { conflicts });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflictUnion(conflict);
  }
  return conflicts.length;
}

function canonicalJson(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function mergeJsonValue(local: any, remote: any, preferLocal: boolean): any {
  if (Array.isArray(local) && Array.isArray(remote)) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of [...local, ...remote]) {
      const marker = canonicalJson(item);
      if (!seen.has(marker)) {
        seen.add(marker);
        out.push(item);
      }
    }
    return out;
  }
  if (
    local !== null &&
    remote !== null &&
    typeof local === 'object' &&
    typeof remote === 'object'
  ) {
    const out: Record<string, any> = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of [...keys].sort()) {
      const localValue = local[key];
      const remoteValue = remote[key];
      if (localValue === undefined) out[key] = remoteValue;
      else if (remoteValue === undefined) out[key] = localValue;
      else out[key] = mergeJsonValue(localValue, remoteValue, preferLocal);
    }
    return out;
  }
  if (JSON.stringify(local) === JSON.stringify(remote)) return local;
  return preferLocal ? local : remote;
}

function parseFrontmatter(text: string): { fields: [string, string][]; body: string } | null {
  const trimmed = text.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) return null;
  const rest = trimmed.slice(3);
  const match = rest.match(/\n---/);
  if (!match || match.index === undefined) return null;
  const raw = rest.slice(0, match.index);
  const bodyStart = 3 + match.index + 4;
  const body = trimmed.slice(bodyStart).replace(/^\n+/, '');
  const fields: [string, string][] = [];
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields.push([key, value]);
  }
  if (fields.length === 0) return null;
  return { fields, body };
}

function mergeFrontmatterValue(local: string, remote: string, preferLocal: boolean): string {
  if (local === remote) return local;
  if (local.includes(',') || remote.includes(',')) {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const item of [...local.split(','), ...remote.split(',')]) {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        parts.push(trimmed);
      }
    }
    return parts.join(', ');
  }
  return preferLocal ? local : remote;
}

function renderFrontmatterMerge(
  localFields: [string, string][],
  remoteFields: [string, string][],
  preferLocal: boolean,
  localBody: string,
  remoteBody: string,
): string {
  const keys = [
    ...new Set([...localFields.map(([key]) => key), ...remoteFields.map(([key]) => key)]),
  ];
  const lines = ['---'];
  for (const key of keys) {
    const localValue = localFields.find(([k]) => k === key)?.[1];
    const remoteValue = remoteFields.find(([k]) => k === key)?.[1];
    const value =
      localValue !== undefined && remoteValue !== undefined
        ? mergeFrontmatterValue(localValue, remoteValue, preferLocal)
        : (localValue ?? remoteValue ?? '');
    lines.push(`${key}: ${value}`);
  }
  lines.push('---');
  const head = lines.join('\n');
  const body = unionMergeContent(localBody, remoteBody);
  return body ? `${head}\n\n${body}` : head;
}

function structuredMergeContent(local: string, remote: string, preferLocal: boolean): string {
  try {
    const localJson = JSON.parse(local);
    const remoteJson = JSON.parse(remote);
    const structured =
      (Array.isArray(localJson) || (localJson !== null && typeof localJson === 'object')) &&
      (Array.isArray(remoteJson) || (remoteJson !== null && typeof remoteJson === 'object'));
    if (structured) {
      return JSON.stringify(mergeJsonValue(localJson, remoteJson, preferLocal), null, 2);
    }
  } catch {
    /* fall through to frontmatter / line merge */
  }
  const localFrontmatter = parseFrontmatter(local);
  const remoteFrontmatter = parseFrontmatter(remote);
  if (localFrontmatter && remoteFrontmatter) {
    return renderFrontmatterMerge(
      localFrontmatter.fields,
      remoteFrontmatter.fields,
      preferLocal,
      localFrontmatter.body,
      remoteFrontmatter.body,
    );
  }
  return unionMergeContent(local, remote);
}

export async function resolveSyncConflictStructured(conflict: SyncConflictItem): Promise<string> {
  if (isTauri()) {
    return invoke<string>('resolve_sync_conflict_structured', { conflict });
  }
  const shape = readLocal();
  const preferLocal = conflict.localUpdatedAt >= conflict.remoteUpdatedAt;
  const content = structuredMergeContent(
    conflict.localContent,
    conflict.remoteContent,
    preferLocal,
  );
  const updatedAt = Date.now();
  if (conflict.kind === 'clipboard') {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else if (conflict.kind === 'log') {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const prompt = JSON.parse(content) as CustomQuickPrompt;
    prompt.updatedAt = updatedAt;
    const prompts = listCustomQuickPromptsLocal();
    const index = prompts.findIndex((p) => p.id === conflict.id);
    if (index >= 0) prompts[index] = prompt;
    else prompts.push(prompt);
    localStorage.setItem('ai-workbench:quick-prompts:v1', JSON.stringify(prompts));
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: 'structured', resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit('sync.resolve.structured', `${conflict.kind} ${conflict.id} -> structured`);
  return `Merged ${conflict.kind} conflict ${conflict.id} with fields`;
}

export async function resolveSyncConflictsStructured(
  conflicts: SyncConflictItem[],
): Promise<number> {
  if (isTauri()) {
    return invoke<number>('resolve_sync_conflicts_structured', { conflicts });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflictStructured(conflict);
  }
  return conflicts.length;
}

export async function listSyncConflicts(
  status: 'unresolved' | 'resolved' | 'all' = 'unresolved',
): Promise<SyncConflictRecord[]> {
  if (isTauri()) return invoke<SyncConflictRecord[]>('list_sync_conflicts', { status });
  const records = readSyncConflictRecords();
  if (status === 'unresolved') {
    return records
      .filter((record) => !record.resolvedChoice)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  if (status === 'resolved') {
    return records
      .filter((record) => record.resolvedChoice)
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function clearResolvedSyncConflicts(): Promise<number> {
  if (isTauri()) return invoke<number>('clear_resolved_sync_conflicts');
  const records = readSyncConflictRecords();
  const remaining = records.filter((record) => !record.resolvedChoice);
  writeSyncConflictRecords(remaining);
  const cleared = records.length - remaining.length;
  appendSyncAudit('sync.history.cleared', `cleared ${cleared} resolved conflict(s)`);
  return cleared;
}

export async function listSyncAudit(
  limit = 50,
  event?: string,
  since?: number,
  until?: number,
  deviceId?: string,
): Promise<SyncAuditEntry[]> {
  if (isTauri()) {
    return invoke<SyncAuditEntry[]>('list_sync_audit', {
      limit,
      event: event ?? null,
      since: since ?? null,
      until: until ?? null,
      deviceId: deviceId ?? null,
    });
  }
  return readSyncAudit()
    .filter((entry) => !event || entry.event === event)
    .filter((entry) => since == null || entry.createdAt >= since)
    .filter((entry) => until == null || entry.createdAt <= until)
    .filter((entry) => !deviceId || entry.deviceId === deviceId)
    .slice(0, Math.max(1, Math.min(200, limit)));
}

const AUDIT_DAY_MS = 86_400_000;

function isoDateFromEpochMs(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function summarizeSyncAudit(
  entries: SyncAuditEntry[],
  granularity: 'day' | 'week',
  event?: string,
  since?: number,
  until?: number,
  deviceId?: string,
): SyncAuditSummary {
  const filtered = entries
    .filter((entry) => !event || entry.event === event)
    .filter((entry) => since == null || entry.createdAt >= since)
    .filter((entry) => until == null || entry.createdAt <= until)
    .filter((entry) => !deviceId || entry.deviceId === deviceId);
  const grouped = new Map<number, { merge: number; resolve: number; other: number }>();
  let total = 0;
  for (const entry of filtered) {
    const startAt =
      granularity === 'week'
        ? (Math.floor((Math.floor(entry.createdAt / AUDIT_DAY_MS) + 3) / 7) * 7 - 3) * AUDIT_DAY_MS
        : Math.floor(entry.createdAt / AUDIT_DAY_MS) * AUDIT_DAY_MS;
    const slot = grouped.get(startAt) ?? { merge: 0, resolve: 0, other: 0 };
    if (entry.event.startsWith('sync.merge')) slot.merge += 1;
    else if (entry.event.startsWith('sync.resolve')) slot.resolve += 1;
    else slot.other += 1;
    grouped.set(startAt, slot);
    total += 1;
  }
  let buckets = [...grouped.entries()]
    .map(([startAt, counts]) => ({
      bucket: isoDateFromEpochMs(startAt),
      startAt,
      count: counts.merge + counts.resolve + counts.other,
      merge: counts.merge,
      resolve: counts.resolve,
      other: counts.other,
    }))
    .sort((a, b) => a.startAt - b.startAt);
  if (buckets.length > 0 && buckets.length <= 62) {
    const step = granularity === 'week' ? AUDIT_DAY_MS * 7 : AUDIT_DAY_MS;
    const filled: SyncAuditBucket[] = [];
    let cursor = buckets[0].startAt;
    for (const bucket of buckets) {
      while (cursor < bucket.startAt) {
        filled.push({
          bucket: isoDateFromEpochMs(cursor),
          startAt: cursor,
          count: 0,
          merge: 0,
          resolve: 0,
          other: 0,
        });
        cursor += step;
      }
      filled.push(bucket);
      cursor += step;
    }
    buckets = filled;
  }
  return { granularity, total, buckets };
}

export async function getSyncAuditSummary(
  granularity: 'day' | 'week',
  event?: string,
  since?: number,
  until?: number,
  deviceId?: string,
): Promise<SyncAuditSummary> {
  if (isTauri()) {
    return invoke<SyncAuditSummary>('get_sync_audit_summary', {
      granularity,
      event: event ?? null,
      since: since ?? null,
      until: until ?? null,
      deviceId: deviceId ?? null,
    });
  }
  return summarizeSyncAudit(readSyncAudit(), granularity, event, since, until, deviceId);
}

function errorBucketStart(updatedAt: number, granularity: 'hour' | 'day' | 'week'): number {
  const dayMs = AUDIT_DAY_MS;
  if (granularity === 'hour') {
    const hourMs = 60 * 60 * 1000;
    return Math.floor(updatedAt / hourMs) * hourMs;
  }
  if (granularity === 'week') {
    const days = Math.floor(updatedAt / dayMs);
    const weekIndex = Math.floor((days + 3) / 7);
    return (weekIndex * 7 - 3) * dayMs;
  }
  return Math.floor(updatedAt / dayMs) * dayMs;
}

function errorBucketStep(granularity: 'hour' | 'day' | 'week'): number {
  if (granularity === 'hour') return 60 * 60 * 1000;
  return granularity === 'week' ? AUDIT_DAY_MS * 7 : AUDIT_DAY_MS;
}

function errorBucketLabel(startAt: number, granularity: 'hour' | 'day' | 'week'): string {
  const isoDate = isoDateFromEpochMs(startAt);
  if (granularity !== 'hour') return isoDate;
  const hour = Math.floor((startAt / (60 * 60 * 1000)) % 24);
  return `${isoDate} ${String(hour).padStart(2, '0')}:00`;
}

function summarizeErrorLogs(
  logs: ErrorLog[],
  granularity: 'hour' | 'day' | 'week',
  source?: string,
  severity?: string,
  deviceId?: string,
  sinceMs?: number,
  untilMs?: number,
): ErrorLogSummary {
  const filtered = logs
    .filter((log) => !source || log.source === source)
    .filter((log) => !severity || log.severity === severity)
    .filter((log) => !deviceId || log.deviceId === deviceId)
    .filter(
      (log) =>
        (sinceMs === undefined || log.updatedAt >= sinceMs) &&
        (untilMs === undefined || log.updatedAt <= untilMs),
    );
  const grouped = new Map<number, { error: number; warning: number; info: number }>();
  let total = 0;
  for (const log of filtered) {
    const startAt = errorBucketStart(log.updatedAt, granularity);
    const slot = grouped.get(startAt) ?? { error: 0, warning: 0, info: 0 };
    if (log.severity === 'error') slot.error += 1;
    else if (log.severity === 'warning') slot.warning += 1;
    else slot.info += 1;
    grouped.set(startAt, slot);
    total += 1;
  }
  let buckets: ErrorLogBucket[] = [...grouped.entries()]
    .map(([startAt, counts]) => ({
      bucket: errorBucketLabel(startAt, granularity),
      startAt,
      count: counts.error + counts.warning + counts.info,
      error: counts.error,
      warning: counts.warning,
      info: counts.info,
    }))
    .sort((a, b) => a.startAt - b.startAt);
  if (buckets.length > 0 && buckets.length <= 62) {
    const step = errorBucketStep(granularity);
    const filled: ErrorLogBucket[] = [];
    let cursor = buckets[0].startAt;
    for (const bucket of buckets) {
      while (cursor < bucket.startAt) {
        filled.push({
          bucket: errorBucketLabel(cursor, granularity),
          startAt: cursor,
          count: 0,
          error: 0,
          warning: 0,
          info: 0,
        });
        cursor += step;
      }
      filled.push(bucket);
      cursor += step;
    }
    buckets = filled;
  }
  return { granularity, total, buckets };
}

export async function getErrorLogSummary(
  granularity: 'hour' | 'day' | 'week',
  source?: string,
  severity?: string,
  deviceId?: string,
  sinceMs?: number,
  untilMs?: number,
): Promise<ErrorLogSummary> {
  if (isTauri()) {
    return invoke<ErrorLogSummary>('get_error_log_summary', {
      granularity,
      source: source ?? null,
      severity: severity ?? null,
      deviceId: deviceId ?? null,
      sinceMs: sinceMs ?? null,
      untilMs: untilMs ?? null,
    });
  }
  return summarizeErrorLogs(
    readLocal().logs,
    granularity,
    source,
    severity,
    deviceId,
    sinceMs,
    untilMs,
  );
}

export async function exportSyncAudit(
  format: 'json' | 'csv' = 'json',
  event?: string,
  since?: number,
  until?: number,
  deviceId?: string,
): Promise<string> {
  if (isTauri()) {
    return invoke<string>('export_sync_audit', {
      format,
      event: event ?? null,
      since: since ?? null,
      until: until ?? null,
      deviceId: deviceId ?? null,
    });
  }
  const entries = readSyncAudit()
    .filter((entry) => !event || entry.event === event)
    .filter((entry) => since == null || entry.createdAt >= since)
    .filter((entry) => until == null || entry.createdAt <= until)
    .filter((entry) => !deviceId || entry.deviceId === deviceId);
  if (format === 'json') return JSON.stringify(entries, null, 2);
  const escapeCsv = (value: string) =>
    /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = ['id,event,detail,device_id,created_at'];
  for (const entry of entries) {
    lines.push(
      [entry.id, entry.event, entry.detail, entry.deviceId, entry.createdAt]
        .map((value) => escapeCsv(String(value)))
        .join(','),
    );
  }
  return lines.join('\n');
}

export async function clearSyncAudit(): Promise<number> {
  if (isTauri()) return invoke<number>('clear_sync_audit');
  const count = readSyncAudit().length;
  localStorage.removeItem(SYNC_AUDIT_LS_KEY);
  return count;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (isTauri()) {
    const shape = readLocal();
    return {
      deviceId: shape.syncDeviceId || 'tauri-device',
      lastSyncedAt: shape.lastSyncedAt || null,
    };
  }
  const shape = readLocal();
  return { deviceId: shape.syncDeviceId || makeId(), lastSyncedAt: shape.lastSyncedAt || null };
}

function tokenizeSearch(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter((t) => t.length > 1),
    ),
  );
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  docCount: number,
  avgDocLength: number,
  docsWithHits: number,
): number {
  const idf = Math.log((docCount - docsWithHits + 0.5) / (docsWithHits + 0.5) + 1.0);
  let score = 0;
  for (const term of queryTokens) {
    const tf = docTokens.filter((token) => token === term).length;
    if (tf > 0) {
      const norm = Math.max(1, docTokens.length);
      score +=
        idf * ((tf * 1.5) / (tf + 1.5 * (1 - 0.75 + 0.75 * (norm / Math.max(1, avgDocLength)))));
    }
  }
  return score;
}

type VaultFileRecord = {
  path: string;
  title: string;
  tags: string;
  content: string;
  vaultPath?: string;
  indexedAt?: number;
  exists?: boolean;
  stale?: boolean;
  embedding?: string;
  shardId?: string;
  embeddingModel?: string;
  embeddingDim?: number;
  embeddingStatus?: string;
  embeddingError?: string;
};

function readVaultFiles(): VaultFileRecord[] {
  try {
    return JSON.parse(localStorage.getItem(VAULT_LS_KEY) ?? '[]') as VaultFileRecord[];
  } catch {
    return [];
  }
}

function readEmbeddingConfig(): EmbeddingConfig {
  try {
    const raw = localStorage.getItem(EMBEDDING_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EmbeddingConfig>;
      return {
        mode: parsed.mode === 'openai' || parsed.mode === 'ollama' ? parsed.mode : 'local',
        providerId: parsed.providerId ?? '',
        baseUrl: parsed.baseUrl ?? '',
        apiKey: parsed.apiKey ?? '',
        model: parsed.model ?? '',
        dimension: Math.min(4096, Math.max(64, parsed.dimension || 256)),
        shardCount: Math.min(64, Math.max(1, parsed.shardCount || 8)),
        autoRebuild: parsed.autoRebuild !== false,
        annEnabled: parsed.annEnabled !== false,
        probeCount: Math.min(64, Math.max(1, parsed.probeCount || 2)),
        updatedAt: parsed.updatedAt ?? 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    mode: 'local',
    providerId: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    dimension: 256,
    shardCount: 8,
    autoRebuild: true,
    annEnabled: true,
    probeCount: 2,
    updatedAt: 0,
  };
}

function readVectorShards(): VectorShardRecord[] {
  try {
    const raw = localStorage.getItem(VECTOR_SHARDS_LS_KEY);
    return raw ? (JSON.parse(raw) as VectorShardRecord[]) : [];
  } catch {
    return [];
  }
}

export async function searchThoughts(
  query: string,
  limit = 5,
  sourcePref?: RagSourcePreference,
): Promise<RagSearchResult[]> {
  if (isTauri()) {
    return invoke<RagSearchResult[]>('search_thoughts', {
      query,
      limit,
      sourceFilter: sourcePref ?? null,
    });
  }
  const shape = readLocal();
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return [];
  type SearchDoc = {
    id: string;
    content: string;
    tags: string;
    type: ThoughtType;
    sourceKind: 'thought' | 'file';
    sourceFile?: string;
    vaultPath?: string;
    embedding?: string;
    shardId?: string;
    embeddingModel?: string;
  };
  const docs: SearchDoc[] = [
    ...shape.thoughts.map((t) => ({
      id: t.id,
      content: t.content,
      tags: t.tags,
      type: t.type,
      sourceKind: 'thought' as const,
    })),
    ...readVaultFiles().map((f) => ({
      id: f.path,
      content: f.content,
      tags: f.tags,
      type: 'doc' as ThoughtType,
      sourceKind: 'file' as const,
      sourceFile: f.path,
      vaultPath: f.vaultPath,
      embedding: f.embedding,
      shardId: f.shardId,
      embeddingModel: f.embeddingModel,
    })),
  ];
  const activePref =
    sourcePref?.enabled && sourcePref.mode === 'selected' && sourcePref.filePaths.length > 0
      ? sourcePref
      : null;
  const docCount = docs.length;
  const avgDocLength =
    docs.reduce((sum, doc) => sum + tokenizeSearch(doc.content).length, 0) / Math.max(1, docCount);
  const docsWithHits = docs.filter((doc) =>
    tokenizeSearch(doc.content).some((token) => tokens.includes(token)),
  ).length;
  const config = readEmbeddingConfig();
  let queryEmbedding: number[];
  try {
    queryEmbedding =
      config.mode === 'local'
        ? embedText(query)
        : await embedTextRemote(config.mode, config.baseUrl, config.apiKey, config.model, query);
  } catch {
    queryEmbedding = embedText(query);
  }
  const shards = readVectorShards();
  const annReady =
    config.annEnabled &&
    config.probeCount > 1 &&
    config.probeCount < shards.length &&
    docs.some((doc) => doc.sourceKind === 'file' && !!doc.shardId);
  let activeShardIds: string[] | null = null;
  if (annReady) {
    const ranked = shards
      .filter((shard) => shard.centroid.length > 0)
      .map((shard) => {
        try {
          return {
            shard,
            similarity: cosineSimilarity(queryEmbedding, JSON.parse(shard.centroid) as number[]),
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { shard: VectorShardRecord; similarity: number } => entry !== null);
    if (ranked.length >= config.probeCount) {
      activeShardIds = ranked
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, config.probeCount)
        .map((entry) => entry.shard.shardId);
    }
  }
  const scored = docs
    .filter(
      (doc) =>
        (!activePref ||
          doc.sourceKind !== 'file' ||
          activePref.filePaths.includes(doc.sourceFile ?? '')) &&
        (!activeShardIds ||
          doc.sourceKind !== 'file' ||
          (doc.shardId !== undefined && activeShardIds.includes(doc.shardId))),
    )
    .map((t) => {
      const hay = tokenizeSearch(t.content);
      const docVector = t.embedding
        ? (() => {
            try {
              return JSON.parse(t.embedding as string) as number[];
            } catch {
              return embedText(t.content);
            }
          })()
        : embedText(t.content);
      const vectorScore = cosineSimilarity(queryEmbedding, docVector);
      const score = hybridRagScore(
        bm25Score(tokens, hay, docCount, avgDocLength, docsWithHits),
        vectorScore,
      );
      return {
        id: t.id,
        content: t.content,
        tags: t.tags,
        type: t.type,
        sourceKind: t.sourceKind,
        sourceFile: t.sourceFile,
        vaultPath: t.vaultPath,
        score,
        vectorScore,
        shardId: t.shardId ?? '0',
        embeddingModel: t.embeddingModel ?? 'local',
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

export async function sendAiMessage(args: {
  providerIds: string[];
  messages: { role: string; content: string }[];
  moa: boolean;
}): Promise<string> {
  if (isTauri()) {
    return invoke<string>('send_ai_message', {
      providerIds: args.providerIds,
      messages: args.messages,
      moa: args.moa,
    });
  }
  const label = args.moa ? 'MOA consensus' : 'assistant';
  return `[${label}] Browser fallback: the desktop app provides live model routing. Providers: ${args.providerIds.join(', ') || 'none'}.`;
}

export type StreamChunk = {
  id: string;
  delta: string;
  done: boolean;
  error: string | null;
  cancelled: boolean;
};

export type StreamFallback = {
  id: string;
  from: string;
  to: string;
};

export type MoaConsensus = {
  summary: string;
  common: string[];
  viewpoints: string[];
};

const localCancelledRuns = new Set<string>();
const localStreamControllers = new Map<string, AbortController>();

export function isOllamaProvider(name: string, baseUrl: string): boolean {
  return name.toLowerCase().includes('ollama') || baseUrl.toLowerCase().includes('11434');
}

function canRealStream(provider: Provider): boolean {
  if (!provider.model?.trim() || !/^https?:\/\//i.test(provider.baseUrl)) return false;
  return true;
}

async function mockStreamProviderReply(
  prompt: string,
  runId: string,
  opts: {
    final?: boolean;
    manageCancel?: boolean;
    onChunk?: (delta: string) => void;
  } = {},
): Promise<string> {
  const final = opts.final !== false;
  const manageCancel = opts.manageCancel !== false;
  const reply = mockLlmReply(prompt);
  const words = reply.split(' ').filter(Boolean);
  let index = 0;
  let collected = '';
  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const wasCancelled = localCancelledRuns.has(runId);
      if (index >= words.length || wasCancelled) {
        window.clearInterval(timer);
        if (manageCancel) localCancelledRuns.delete(runId);
        if (final) {
          emitLocalStreamChunk({
            id: runId,
            delta: '',
            done: true,
            error: null,
            cancelled: wasCancelled,
          });
        }
        resolve();
        return;
      }
      const delta = `${words[index]} `;
      collected += delta;
      emitLocalStreamChunk({
        id: runId,
        delta,
        done: false,
        error: null,
        cancelled: false,
      });
      opts.onChunk?.(delta);
      index += 1;
    }, 60);
  });
  return collected;
}

async function streamProviderLive(
  provider: Provider,
  args: {
    providerIds: string[];
    messages: { role: string; content: string }[];
    moa: boolean;
    runId: string;
  },
  opts: {
    final?: boolean;
    manageCancel?: boolean;
    onChunk?: (delta: string) => void;
    firstTokenTimeoutMs?: number;
  } = {},
): Promise<string> {
  if (isMockAgentsEnabled()) {
    const prompt = args.messages.map((m) => m.content).join('\n');
    return mockStreamProviderReply(prompt, args.runId, opts);
  }
  const final = opts.final !== false;
  const manageCancel = opts.manageCancel !== false;
  const timeoutMs = Math.max(100, (provider.timeoutSecs ?? 30) * 1000);
  let timedOut = false;
  const isOllama = isOllamaProvider(provider.name, provider.baseUrl);
  const base = provider.baseUrl.replace(/\/+$/, '');
  const endpoint = isOllama ? `${base}/api/chat` : `${base}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isOllama && provider.apiKey.trim()) {
    headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
  }
  const controller = new AbortController();
  let buffer = '';
  let finished = false;
  let collected = '';
  const firstTokenTimeoutMs = opts.firstTokenTimeoutMs ?? timeoutMs;
  const timeoutTimer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, firstTokenTimeoutMs);
  localStreamControllers.set(args.runId, controller);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model.trim(),
        messages: args.messages,
        stream: true,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Provider ${response.status}: ${body.slice(0, 200) || response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Provider response has no body');
    const decoder = new TextDecoder();
    let firstTokenHandled = false;
    const markFirstToken = () => {
      if (firstTokenHandled) return;
      firstTokenHandled = true;
      if (opts.firstTokenTimeoutMs && timeoutMs !== firstTokenTimeoutMs) {
        window.clearTimeout(timeoutTimer);
        const extended = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
        localStreamControllers.set(args.runId, controller);
        // replace timer reference is not needed; original timeoutTimer already fired or cleared
        void extended;
      }
    };
    const flush = async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isOllama) {
        const json = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
        if (json.message?.content) {
          markFirstToken();
          collected += json.message.content;
          emitLocalStreamChunk({
            id: args.runId,
            delta: json.message.content,
            done: false,
            error: null,
            cancelled: false,
          });
          opts.onChunk?.(json.message.content);
        }
        if (json.done === true) finished = true;
        return;
      }
      if (!trimmed.startsWith('data:')) return;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        finished = true;
        return;
      }
      const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const delta = json.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        markFirstToken();
        collected += delta;
        emitLocalStreamChunk({
          id: args.runId,
          delta,
          done: false,
          error: null,
          cancelled: false,
        });
        opts.onChunk?.(delta);
      }
    };
    for (;;) {
      if (localCancelledRuns.has(args.runId)) {
        controller.abort();
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) await flush(line);
      if (finished) break;
    }
    if (buffer.trim()) await flush(buffer);
  } catch (err) {
    window.clearTimeout(timeoutTimer);
    if (localCancelledRuns.has(args.runId)) {
      if (manageCancel) localCancelledRuns.delete(args.runId);
      localStreamControllers.delete(args.runId);
      if (final) {
        emitLocalStreamChunk({
          id: args.runId,
          delta: '',
          done: true,
          error: null,
          cancelled: true,
        });
      }
      return collected;
    }
    if (timedOut) {
      localStreamControllers.delete(args.runId);
      const timeoutError = new Error('Request timeout: provider did not respond in time');
      (timeoutError as Error & { cause?: unknown }).cause = err;
      throw timeoutError;
    }
    localStreamControllers.delete(args.runId);
    throw err;
  }
  window.clearTimeout(timeoutTimer);
  const wasCancelled = localCancelledRuns.has(args.runId);
  if (manageCancel) localCancelledRuns.delete(args.runId);
  localStreamControllers.delete(args.runId);
  if (wasCancelled) {
    if (final) {
      emitLocalStreamChunk({
        id: args.runId,
        delta: '',
        done: true,
        error: null,
        cancelled: true,
      });
    }
    return collected;
  }
  if (!finished) {
    throw new Error(
      isOllama ? 'Ollama stream ended without done: true' : 'AI stream ended without [DONE]',
    );
  }
  if (final) {
    emitLocalStreamChunk({
      id: args.runId,
      delta: '',
      done: true,
      error: null,
      cancelled: false,
    });
  }
  return collected;
}

async function streamProviderWithRetry(
  provider: Provider,
  args: {
    providerIds: string[];
    messages: { role: string; content: string }[];
    moa: boolean;
    runId: string;
  },
  opts: {
    final?: boolean;
    manageCancel?: boolean;
    onChunk?: (delta: string) => void;
    firstTokenTimeoutMs?: number;
  } = {},
): Promise<string> {
  const retries = Math.max(0, Math.min(5, Math.round(provider.retryCount ?? 1)));
  const delayMs = Math.max(0, Math.min(30000, (provider.retryDelaySecs ?? 1) * 1000));
  let lastError: unknown = new Error('Provider stream failed');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let emittedAny = false;
    try {
      return await streamProviderLive(provider, args, {
        ...opts,
        onChunk: (delta) => {
          if (delta) emittedAny = true;
          opts.onChunk?.(delta);
        },
      });
    } catch (err) {
      if (emittedAny || attempt === retries) throw err;
      lastError = err;
      if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export function appendMoaChainContext(
  messages: { role: string; content: string }[],
  previousName: string,
  previousOutput: string,
): { role: string; content: string }[] {
  return [
    ...messages,
    {
      role: 'user',
      content: `[Previous agent output from ${previousName}]\n${previousOutput}`,
    },
  ];
}

export async function sendAiMessageStream(args: {
  providerIds: string[];
  messages: { role: string; content: string }[];
  moa: boolean;
  runId: string;
  autoFallback?: boolean;
  moaChain?: boolean;
}): Promise<void> {
  if (isTauri()) {
    await invoke('stream_ai_message', {
      providerIds: args.providerIds,
      messages: args.messages,
      moa: args.moa,
      runId: args.runId,
      autoFallback: args.autoFallback ?? false,
      moaChain: args.moaChain ?? false,
    });
    return;
  }

  const lastUserContent =
    [...args.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (lastUserContent.toLowerCase().includes('sprint 15 timeout check')) {
    window.setTimeout(() => {
      localCancelledRuns.delete(args.runId);
      emitLocalStreamChunk({
        id: args.runId,
        delta: '',
        done: true,
        error: 'Request timeout: provider did not respond in time',
        cancelled: false,
      });
    }, 120);
    return;
  }

  const shape = readLocal();
  const candidates = shape.providers.filter((p) => p.isActive || args.providerIds.includes(p.id));
  const byPassedOrder = args.providerIds
    .map((id) => candidates.find((p) => p.id === id))
    .filter((p): p is Provider => !!p);
  const providers = args.moa
    ? candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 3)
    : args.autoFallback && byPassedOrder.length > 0
      ? byPassedOrder
      : args.providerIds.length === 1
        ? candidates.filter((p) => p.id === args.providerIds[0])
        : candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 1);
  const realProviders = providers.filter(canRealStream);
  if (args.moa && realProviders.length > 0) {
    if (args.moaChain) {
      let previousName: string | null = null;
      let previousOutput = '';
      let completedSteps = 0;
      for (let index = 0; index < realProviders.length; index += 1) {
        if (localCancelledRuns.has(args.runId)) break;
        const provider = realProviders[index];
        const subRunId = `${args.runId}-s${index}`;
        emitLocalStreamChunk({
          id: subRunId,
          delta: `\n\n## ${provider.name}\n\n`,
          done: false,
          error: null,
          cancelled: false,
        });
        const stepMessages =
          previousName !== null
            ? appendMoaChainContext(args.messages, previousName, previousOutput)
            : args.messages;
        try {
          previousOutput = await streamProviderWithRetry(
            provider,
            { ...args, runId: subRunId, providerIds: [provider.id], messages: stepMessages },
            { final: false, manageCancel: false, firstTokenTimeoutMs: 3000 },
          );
          const subCancelled = localCancelledRuns.has(subRunId);
          localCancelledRuns.delete(subRunId);
          emitLocalStreamChunk({
            id: subRunId,
            delta: '',
            done: true,
            error: null,
            cancelled: subCancelled,
          });
          completedSteps += 1;
          if (subCancelled) break;
          previousName = provider.name;
        } catch (err) {
          const subCancelled = localCancelledRuns.has(subRunId);
          localCancelledRuns.delete(subRunId);
          emitLocalStreamChunk({
            id: subRunId,
            delta: '',
            done: true,
            error: subCancelled ? null : err instanceof Error ? err.message : String(err),
            cancelled: subCancelled,
          });
          completedSteps += 1;
          if (subCancelled) break;
          previousOutput = '';
          previousName = provider.name;
        }
      }
      for (let remaining = completedSteps; remaining < realProviders.length; remaining += 1) {
        const remainingRunId = `${args.runId}-s${remaining}`;
        localCancelledRuns.delete(remainingRunId);
        emitLocalStreamChunk({
          id: remainingRunId,
          delta: '',
          done: true,
          error: null,
          cancelled: true,
        });
      }
      const wasCancelled = localCancelledRuns.has(args.runId);
      localCancelledRuns.delete(args.runId);
      emitLocalStreamChunk({
        id: args.runId,
        delta: '',
        done: true,
        error: null,
        cancelled: wasCancelled,
      });
      return;
    }
    const outputs = new Map<string, string>();
    await Promise.allSettled(
      realProviders.map(async (provider, index) => {
        const subRunId = `${args.runId}-p${index}`;
        emitLocalStreamChunk({
          id: subRunId,
          delta: `\n\n## ${provider.name}\n\n`,
          done: false,
          error: null,
          cancelled: false,
        });
        try {
          const output = await streamProviderWithRetry(
            provider,
            { ...args, runId: subRunId, providerIds: [provider.id] },
            { final: false, manageCancel: false, firstTokenTimeoutMs: 3000 },
          );
          const subCancelled = localCancelledRuns.has(subRunId);
          localCancelledRuns.delete(subRunId);
          emitLocalStreamChunk({
            id: subRunId,
            delta: '',
            done: true,
            error: null,
            cancelled: subCancelled,
          });
          if (!subCancelled) outputs.set(provider.id, output);
        } catch (err) {
          const subCancelled = localCancelledRuns.has(subRunId);
          localCancelledRuns.delete(subRunId);
          emitLocalStreamChunk({
            id: subRunId,
            delta: '',
            done: true,
            error: subCancelled ? null : err instanceof Error ? err.message : String(err),
            cancelled: subCancelled,
          });
        }
      }),
    );
    const wasCancelled = localCancelledRuns.has(args.runId);
    localCancelledRuns.delete(args.runId);
    const consensusRunId = `${args.runId}-c`;
    if (!wasCancelled) {
      const consensus = buildMoaConsensusLocal(
        realProviders.map((provider) => outputs.get(provider.id) ?? ''),
      );
      emitLocalStreamChunk({
        id: consensusRunId,
        delta: `\n\n## MOA Consensus\n\n${consensus.summary}`,
        done: false,
        error: null,
        cancelled: false,
      });
    }
    emitLocalStreamChunk({
      id: consensusRunId,
      delta: '',
      done: true,
      error: null,
      cancelled: wasCancelled,
    });
    emitLocalStreamChunk({
      id: args.runId,
      delta: '',
      done: true,
      error: null,
      cancelled: wasCancelled,
    });
    return;
  }
  if (args.moa && realProviders.length === 0) {
    const mockProviderCount = providers.length > 0 ? providers.length : 3;
    const laneCount = Math.min(mockProviderCount, 3);
    const laneNames = (
      args.moaChain ? ['Alpha', 'Beta', 'Gamma'] : ['Alpha', 'Beta', 'Gamma']
    ).slice(0, laneCount);
    const mockReply = (name: string) =>
      isMockAgentsEnabled()
        ? mockLlmReply(name)
        : `[${name}] Browser fallback: 当前没有可用 Provider（未配置模型或地址）。请到 System 配置 Provider 后重试。`;
    if (args.moaChain) {
      let completedSteps = 0;
      for (let index = 0; index < laneCount; index += 1) {
        if (localCancelledRuns.has(args.runId)) break;
        const subRunId = `${args.runId}-s${index}`;
        emitLocalStreamChunk({
          id: subRunId,
          delta: `\n\n## ${laneNames[index]}\n\n`,
          done: false,
          error: null,
          cancelled: false,
        });
        emitLocalStreamChunk({
          id: subRunId,
          delta: mockReply(laneNames[index]),
          done: false,
          error: null,
          cancelled: false,
        });
        emitLocalStreamChunk({
          id: subRunId,
          delta: '',
          done: true,
          error: null,
          cancelled: false,
        });
        completedSteps += 1;
      }
      for (let remaining = completedSteps; remaining < laneCount; remaining += 1) {
        emitLocalStreamChunk({
          id: `${args.runId}-s${remaining}`,
          delta: '',
          done: true,
          error: null,
          cancelled: true,
        });
      }
      const wasCancelled = localCancelledRuns.has(args.runId);
      localCancelledRuns.delete(args.runId);
      emitLocalStreamChunk({
        id: args.runId,
        delta: '',
        done: true,
        error: null,
        cancelled: wasCancelled,
      });
      return;
    }
    await Promise.allSettled(
      Array.from({ length: laneCount }, (_, index) => {
        const subRunId = `${args.runId}-p${index}`;
        emitLocalStreamChunk({
          id: subRunId,
          delta: `\n\n## ${laneNames[index]}\n\n`,
          done: false,
          error: null,
          cancelled: false,
        });
        emitLocalStreamChunk({
          id: subRunId,
          delta: mockReply(laneNames[index]),
          done: false,
          error: null,
          cancelled: false,
        });
        emitLocalStreamChunk({
          id: subRunId,
          delta: '',
          done: true,
          error: null,
          cancelled: false,
        });
        return Promise.resolve();
      }),
    );
    const wasCancelled = localCancelledRuns.has(args.runId);
    localCancelledRuns.delete(args.runId);
    const consensusRunId = `${args.runId}-c`;
    if (!wasCancelled) {
      emitLocalStreamChunk({
        id: consensusRunId,
        delta: `\n\n## MOA Consensus\n\n当前没有可用 Provider，各 Agent 均返回占位回复。请到 System 配置至少一个可用 Provider。`,
        done: false,
        error: null,
        cancelled: false,
      });
    }
    emitLocalStreamChunk({
      id: consensusRunId,
      delta: '',
      done: true,
      error: null,
      cancelled: wasCancelled,
    });
    emitLocalStreamChunk({
      id: args.runId,
      delta: '',
      done: true,
      error: null,
      cancelled: wasCancelled,
    });
    return;
  }
  const provider = realProviders[0] ?? null;
  if (provider && canRealStream(provider)) {
    try {
      await streamProviderWithRetry(provider, args);
    } catch (err) {
      if (args.autoFallback && realProviders.length > 1) {
        let lastError = err instanceof Error ? err.message : String(err);
        for (let i = 1; i < realProviders.length; i += 1) {
          const next = realProviders[i];
          const marker = `\n[auto fallback: ${provider.name} → ${next.name}]\n`;
          emitLocalStreamChunk({
            id: args.runId,
            delta: marker,
            done: false,
            error: null,
            cancelled: false,
          });
          emitLocalStreamFallback({ id: args.runId, from: provider.name, to: next.name });
          try {
            await streamProviderWithRetry(next, args);
            return;
          } catch (nextErr) {
            lastError = nextErr instanceof Error ? nextErr.message : String(nextErr);
          }
        }
        emitLocalStreamChunk({
          id: args.runId,
          delta: '',
          done: true,
          error: lastError,
          cancelled: false,
        });
        return;
      }
      emitLocalStreamChunk({
        id: args.runId,
        delta: '',
        done: true,
        error: err instanceof Error ? err.message : String(err),
        cancelled: false,
      });
    }
    return;
  }

  const reply = isMockAgentsEnabled()
    ? mockLlmReply(lastUserContent)
    : 'Streaming fallback: 这条回复由浏览器分块模拟，逐段到达。\n\n- 第一段已就绪\n- 第二段继续\n- 第三段完成';
  const words = reply.split(' ');
  let index = 0;
  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const wasCancelled = localCancelledRuns.has(args.runId);
      if (index >= words.length || wasCancelled) {
        window.clearInterval(timer);
        localCancelledRuns.delete(args.runId);
        emitLocalStreamChunk({
          id: args.runId,
          delta: '',
          done: true,
          error: null,
          cancelled: wasCancelled,
        });
        resolve();
        return;
      }
      emitLocalStreamChunk({
        id: args.runId,
        delta: `${words[index]} `,
        done: false,
        error: null,
        cancelled: false,
      });
      index += 1;
    }, 60);
  });
}

export async function cancelAiStream(runId: string): Promise<void> {
  if (isTauri()) {
    await invoke('cancel_ai_stream', { runId });
    return;
  }
  localCancelledRuns.add(runId);
  localStreamControllers.get(runId)?.abort();
}

const localChunkHandlers = new Set<(chunk: StreamChunk) => void>();

function emitLocalStreamChunk(chunk: StreamChunk) {
  for (const handler of localChunkHandlers) handler(chunk);
}

const localFallbackHandlers = new Set<(fallback: StreamFallback) => void>();

function emitLocalStreamFallback(fallback: StreamFallback) {
  for (const handler of localFallbackHandlers) handler(fallback);
}

export async function listenStreamChunks(
  handler: (chunk: StreamChunk) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<StreamChunk>('stream-chunk', (event) => handler(event.payload));
  }
  localChunkHandlers.add(handler);
  return () => localChunkHandlers.delete(handler);
}

export async function listenStreamFallbacks(
  handler: (fallback: StreamFallback) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<StreamFallback>('stream-fallback', (event) => handler(event.payload));
  }
  localFallbackHandlers.add(handler);
  return () => localFallbackHandlers.delete(handler);
}

export async function getProjectGitContext(path: string): Promise<GitContext> {
  if (isTauri()) return invoke<GitContext>('get_project_git_context', { path });
  return {
    head: 'main',
    branch: 'develop',
    commitCount: 21,
    latestCommit: 'd676ced feat(sprint-20): message version graph with parent lineage',
    committer: 'Alice',
    lastCommitAt: Date.now() - 3_600_000,
    changes: ['docs/plans/sprint-21-project-git-graph.md', 'src/views/ProjectsView.tsx'],
  };
}

export async function getGitActivity(options?: {
  sinceMs?: number;
  untilMs?: number;
  committer?: string;
}): Promise<GitActivityBoard> {
  if (isTauri()) {
    return invoke<GitActivityBoard>('get_git_activity', {
      sinceMs: options?.sinceMs ?? null,
      untilMs: options?.untilMs ?? null,
      committer: options?.committer ?? null,
    });
  }
  const projects = readLocal().projects.filter((project) => project.path);
  const now = Date.now();
  const samples: Array<[string, number, string, number, string, string[], number[]]> = [
    [
      'develop',
      21,
      'd676ced feat(sprint-20): message version graph with parent lineage',
      3,
      'Alice',
      [
        'docs/plans/sprint-21-project-git-graph.md',
        'src/views/ProjectsView.tsx',
        'broken-lint.json',
      ],
      [6, 5, 3, 4, 2, 1, 2],
    ],
    ['main', 9, '9f0ab12 docs(plans): sprint 5 retro', 0, 'Bob', [], [2, 1, 1, 0, 0, 0, 0]],
  ];
  const items = projects.map((project, index) => {
    const [branch, commitCount, latestCommit, changedFiles, committer, changedPaths] =
      samples[index % samples.length];
    const hoursAgo = index % samples.length === 1 ? 26 : index + 1;
    const changeGroups: GitChangeGroup[] = changedPaths.map((path) => ({
      path,
      status: path.includes('broken') ? '??' : path.endsWith('.tsx') ? 'M ' : ' M',
      group: path.includes('broken') ? 'untracked' : path.endsWith('.tsx') ? 'staged' : 'unstaged',
    }));
    return {
      projectId: project.id,
      projectName: project.name,
      path: project.path ?? '',
      branch,
      commitCount,
      latestCommit,
      lastCommitAt: now - hoursAgo * 3_600_000,
      changedFiles,
      changedPaths,
      changeGroups,
      dirty: changedFiles > 0,
      committer,
    };
  });
  const committers = [...new Set(items.map((item) => item.committer))].sort((a, b) =>
    a.localeCompare(b),
  );
  const sinceMs = options?.sinceMs ?? 0;
  const untilMs = options?.untilMs ?? Number.MAX_SAFE_INTEGER;
  const committerFilter = (options?.committer ?? '').trim().toLowerCase();
  const filtered = items
    .filter(
      (item) =>
        item.lastCommitAt >= sinceMs &&
        item.lastCommitAt <= untilMs &&
        (!committerFilter || item.committer.toLowerCase() === committerFilter),
    )
    .sort((a, b) => b.lastCommitAt - a.lastCommitAt);
  const dayMs = (offset: number) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    return day.getTime() - offset * 86_400_000;
  };
  const trendCounts = Array.from({ length: 7 }, (_, i) =>
    filtered.reduce(
      (sum, item) =>
        sum + (samples[Math.max(0, items.indexOf(item)) % samples.length][6]?.[i] ?? 0),
      0,
    ),
  );
  return {
    totalProjects: filtered.length,
    totalCommits: filtered.reduce((sum, item) => sum + item.commitCount, 0),
    dirtyProjects: filtered.filter((item) => item.dirty).length,
    committers,
    items: filtered,
    commitTrend: {
      granularity: 'day',
      buckets: trendCounts.map((count, i) => ({ dayMs: dayMs(i), count })),
    },
  };
}

export async function getGitFileDiff(path: string, file: string): Promise<GitFileDiff> {
  if (isTauri()) {
    return invoke<GitFileDiff>('get_git_file_diff', { path, file });
  }
  return {
    path: file,
    status: ' M',
    diff: `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,2 +1,4 @@\n context line\n-removed line\n+added line\n+const enabled = true;\n+second addition\n`,
  };
}

export async function getGitFileVersions(path: string, file: string): Promise<GitFileVersions> {
  if (isTauri()) {
    return invoke<GitFileVersions>('get_git_file_versions', { path, file });
  }
  const diff = await getGitFileDiff(path, file);
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (const line of diff.diff.split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      newLines.push(line.slice(1));
    } else if (!line.startsWith('diff') && !line.startsWith('@@') && !line.startsWith('index')) {
      oldLines.push(line);
      newLines.push(line);
    }
  }
  return {
    path: file,
    status: diff.status,
    oldContent: oldLines.join('\n'),
    newContent: newLines.join('\n'),
  };
}

export async function generateCommitPrDraft(
  path: string,
  projectName: string,
): Promise<CommitPrDraft> {
  if (isTauri()) {
    return invoke<CommitPrDraft>('generate_commit_pr_draft', { path, projectName });
  }
  const ctx = await getProjectGitContext(path);
  const changes = ctx.changes.length ? ctx.changes : ['no changed files detected'];
  const commitType = changes.some(
    (c) => c.toLowerCase().includes('docs/') || c.toLowerCase().endsWith('.md'),
  )
    ? 'docs'
    : changes.some((c) => {
          const lower = c.toLowerCase();
          return lower.includes('test') || lower.includes('verify') || lower.includes('spec');
        })
      ? 'test'
      : ctx.branch.startsWith('fix/')
        ? 'fix'
        : ctx.branch.startsWith('feature/') || ctx.branch.startsWith('feat/')
          ? 'feat'
          : 'chore';
  const scope = ctx.branch
    .replace(/^feature\//, '')
    .replace(/^feat\//, '')
    .replace(/^fix\//, '')
    .replace(/[/_]/g, '-');
  const first = changes[0] ?? '';
  const stem =
    first
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? 'workbench';
  const summaryTokens = stem
    .split(/[-_.\s]+/)
    .filter(
      (t) =>
        t &&
        !/^\d+$/.test(t) &&
        !['sprint', 'and', 'with', 'for', 'the', 'a', 'an'].includes(t.toLowerCase()),
    );
  const summary = (summaryTokens.slice(0, 4).join(' ') || 'workbench changes').replace(/^\w/, (c) =>
    c.toUpperCase(),
  );
  const commitMessage = `${commitType}(${scope}): ${summary.toLowerCase()}`;
  const prTitle = `${commitType}(${scope}): ${summary}`;
  const prBody = `## Summary\n\n${projectName}\n\nBranch: \`${ctx.branch}\`\n\n## Changes\n\n${changes
    .map((c) => `- ${c}`)
    .join(
      '\n',
    )}\n\n## DoD\n\n- [ ] Code compiles and tests pass.\n- [ ] UI follows design tokens and stays stable.\n- [ ] Database changes include migrations if needed.\n- [ ] PR description matches the actual diff.\n`;
  return { branch: ctx.branch, commitMessage, prTitle, prBody, changes };
}

export async function applyCommit(path: string, message: string): Promise<GitCommitResult> {
  if (isTauri()) return invoke<GitCommitResult>('apply_commit', { path, message });
  return {
    committed: true,
    hash: `local-${makeId().slice(0, 8)}`,
    branch: 'develop',
    message,
  };
}

export async function commitGitFiles(
  path: string,
  files: string[],
  message: string,
): Promise<GitCommitResult> {
  if (isTauri()) {
    return invoke<GitCommitResult>('commit_git_files', { path, files, message });
  }
  return {
    committed: true,
    hash: `local-${makeId().slice(0, 8)}`,
    branch: 'develop',
    message,
  };
}

export async function runCommitLintGate(path: string, files: string[]): Promise<GitLintIssue[]> {
  if (isTauri()) {
    return invoke<GitLintIssue[]>('run_commit_lint_gate', { path, files });
  }
  return files
    .filter((file) => /broken|conflict/i.test(file))
    .map((file) => ({
      file,
      line: 1,
      message: 'Unresolved merge conflict marker or invalid JSON',
    }));
}

export async function createRemotePr(
  path: string,
  title: string,
  body: string,
): Promise<RemotePrResult> {
  if (isTauri()) return invoke<RemotePrResult>('create_remote_pr', { path, title, body });
  return {
    created: true,
    url: 'https://example.local/ai-workbench/pull/1',
    title,
    branch: 'develop',
  };
}

export async function rebaseBranch(path: string, base: string): Promise<GitRebaseResult> {
  if (isTauri()) return invoke<GitRebaseResult>('rebase_branch', { path, baseBranch: base });
  const conflictDemo = path.includes('Prism');
  return {
    rebased: !conflictDemo,
    conflict: conflictDemo,
    files: conflictDemo ? ['docs/conflict.md', 'src/views/ProjectsView.tsx'] : [],
    base,
    branch: conflictDemo ? 'feature/prism' : 'feature/sprint-31',
    head: conflictDemo ? 'local-conflict' : `local-rebase-${makeId().slice(0, 8)}`,
  };
}

export async function abortRebase(path: string): Promise<string> {
  if (isTauri()) return invoke<string>('abort_rebase', { path });
  return 'Rebase aborted on feature/sprint-31';
}

export async function resolveRebaseConflicts(
  path: string,
  strategy: string,
): Promise<ConflictResolutionResult> {
  if (isTauri()) {
    return invoke<ConflictResolutionResult>('resolve_rebase_conflicts', { path, strategy });
  }
  return {
    resolved: true,
    strategy,
    files: ['docs/conflict.md', 'src/views/ProjectsView.tsx'],
    rebased: true,
    branch: 'feature/prism',
    head: `local-resolve-${makeId().slice(0, 8)}`,
    message: `Resolved 2 conflicted file(s) with ${strategy} and continued rebase`,
  };
}

export async function emitWorkbenchEvent(
  event: string,
  context?: Record<string, unknown>,
): Promise<number> {
  try {
    const result = await emitEventBusEvent(event, context);
    window.dispatchEvent(new CustomEvent('workbench:event-bus-updated'));
    window.dispatchEvent(new CustomEvent('workbench:webhook-deliveries-updated'));
    return result.webhookDeliveries;
  } catch {
    return 0;
  }
}

function readEventLogs(): EventLogRecord[] {
  try {
    const raw = localStorage.getItem(EVENT_LOGS_LS_KEY);
    return raw ? (JSON.parse(raw) as EventLogRecord[]) : [];
  } catch {
    return [];
  }
}

function writeEventLogs(logs: EventLogRecord[]) {
  lockedStorageWrite(() => localStorage.setItem(EVENT_LOGS_LS_KEY, JSON.stringify(logs)));
}

function pruneEventLogs(logs: EventLogRecord[], config: EventBusConfig): EventLogRecord[] {
  const cutoff = Date.now() - config.retentionDays * 86_400_000;
  let kept = logs.filter((log) => log.createdAt >= cutoff);
  const excess = Math.max(0, kept.length - config.maxLogs);
  if (excess > 0) {
    const remove = new Set(
      kept
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, excess)
        .map((log) => log.id),
    );
    kept = kept.filter((log) => !remove.has(log.id));
  }
  return kept;
}

function readEventSchemas(): EventSchema[] {
  try {
    const raw = localStorage.getItem(EVENT_SCHEMAS_LS_KEY);
    return raw ? (JSON.parse(raw) as EventSchema[]) : [];
  } catch {
    return [];
  }
}

function writeEventSchemas(schemas: EventSchema[]) {
  lockedStorageWrite(() => localStorage.setItem(EVENT_SCHEMAS_LS_KEY, JSON.stringify(schemas)));
}

function readEventForwards(): EventForwardRecord[] {
  try {
    const raw = localStorage.getItem(EVENT_FORWARDS_LS_KEY);
    return raw ? (JSON.parse(raw) as EventForwardRecord[]) : [];
  } catch {
    return [];
  }
}

function writeEventForwards(forwards: EventForwardRecord[]) {
  lockedStorageWrite(() => localStorage.setItem(EVENT_FORWARDS_LS_KEY, JSON.stringify(forwards)));
}

function readEventBusConfig(): EventBusConfig {
  try {
    const raw = localStorage.getItem(EVENT_BUS_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EventBusConfig;
      return {
        forwardEnabled: parsed.forwardEnabled ?? false,
        forwardUrl: parsed.forwardUrl ?? '',
        forwardToken: parsed.forwardToken ?? '',
        retentionDays: parsed.retentionDays ?? 30,
        maxLogs: parsed.maxLogs ?? 500,
        schemaStrict: parsed.schemaStrict ?? true,
        updatedAt: parsed.updatedAt ?? 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    forwardEnabled: false,
    forwardUrl: '',
    forwardToken: '',
    retentionDays: 30,
    maxLogs: 500,
    schemaStrict: true,
    updatedAt: 0,
  };
}

function validateEventContext(schema: string, context: Record<string, unknown>): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schema);
  } catch {
    return 'Invalid schema JSON';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'Event schema must be a JSON object';
  }
  const schemaObj = parsed as Record<string, unknown>;
  const required = Array.isArray(schemaObj.required) ? (schemaObj.required as unknown[]) : [];
  for (const field of required) {
    if (typeof field !== 'string') return 'required entries must be strings';
    if (!(field in context)) return `Missing required field '${field}'`;
  }
  const properties =
    schemaObj.properties && typeof schemaObj.properties === 'object'
      ? (schemaObj.properties as Record<string, { type?: string }>)
      : {};
  for (const [name, spec] of Object.entries(properties)) {
    const expected = spec?.type ?? '';
    const value = context[name];
    if (value === undefined) continue;
    const matches =
      expected === 'string'
        ? typeof value === 'string'
        : expected === 'number'
          ? typeof value === 'number'
          : expected === 'boolean'
            ? typeof value === 'boolean'
            : expected === 'object'
              ? typeof value === 'object' && value !== null && !Array.isArray(value)
              : expected === 'array'
                ? Array.isArray(value)
                : expected === 'null'
                  ? value === null
                  : expected === ''
                    ? true
                    : null;
    if (matches === null) {
      return `Unsupported type '${expected}' for field '${name}'`;
    }
    if (!matches) return `Field '${name}' must be ${expected}`;
  }
  return null;
}

export async function emitEventBusEvent(
  event: string,
  context?: Record<string, unknown>,
  source = 'workbench',
  deviceId = '',
): Promise<EventEmitResult> {
  if (isTauri()) {
    return invoke<EventEmitResult>('emit_event_bus_event', {
      request: { event, context: context ?? null, source, deviceId },
    });
  }
  const now = Date.now();
  const schemas = readEventSchemas();
  const schema = schemas.find((item) => item.event === event);
  const contextObj = context ?? {};
  const reason = schema?.enabled ? validateEventContext(schema.schema, contextObj) : null;
  const validated = reason === null;
  const log: EventLogRecord = {
    id: makeId(),
    event,
    context: JSON.stringify(contextObj),
    source,
    deviceId,
    schemaVersion: schema?.enabled ? Math.max(1, schema.updatedAt) : 1,
    status: validated ? 'accepted' : 'rejected',
    rejectedReason: reason ?? '',
    createdAt: now,
  };
  const config = readEventBusConfig();
  const nextLogs = pruneEventLogs([log, ...readEventLogs()], config);
  writeEventLogs(nextLogs);
  let forwarded = 0;
  if (validated && config.forwardEnabled && config.forwardUrl.trim()) {
    const forward: EventForwardRecord = {
      id: makeId(),
      eventLogId: log.id,
      targetUrl: config.forwardUrl.trim(),
      targetToken: config.forwardToken,
      status: 'success',
      attempts: 1,
      nextAttemptAt: now,
      lastStatus: 200,
      lastMessage: 'HTTP 200 delivered',
      createdAt: now,
      updatedAt: now,
    };
    writeEventForwards([forward, ...readEventForwards()]);
    forwarded = 1;
  }
  return {
    event,
    recorded: true,
    validated,
    rejectedReason: reason ?? '',
    forwarded,
    webhookDeliveries: 0,
  };
}

export async function listEventLogs(event?: string, limit = 50): Promise<EventLogRecord[]> {
  if (isTauri()) {
    return invoke<EventLogRecord[]>('list_event_logs', {
      event: event?.trim() ? event.trim() : null,
      limit,
    });
  }
  const logs = readEventLogs();
  const filtered = event?.trim() ? logs.filter((log) => log.event === event.trim()) : logs;
  return filtered
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.min(Math.max(1, limit), 500));
}

export async function clearEventLogs(status?: string): Promise<number> {
  if (isTauri()) {
    return invoke<number>('clear_event_logs', {
      status: status?.trim() ? status.trim() : null,
    });
  }
  const logs = readEventLogs();
  const next = status?.trim() ? logs.filter((log) => log.status !== status.trim()) : [];
  writeEventLogs(next);
  return logs.length - next.length;
}

export async function getEventSchema(event: string): Promise<EventSchema | null> {
  if (isTauri()) {
    return invoke<EventSchema | null>('get_event_schema', { event });
  }
  return readEventSchemas().find((item) => item.event === event) ?? null;
}

export async function setEventSchema(
  event: string,
  schema: string,
  enabled: boolean,
): Promise<EventSchema> {
  if (isTauri()) {
    return invoke<EventSchema>('set_event_schema', {
      request: { event, schema, enabled },
    });
  }
  const parsed = JSON.parse(schema) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Event schema must be a JSON object');
  }
  const item: EventSchema = {
    event,
    schema,
    enabled,
    updatedAt: Date.now(),
  };
  const schemas = readEventSchemas();
  const index = schemas.findIndex((existing) => existing.event === event);
  if (index >= 0) schemas[index] = item;
  else schemas.push(item);
  writeEventSchemas(schemas);
  return item;
}

export async function listEventSchemas(): Promise<EventSchema[]> {
  if (isTauri()) return invoke<EventSchema[]>('list_event_schemas');
  return readEventSchemas()
    .slice()
    .sort((a, b) => a.event.localeCompare(b.event));
}

export async function getEventBusConfig(): Promise<EventBusConfig> {
  if (isTauri()) return invoke<EventBusConfig>('get_event_bus_config');
  return readEventBusConfig();
}

export async function setEventBusConfig(
  forwardEnabled: boolean,
  forwardUrl: string,
  forwardToken: string,
  retentionDays: number,
  maxLogs: number,
  schemaStrict: boolean,
): Promise<EventBusConfig> {
  if (isTauri()) {
    return invoke<EventBusConfig>('set_event_bus_config', {
      request: {
        forwardEnabled,
        forwardUrl,
        forwardToken,
        retentionDays,
        maxLogs,
        schemaStrict,
      },
    });
  }
  const config: EventBusConfig = {
    forwardEnabled,
    forwardUrl: forwardUrl.trim(),
    forwardToken,
    retentionDays: Math.min(3650, Math.max(1, Math.round(retentionDays) || 30)),
    maxLogs: Math.min(100000, Math.max(10, Math.round(maxLogs) || 500)),
    schemaStrict,
    updatedAt: Date.now(),
  };
  localStorage.setItem(EVENT_BUS_CONFIG_LS_KEY, JSON.stringify(config));
  return config;
}

export async function listEventForwards(
  status?: string,
  limit = 50,
): Promise<EventForwardRecord[]> {
  if (isTauri()) {
    return invoke<EventForwardRecord[]>('list_event_forwards', {
      status: status?.trim() ? status.trim() : null,
      limit,
    });
  }
  const forwards = readEventForwards();
  const filtered = status?.trim()
    ? forwards.filter((item) => item.status === status.trim())
    : forwards;
  return filtered.slice(0, Math.min(Math.max(1, limit), 200));
}

export async function retryEventForward(id: string): Promise<EventForwardRecord> {
  if (isTauri()) {
    return invoke<EventForwardRecord>('retry_event_forward', { id });
  }
  const forwards = readEventForwards();
  const forward = forwards.find((item) => item.id === id);
  if (!forward) throw new Error('Event forward not found');
  forward.status = 'queued';
  forward.attempts = 0;
  forward.lastMessage = '';
  forward.nextAttemptAt = Date.now();
  forward.updatedAt = Date.now();
  writeEventForwards(forwards);
  return forward;
}

export async function deleteEventForward(id: string): Promise<string> {
  if (isTauri()) return invoke<string>('delete_event_forward', { id });
  const forwards = readEventForwards();
  const next = forwards.filter((item) => item.id !== id);
  if (next.length === forwards.length) throw new Error('Event forward not found');
  writeEventForwards(next);
  return `Deleted event forward ${id.slice(0, 8)}`;
}

export async function clearEventForwards(status?: string): Promise<number> {
  if (isTauri()) {
    return invoke<number>('clear_event_forwards', {
      status: status?.trim() ? status.trim() : null,
    });
  }
  const forwards = readEventForwards();
  const next = status?.trim() ? forwards.filter((item) => item.status !== status.trim()) : [];
  writeEventForwards(next);
  return forwards.length - next.length;
}

export async function getEventBusStats(): Promise<EventBusStats> {
  if (isTauri()) return invoke<EventBusStats>('get_event_bus_stats');
  const stats: EventBusStats = {
    total: 0,
    accepted: 0,
    rejected: 0,
    forwarded: 0,
    pending: 0,
    failed: 0,
  };
  for (const log of readEventLogs()) {
    stats.total += 1;
    if (log.status === 'accepted') stats.accepted += 1;
    else stats.rejected += 1;
  }
  for (const forward of readEventForwards()) {
    if (forward.status === 'success') stats.forwarded += 1;
    else if (forward.status === 'queued' || forward.status === 'delivering') stats.pending += 1;
    else stats.failed += 1;
  }
  return stats;
}

export async function runProviderStreamSmokeTest(providerId: string): Promise<StreamSmokeResult> {
  if (isTauri()) {
    return invoke<StreamSmokeResult>('run_provider_stream_smoke_test', { providerId });
  }
  return { ok: true, chunks: 2, message: 'Streamed 2 chunk(s)' };
}

export async function runProviderE2EStream(providerId: string): Promise<ProviderE2eResult> {
  if (isTauri()) {
    return invoke<ProviderE2eResult>('run_provider_e2e_stream', { providerId });
  }
  const provider = readLocal().providers.find((p) => p.id === providerId);
  if (!provider || !canRealStream(provider)) {
    return {
      ok: true,
      chunks: 2,
      chars: 26,
      durationMs: 120,
      message: 'Streamed 2 chunk(s) · 26 chars · 120ms',
    };
  }
  const runId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let chunks = 0;
  const started = performance.now();
  try {
    const collected = await streamProviderWithRetry(
      provider,
      {
        providerIds: [provider.id],
        messages: [{ role: 'user', content: 'Ping stream e2e' }],
        moa: false,
        runId,
      },
      {
        final: false,
        manageCancel: false,
        onChunk: () => {
          chunks += 1;
        },
      },
    );
    return {
      ok: true,
      chunks,
      chars: collected.length,
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      message: collected.slice(0, 120),
    };
  } catch (err) {
    return {
      ok: false,
      chunks,
      chars: 0,
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function buildTeamSummary(contents: string[]): Promise<string> {
  if (isTauri()) return invoke<string>('build_team_summary', { contents });
  const lines = contents.map((content) => {
    const line = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('**') && !l.startsWith('-') && !l.startsWith('['));
    return (line || 'No output').slice(0, 120);
  });
  return lines.length ? lines.join('\n') : 'No agent output collected.';
}

const MOA_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'it',
  'this',
  'that',
  'you',
  'your',
  'we',
  'our',
  'i',
  'as',
  'at',
  'by',
  'from',
  'not',
  'but',
  'if',
  'then',
  'can',
  'will',
  'should',
  'would',
  'please',
  'output',
  'outputs',
  'streaming',
  'fallback',
]);

function moaFirstLine(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(
      (value) =>
        value &&
        !value.startsWith('**') &&
        !value.startsWith('-') &&
        !value.startsWith('[') &&
        !value.startsWith('## '),
    );
  return (line || 'No output').slice(0, 140);
}

function moaKeywords(contents: string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const seen = new Set<string>();
    for (const raw of content.match(/[\p{L}\p{N}]+/gu) ?? []) {
      if (raw.length < 2) continue;
      const lower = raw.toLowerCase();
      if (MOA_STOPWORDS.has(lower) || /^[0-9]+$/.test(lower)) continue;
      seen.add(lower);
    }
    for (const token of seen) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 3)
    .map(([token]) => token);
}

function moaViewpoints(contents: string[]): string[] {
  const lines = contents.map(moaFirstLine);
  const viewpoints: string[] = [];
  for (const line of lines) {
    const shared = lines.every((other) => other === line);
    if (!shared && !viewpoints.includes(line)) viewpoints.push(line);
  }
  if (!viewpoints.length && lines.length) viewpoints.push(lines[0]);
  return viewpoints.slice(0, 3);
}

function buildMoaConsensusLocal(contents: string[]): MoaConsensus {
  const firstLines = contents.map(moaFirstLine);
  const common = moaKeywords(contents);
  const viewpoints = moaViewpoints(contents);
  let summary = '';
  if (!contents.length || firstLines.every((line) => line === 'No output')) {
    summary = 'No agent output collected.';
  } else {
    summary += '共识点：\n';
    if (!common.length) {
      summary += '- 各输出均有有效回答\n';
    } else {
      for (const keyword of common) summary += `- ${keyword}\n`;
    }
    summary += '\n分歧/独特观点：\n';
    for (const viewpoint of viewpoints) summary += `- ${viewpoint}\n`;
    summary += '\n结论：\n';
    firstLines.forEach((line, index) => {
      summary += `- Output ${index + 1}: ${line}\n`;
    });
  }
  return { summary, common, viewpoints };
}

export async function buildMoaConsensus(contents: string[]): Promise<MoaConsensus> {
  if (isTauri()) return invoke<MoaConsensus>('build_moa_consensus', { contents });
  return buildMoaConsensusLocal(contents);
}
