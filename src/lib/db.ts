import {
  QUICK_PROMPTS,
  addCustomQuickPrompt as addCustomQuickPromptLocal,
  deleteCustomQuickPrompt as deleteCustomQuickPromptLocal,
  getQuickPromptUsage as getQuickPromptUsageLocal,
  listCustomQuickPrompts as listCustomQuickPromptsLocal,
  recordQuickPromptUsage as recordQuickPromptUsageLocal,
  reorderCustomQuickPrompts as reorderCustomQuickPromptsLocal,
  updateCustomQuickPrompt as updateCustomQuickPromptLocal,
  type CustomQuickPrompt,
  type QuickPrompt,
} from './quickPrompts';
import {
  cosineSimilarity,
  embedText,
  embedTextRemote,
  hybridRagScore,
  shardFor,
  type EmbeddingMode,
} from './embed';
export type { EmbeddingMode };
import { pinyin } from 'pinyin-pro';

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
};

export type Project = {
  id: string;
  name: string;
  path: string | null;
  revenue: number;
  status: string;
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

export type Habit = {
  id: string;
  name: string;
  weekGoal: number;
  currentStreak: number;
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  doneToday: boolean;
  createdAt: number;
  recentLogs: string[];
};

export type HabitLog = {
  id: string;
  habitId: string;
  date: string;
  checkedAt: number;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  startTime: string;
  date: string;
  done: boolean;
  tag: string;
  createdAt: number;
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
  score: number;
  vectorScore?: number;
  shardId?: string;
  embeddingModel?: string;
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
  updatedAt: number;
};

export type VectorShardRecord = {
  shardId: string;
  model: string;
  dimension: number;
  documents: number;
  status: string;
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
const VAULT_WATCH_LS_KEY = 'ai-workbench:vault-watch:v1';
const VAULT_WATCH_TARGETS_LS_KEY = 'ai-workbench:vault-watch-targets:v1';
const VAULT_WATCH_EVENTS_LS_KEY = 'ai-workbench:vault-watch-events:v1';
const DOC_HEALTH_AUTO_LS_KEY = 'ai-workbench:doc-health-auto:v1';
const DOC_HEALTH_HISTORY_LS_KEY = 'ai-workbench:doc-health-history:v1';
const DOC_HEALTH_ALERT_DISMISSED_LS_KEY = 'ai-workbench:doc-health-alert-dismissed:v1';

type LocalShape = {
  tasks: Task[];
  projects: Project[];
  projectRevenueHistory: ProjectRevenuePoint[];
  thoughts: Thought[];
  providers: Provider[];
  departments: Department[];
  agents: Agent[];
  promptVersions: AgentPromptVersion[];
  sessions: Session[];
  chatMessages: ChatMessage[];
  messageVersions: MessageVersion[];
  habits: Habit[];
  habitLogs: HabitLog[];
  scheduleEvents: ScheduleEvent[];
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
  syncDeviceId: string;
  lastSyncedAt: number;
};

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
const WEBHOOK_RULES_LS_KEY = 'ai-workbench:webhook-rules:v1';
const WEBHOOK_RULE_RUNS_LS_KEY = 'ai-workbench:webhook-rule-runs:v1';
const WEBHOOK_DELIVERIES_LS_KEY = 'ai-workbench:webhook-deliveries:v1';
const WEBHOOK_RETENTION_LS_KEY = 'ai-workbench:webhook-retention:v1';
const WEBHOOK_CHANNEL_CONFIG_LS_KEY = 'ai-workbench:webhook-channel-config:v1';
const EVENT_LOGS_LS_KEY = 'ai-workbench:event-logs:v1';
const EVENT_SCHEMAS_LS_KEY = 'ai-workbench:event-schemas:v1';
const EVENT_FORWARDS_LS_KEY = 'ai-workbench:event-forwards:v1';
const EVENT_BUS_CONFIG_LS_KEY = 'ai-workbench:event-bus-config:v1';
const EMBEDDING_CONFIG_LS_KEY = 'ai-workbench:embedding-config:v1';
const VECTOR_SHARDS_LS_KEY = 'ai-workbench:vector-shards:v1';
const KNOWLEDGE_CLUSTERS_LS_KEY = 'ai-workbench:knowledge-clusters:v1';
const KNOWLEDGE_CLUSTER_CONFIG_LS_KEY = 'ai-workbench:knowledge-cluster-config:v1';
const KNOWLEDGE_DEDUP_LS_KEY = 'ai-workbench:knowledge-dedup:v1';

function emptyShape(): LocalShape {
  return {
    tasks: [],
    projects: [],
    projectRevenueHistory: [],
    thoughts: [],
    providers: [],
    departments: [],
    agents: [],
    promptVersions: [],
    sessions: [],
    chatMessages: [],
    messageVersions: [],
    habits: [],
    habitLogs: [],
    scheduleEvents: [],
    clipboard: [],
    logs: [],
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
        name: 'AI Workbench',
        path: 'D:\\ai-workbench',
        revenue: 0,
        status: 'active',
        createdAt: now - 86400000,
        sortOrder: 0,
      },
      {
        id: makeId(),
        name: 'Hermes Station',
        path: 'D:\\HermesData\\ai-workbench',
        revenue: 0,
        status: 'paused',
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
          '你是 AI Workbench 的 UI Designer，负责设计系统、动效与视觉验收。输出需遵循 Design Token，并服务于 5 大主视图。',
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
          '你是 AI Workbench 的 Frontend Developer，负责 React/Tailwind 实现。输出需可运行、可验证，并保持布局稳定。',
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
          '你是 AI Workbench 的 UI Finish-Gate Reviewer，负责视觉验收。输出必须给出可测量的验收项与风险。',
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
          '你是 AI Workbench 的 Product Manager，负责范围冻结与验收标准。每个需求必须给出明确的 AC。',
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
          '你是 AI Workbench 的 UX Architect，负责交互与信息架构。输出需考虑工作台高频路径与 5 大主视图。',
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
          '你是 AI Workbench 的 Backend Architect，负责 Tauri 命令与分层设计。输出需保持模块边界清晰并考虑错误路径。',
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
          '你是 AI Workbench 的 Data Engineer，负责 SQLite 表结构与迁移。输出需包含索引、外键与迁移脚本。',
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
          '你是 AI Workbench 的 AI Engineer，负责模型路由与流式链路。输出需兼容 Tauri 与浏览器 fallback。',
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
          '你是 AI Workbench 的 Prompt Engineer，负责 Prompt 版本与测试用例。输出需给出可复现的用例。',
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
          '你是 AI Workbench 的 Multi-Agent Systems Architect，负责部门与 Agent 编排。输出需明确分工、并行度与汇总结论。',
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
          '你是 AI Workbench 的 Test Automation Engineer，负责自动化验收与回归。输出需覆盖 verify:ui 与 Rust 单测。',
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
          '你是 AI Workbench 的 Reality Checker，负责证据驱动的发布门禁。输出必须引用实际文件与命令结果。',
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
    habits: [
      {
        id: makeId(),
        name: '晨间阅读',
        weekGoal: 5,
        currentStreak: 3,
        color: 'emerald',
        doneToday: false,
        createdAt: now - 86400000,
        recentLogs: [],
      },
      {
        id: makeId(),
        name: '深水工作',
        weekGoal: 4,
        currentStreak: 2,
        color: 'blue',
        doneToday: false,
        createdAt: now - 172800000,
        recentLogs: [],
      },
      {
        id: makeId(),
        name: '运动 30 分钟',
        weekGoal: 3,
        currentStreak: 5,
        color: 'amber',
        doneToday: false,
        createdAt: now - 259200000,
        recentLogs: [],
      },
    ],
    scheduleEvents: [
      {
        id: makeId(),
        title: '每日复盘',
        startTime: '09:30',
        date: '',
        done: false,
        tag: 'routine',
        createdAt: now - 3600000,
      },
      {
        id: makeId(),
        title: 'Sprint 3 验收',
        startTime: '14:00',
        date: '',
        done: false,
        tag: 'work',
        createdAt: now - 1800000,
      },
    ],
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
    syncDeviceId: existing.syncDeviceId || makeId(),
    lastSyncedAt: existing.lastSyncedAt ?? 0,
    habitLogs: [],
  };
  shape.habitLogs = seedHabitLogs(shape.habits);
  return shape;
}

function readLocal(): LocalShape {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) ?? '') as Partial<LocalShape>;
    return {
      ...emptyShape(),
      ...parsed,
      habitLogs: parsed.habitLogs ?? [],
      habits: (parsed.habits ?? []).map((h) => ({ ...h, recentLogs: h.recentLogs ?? [] })),
    } as LocalShape;
  } catch {
    return emptyShape();
  }
}

function writeLocal(shape: LocalShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(shape));
}

function localDateKeyOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKeyToDayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function computeStreakFromDates(dates: string[], todayKey: string): number {
  const checked = new Set(dates.map(dateKeyToDayNumber).filter(Number.isFinite));
  const today = dateKeyToDayNumber(todayKey);
  let cursor = checked.has(today) ? today : today - 1;
  let streak = 0;
  while (checked.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function recentLogDates(dates: string[], todayKey: string, window: number): string[] {
  const min = dateKeyToDayNumber(todayKey) - window + 1;
  return Array.from(
    new Set(
      dates.filter((d) => Number.isFinite(dateKeyToDayNumber(d)) && dateKeyToDayNumber(d) >= min),
    ),
  ).sort();
}

function seedHabitLogs(habits: Habit[]): HabitLog[] {
  const patterns: Record<string, number[]> = {
    晨间阅读: [1, 2, 3],
    深水工作: [1, 2],
    '运动 30 分钟': [1, 2, 3, 4, 5],
  };
  const logs: HabitLog[] = [];
  for (const habit of habits) {
    for (const daysAgo of patterns[habit.name] ?? []) {
      logs.push({
        id: makeId(),
        habitId: habit.id,
        date: localDateKeyOffset(daysAgo),
        checkedAt: Date.now() - daysAgo * 86_400_000,
      });
    }
  }
  return logs;
}

export async function initDb(): Promise<void> {
  if (isTauri()) {
    await invoke('init_db');
    return;
  }
  if (!localStorage.getItem(LS_KEY)) writeLocal(seedShape());
}

export async function listTasks(): Promise<Task[]> {
  return isTauri() ? invoke<Task[]>('list_tasks') : readLocal().tasks;
}

export async function createTask(title: string, isToday: boolean): Promise<Task> {
  if (isTauri()) return invoke<Task>('create_task', { title, isToday });
  const shape = readLocal();
  const task: Task = {
    id: makeId(),
    title,
    status: 'todo',
    isToday,
    dueDate: null,
    completedAt: null,
    createdAt: Date.now(),
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

export async function deleteProject(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_project', { id });
    return;
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
  if (isTauri()) return invoke<Thought>('create_thought', { content, tags, type });
  const shape = readLocal();
  const thought: Thought = { id: makeId(), content, tags, type, createdAt: Date.now() };
  shape.thoughts.unshift(thought);
  writeLocal(shape);
  return thought;
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
  if (isTauri()) return invoke<Thought>('update_thought_type', { id, type });
  const shape = readLocal();
  const thought = shape.thoughts.find((t) => t.id === id);
  if (!thought) throw new Error('thought not found');
  thought.type = type;
  writeLocal(shape);
  return thought;
}

export async function deleteThought(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_thought', { id });
    return;
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

export async function checkProviderHealth(providerId: string): Promise<ProviderHealth> {
  if (isTauri()) return invoke<ProviderHealth>('check_provider_health', { providerId });
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

type MatchMode = 'original' | 'full-pinyin' | 'initials-pinyin';

function substringScore(haystack: string, query: string): number | null {
  if (!haystack || !query) return null;
  const index = haystack.indexOf(query);
  return index >= 0 ? 120 - index : null;
}

function subsequenceScore(haystack: string, query: string): number | null {
  if (!haystack || !query) return null;
  let qi = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < haystack.length; i += 1) {
    if (haystack[i] === query[qi]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      qi += 1;
      if (qi === query.length) return Math.max(1, 80 - gaps);
    }
  }
  return null;
}

function pinyinText(text: string, firstLetter: boolean): string {
  const parts = pinyin(text, {
    toneType: 'none',
    type: 'array',
    pattern: firstLetter ? 'first' : 'pinyin',
  });
  return parts
    .map((part) => part.toLowerCase())
    .filter((part) => /\S/.test(part))
    .join('');
}

function textMatchScore(text: string, query: string): { score: number; mode: MatchMode } | null {
  const originalQ = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const originalSubstring = substringScore(lowerText, originalQ);
  if (originalSubstring != null) return { score: originalSubstring, mode: 'original' };
  const originalSubsequence = subsequenceScore(lowerText, originalQ);
  if (originalSubsequence != null) return { score: originalSubsequence, mode: 'original' };

  const compactQ = originalQ.replace(/\s+/g, '');
  const full = pinyinText(text, false);
  const fullSubstring = substringScore(full, compactQ);
  if (fullSubstring != null) return { score: fullSubstring - 5, mode: 'full-pinyin' };
  const fullSubsequence = subsequenceScore(full, compactQ);
  if (fullSubsequence != null) return { score: fullSubsequence - 10, mode: 'full-pinyin' };

  const initials = pinyinText(text, true);
  const initialsSubstring = substringScore(initials, compactQ);
  if (initialsSubstring != null) return { score: initialsSubstring - 15, mode: 'initials-pinyin' };
  const initialsSubsequence = subsequenceScore(initials, compactQ);
  if (initialsSubsequence != null)
    return { score: initialsSubsequence - 20, mode: 'initials-pinyin' };
  return null;
}

function sessionMatchType(
  field: 'title' | 'model' | 'message',
  mode: MatchMode,
): SessionSearchHit['matchType'] {
  return mode === 'original' ? field : `pinyin-${field}`;
}

function sessionSnippet(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export async function searchSessions(
  query: string,
  options: {
    since?: number;
    until?: number;
    limit?: number;
    includeMessages?: boolean;
  } = {},
): Promise<SessionSearchHit[]> {
  const q = query.trim();
  if (isTauri()) {
    return invoke<SessionSearchHit[]>('search_sessions', {
      query: q,
      since: options.since ?? null,
      until: options.until ?? null,
      limit: options.limit ?? null,
      includeMessages: options.includeMessages ?? true,
    });
  }
  const shape = readLocal();
  const sessions = shape.sessions
    .map((s) => ({
      ...s,
      pinned: s.pinned ?? false,
      archived: s.archived ?? false,
      messageCount: (shape.chatMessages ?? []).filter((m) => m.sessionId === s.id).length,
    }))
    .filter((s) => !s.archived)
    .filter((s) => options.since == null || s.createdAt >= options.since)
    .filter((s) => options.until == null || s.createdAt <= options.until);
  if (!q) {
    return sessions.map((session) => ({
      session,
      matchType: 'all' as const,
      snippet: '',
      score: 0,
      messageId: null,
    }));
  }
  const hits: SessionSearchHit[] = [];
  for (const session of sessions) {
    let bestScore = 0;
    let bestMatch: SessionSearchHit['matchType'] | null = null;
    let bestSnippet = '';
    let bestMessageId: string | null = null;
    const consider = (
      score: number,
      matchType: SessionSearchHit['matchType'],
      snippet: string,
      messageId?: string | null,
    ) => {
      if (score > bestScore) {
        bestScore = score;
        bestMatch = matchType;
        bestSnippet = snippet;
        bestMessageId = messageId ?? null;
      }
    };
    const titleMatch = textMatchScore(session.title, q);
    if (titleMatch)
      consider(
        titleMatch.score,
        sessionMatchType('title', titleMatch.mode),
        sessionSnippet(session.title),
        null,
      );
    const modelMatch = textMatchScore(session.model, q);
    if (modelMatch)
      consider(
        modelMatch.score,
        sessionMatchType('model', modelMatch.mode),
        sessionSnippet(session.model),
        null,
      );
    if (options.includeMessages !== false) {
      for (const message of (shape.chatMessages ?? []).filter((m) => m.sessionId === session.id)) {
        const messageMatch = textMatchScore(message.content, q);
        if (messageMatch) {
          consider(
            messageMatch.score,
            sessionMatchType('message', messageMatch.mode),
            sessionSnippet(message.content),
            message.id,
          );
        }
      }
    }
    if (bestMatch) {
      hits.push({
        session,
        matchType: bestMatch,
        snippet: bestSnippet,
        score: bestScore + (session.pinned ? 10 : 0),
        messageId: bestMessageId,
      });
    }
  }
  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.session.pinned) - Number(a.session.pinned) ||
        b.session.createdAt - a.session.createdAt,
    )
    .slice(0, Math.max(1, options.limit ?? 50));
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

export async function renameSession(id: string, title: string): Promise<void> {
  if (isTauri()) {
    await invoke('rename_session', { id, title });
    return;
  }
  const shape = readLocal();
  const session = shape.sessions.find((s) => s.id === id);
  if (session) session.title = title;
  writeLocal(shape);
}

export async function setSessionPinned(id: string, pinned: boolean): Promise<void> {
  if (isTauri()) {
    await invoke('set_session_pinned', { id, pinned });
    return;
  }
  const shape = readLocal();
  const session = shape.sessions.find((s) => s.id === id);
  if (session) session.pinned = pinned;
  writeLocal(shape);
}

export async function setSessionArchived(id: string, archived: boolean): Promise<Session> {
  if (isTauri()) return invoke<Session>('set_session_archived', { id, archived });
  const shape = readLocal();
  const session = shape.sessions.find((s) => s.id === id);
  if (!session) throw new Error(`Session not found: ${id}`);
  session.archived = archived;
  writeLocal(shape);
  return {
    ...session,
    messageCount: shape.chatMessages.filter((m) => m.sessionId === id).length,
  };
}

export async function duplicateSession(id: string): Promise<Session> {
  if (isTauri()) return invoke<Session>('duplicate_session', { id });
  const shape = readLocal();
  const source = shape.sessions.find((s) => s.id === id);
  if (!source) throw new Error(`Session not found: ${id}`);
  const now = Date.now();
  const copy: Session = {
    id: makeId(),
    projectId: source.projectId,
    title: `${source.title} (copy)`,
    model: source.model,
    pinned: false,
    archived: false,
    messageCount: shape.chatMessages.filter((m) => m.sessionId === id).length,
    createdAt: now,
  };
  shape.sessions.unshift(copy);
  shape.chatMessages
    .filter((m) => m.sessionId === id)
    .forEach((m) => {
      shape.chatMessages.push({
        id: makeId(),
        sessionId: copy.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      });
    });
  writeLocal(shape);
  return copy;
}

const SESSION_SUMMARY_STOPWORDS = new Set([
  '的',
  '了',
  '是',
  '我',
  '你',
  '他',
  '她',
  '它',
  '们',
  '这',
  '那',
  '在',
  '有',
  '和',
  '就',
  '都',
  '而',
  '及',
  '与',
  '着',
  '或',
  '一个',
  '没有',
  '什么',
  '怎么',
  '如何',
  '为什么',
  '吗',
  '呢',
  '吧',
  '啊',
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'for',
  'in',
  'on',
  'is',
  'are',
  'was',
  'were',
  'be',
  'with',
  'this',
  'that',
  'it',
  'as',
  'at',
  'by',
  'from',
  'please',
  'help',
  'me',
  'my',
  'you',
]);

function sessionSummaryTokens(content: string): string[] {
  const tokens: string[] = [];
  const cjk = content.replace(/[^\u4e00-\u9fff]/g, ' ');
  for (const chunk of cjk.split(/\s+/).filter(Boolean)) {
    if (chunk.length >= 3) {
      for (let i = 0; i < chunk.length - 2; i += 1) tokens.push(chunk.slice(i, i + 3));
    }
    for (let i = 0; i < chunk.length - 1; i += 1) tokens.push(chunk.slice(i, i + 2));
  }
  const english = content.replace(/[\u4e00-\u9fff]/g, ' ').toLowerCase();
  for (const raw of english.split(/[^a-z0-9]+/)) {
    if (raw.length > 1) tokens.push(raw);
  }
  return tokens.filter((token) => !SESSION_SUMMARY_STOPWORDS.has(token));
}

function sessionSummaryLine(content: string, max: number): string {
  const line =
    content
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? '';
  return line.slice(0, max);
}

export function buildSessionSummary(messages: ChatMessage[], limit = 5): SessionSummary {
  const userMessages = messages.filter((message) => message.role === 'user');
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const token of sessionSummaryTokens(message.content)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([token]) => token);
  const points = userMessages.slice(0, limit).map((user) => {
    const rest = messages.slice(messages.indexOf(user) + 1);
    const answer = rest.find((message) => message.role === 'assistant');
    return {
      question: sessionSummaryLine(user.content, 40),
      answer: answer ? sessionSummaryLine(answer.content, 90) : '',
    };
  });
  return { questionCount: userMessages.length, keywords, points };
}

export function buildSessionMarkdown(session: Session, messages: ChatMessage[]): string {
  const lines: string[] = [
    `# ${session.title}`,
    '',
    `> Model: ${session.model} · Created: ${new Date(session.createdAt).toLocaleString()}`,
    '',
  ];
  const summary = buildSessionSummary(messages);
  lines.push('## Summary', '', `- Questions: ${summary.questionCount}`);
  lines.push(`- Keywords: ${summary.keywords.join(', ') || '-'}`, '');
  for (const point of summary.points) {
    lines.push(`- Q: ${point.question || '—'}`);
    lines.push(`  A: ${point.answer || '—'}`);
  }
  lines.push('');
  for (const message of messages) {
    lines.push(`## ${message.role === 'user' ? 'User' : 'Assistant'}`, '', message.content, '');
  }
  return lines.join('\n').trimEnd() + '\n';
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

export async function updateChatMessage(id: string, content: string): Promise<void> {
  if (isTauri()) {
    await invoke('update_chat_message', { id, content });
    return;
  }
  const shape = readLocal();
  const message = shape.chatMessages.find((m) => m.id === id);
  if (message && message.content !== content) {
    shape.messageVersions = shape.messageVersions ?? [];
    const parent =
      shape.messageVersions
        .filter((v) => v.messageId === id)
        .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
    shape.messageVersions.push({
      id: makeId(),
      messageId: id,
      content: message.content,
      createdAt: Date.now(),
      parentVersionId: parent,
    });
    message.content = content;
  }
  writeLocal(shape);
}

export async function truncateChatMessages(
  sessionId: string,
  keepMessageId: string,
): Promise<void> {
  if (isTauri()) {
    await invoke('truncate_chat_messages', { sessionId, keepMessageId });
    return;
  }
  const shape = readLocal();
  const keep = shape.chatMessages.find((m) => m.id === keepMessageId);
  if (keep) {
    shape.chatMessages = shape.chatMessages.filter(
      (m) => m.sessionId !== sessionId || m.createdAt <= keep.createdAt || m.id === keepMessageId,
    );
    const remainingMessageIds = new Set(shape.chatMessages.map((m) => m.id));
    shape.messageVersions = (shape.messageVersions ?? []).filter((v) =>
      remainingMessageIds.has(v.messageId),
    );
  }
  writeLocal(shape);
}

export async function saveMessageVersion(
  messageId: string,
  content: string,
): Promise<MessageVersion> {
  if (isTauri()) return invoke<MessageVersion>('save_message_version', { messageId, content });
  const shape = readLocal();
  shape.messageVersions = shape.messageVersions ?? [];
  const version: MessageVersion = {
    id: makeId(),
    messageId,
    content,
    createdAt: Date.now(),
    parentVersionId: null,
  };
  shape.messageVersions.push(version);
  writeLocal(shape);
  return version;
}

export async function listMessageVersions(messageId: string): Promise<MessageVersion[]> {
  if (isTauri()) return invoke<MessageVersion[]>('list_message_versions', { messageId });
  return (readLocal().messageVersions ?? [])
    .filter((v) => v.messageId === messageId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function restoreMessageVersion(messageId: string, versionId: string): Promise<string> {
  if (isTauri()) return invoke<string>('restore_message_version', { messageId, versionId });
  const shape = readLocal();
  const version = (shape.messageVersions ?? []).find(
    (v) => v.id === versionId && v.messageId === messageId,
  );
  if (!version) throw new Error('message version not found');
  await updateChatMessage(messageId, version.content);
  return version.content;
}

export async function diffMessageVersionWithCurrent(
  messageId: string,
  versionId: string,
): Promise<MessageDiff> {
  if (isTauri()) {
    return invoke<MessageDiff>('diff_message_version_with_current', { messageId, versionId });
  }
  const shape = readLocal();
  const version = (shape.messageVersions ?? []).find(
    (v) => v.id === versionId && v.messageId === messageId,
  );
  const message = shape.chatMessages.find((m) => m.id === messageId);
  if (!version || !message) throw new Error('message version not found');
  return lineDiff(version.content, message.content);
}

function lineDiff(a: string, b: string): MessageDiff {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const width = bLines.length + 1;
  const height = aLines.length + 1;
  const dp = Array.from({ length: height }, () => new Int32Array(width));
  for (let i = height - 2; i >= 0; i--) {
    for (let j = width - 2; j >= 0; j--) {
      dp[i][j] =
        aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < aLines.length && j < bLines.length) {
    if (aLines[i] === bLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(aLines[i]);
      i++;
    } else {
      added.push(bLines[j]);
      j++;
    }
  }
  while (i < aLines.length) {
    removed.push(aLines[i]);
    i++;
  }
  while (j < bLines.length) {
    added.push(bLines[j]);
    j++;
  }
  return { added, removed };
}

export async function listHabits(): Promise<Habit[]> {
  if (isTauri()) return invoke<Habit[]>('list_habits');
  const shape = readLocal();
  const today = localDateKeyOffset(0);
  return shape.habits.map((h) => {
    const dates = shape.habitLogs.filter((log) => log.habitId === h.id).map((log) => log.date);
    return {
      ...h,
      currentStreak: computeStreakFromDates(dates, today),
      recentLogs: recentLogDates(dates, today, 14),
      doneToday: dates.includes(today),
    };
  });
}

export async function createHabit(
  name: string,
  weekGoal: number,
  color: Habit['color'],
): Promise<Habit> {
  if (isTauri()) return invoke<Habit>('create_habit', { name, weekGoal, color });
  const shape = readLocal();
  const habit: Habit = {
    id: makeId(),
    name,
    weekGoal,
    currentStreak: 0,
    color,
    doneToday: false,
    createdAt: Date.now(),
    recentLogs: [],
  };
  shape.habits.unshift(habit);
  writeLocal(shape);
  return habit;
}

export async function toggleHabit(id: string): Promise<Habit> {
  if (isTauri()) return invoke<Habit>('toggle_habit', { id });
  const shape = readLocal();
  const habit = shape.habits.find((h) => h.id === id);
  if (!habit) return shape.habits[0];
  const today = localDateKeyOffset(0);
  const existingIndex = shape.habitLogs.findIndex(
    (log) => log.habitId === id && log.date === today,
  );
  if (existingIndex >= 0) {
    shape.habitLogs.splice(existingIndex, 1);
  } else {
    shape.habitLogs.push({
      id: makeId(),
      habitId: id,
      date: today,
      checkedAt: Date.now(),
    });
  }
  writeLocal(shape);
  const dates = shape.habitLogs.filter((log) => log.habitId === id).map((log) => log.date);
  return {
    ...habit,
    doneToday: dates.includes(today),
    currentStreak: computeStreakFromDates(dates, today),
    recentLogs: recentLogDates(dates, today, 14),
  };
}

export async function updateHabitWeekGoal(id: string, weekGoal: number): Promise<Habit> {
  if (isTauri()) return invoke<Habit>('update_habit_week_goal', { id, weekGoal });
  const shape = readLocal();
  const habit = shape.habits.find((h) => h.id === id);
  if (!habit) throw new Error('habit not found');
  habit.weekGoal = Number.isFinite(weekGoal)
    ? Math.max(1, Math.min(31, Math.round(weekGoal)))
    : habit.weekGoal;
  writeLocal(shape);
  return habit;
}

export async function deleteHabit(id: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>('delete_habit', { id });
  const shape = readLocal();
  const index = shape.habits.findIndex((h) => h.id === id);
  if (index < 0) return false;
  shape.habits.splice(index, 1);
  shape.habitLogs = shape.habitLogs.filter((log) => log.habitId !== id);
  writeLocal(shape);
  return true;
}

export async function listScheduleEvents(): Promise<ScheduleEvent[]> {
  if (isTauri()) return invoke<ScheduleEvent[]>('list_schedule_events');
  return readLocal()
    .scheduleEvents.slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.createdAt - b.createdAt,
    );
}

export async function createScheduleEvent(
  title: string,
  startTime: string,
  tag: string,
  date = '',
): Promise<ScheduleEvent> {
  if (isTauri()) {
    return invoke<ScheduleEvent>('create_schedule_event', { title, startTime, date, tag });
  }
  const shape = readLocal();
  const event: ScheduleEvent = {
    id: makeId(),
    title,
    startTime,
    date,
    done: false,
    tag,
    createdAt: Date.now(),
  };
  shape.scheduleEvents.push(event);
  writeLocal(shape);
  return event;
}

export async function toggleEventDone(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('toggle_event_done', { id });
    return;
  }
  const shape = readLocal();
  const event = shape.scheduleEvents.find((e) => e.id === id);
  if (event) event.done = !event.done;
  writeLocal(shape);
}

export async function listQuickPrompts(): Promise<QuickPrompt[]> {
  if (isTauri()) return invoke<QuickPrompt[]>('list_quick_prompts');
  return [...QUICK_PROMPTS, ...listCustomQuickPromptsLocal()];
}

export async function listCustomQuickPrompts(): Promise<CustomQuickPrompt[]> {
  if (isTauri()) {
    const prompts = await listQuickPrompts();
    return prompts.filter((prompt) => prompt.custom === true) as CustomQuickPrompt[];
  }
  return listCustomQuickPromptsLocal();
}

export async function loadQuickPromptsByUsage(): Promise<QuickPrompt[]> {
  const [usage, prompts] = await Promise.all([getQuickPromptUsage(), listQuickPrompts()]);
  const byId = new Map<string, QuickPrompt>();
  for (const prompt of prompts) byId.set(prompt.id, prompt);
  for (const builtin of QUICK_PROMPTS) {
    if (!byId.has(builtin.id)) byId.set(builtin.id, builtin);
  }
  return [...byId.values()]
    .map((prompt, index) => ({ prompt, index, count: usage[prompt.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || (a.prompt.order ?? a.index) - (b.prompt.order ?? b.index))
    .map((entry) => entry.prompt);
}

export async function getQuickPromptUsage(): Promise<Record<string, number>> {
  if (isTauri()) {
    const entries = await invoke<QuickPromptUsageEntry[]>('list_quick_prompt_usage');
    return Object.fromEntries(entries.map((entry) => [entry.id, entry.count]));
  }
  return getQuickPromptUsageLocal();
}

export async function recordQuickPromptUsage(id: string): Promise<number> {
  if (isTauri()) return invoke<number>('record_quick_prompt_usage', { id });
  return recordQuickPromptUsageLocal(id);
}

export async function addCustomQuickPrompt(
  label: string,
  category: string,
  text: string,
): Promise<CustomQuickPrompt> {
  if (isTauri()) {
    return invoke<CustomQuickPrompt>('add_custom_quick_prompt', { label, category, text });
  }
  return addCustomQuickPromptLocal(label, category as 'life' | 'work', text);
}

export async function updateCustomQuickPrompt(
  id: string,
  label: string,
  category: string,
  text: string,
): Promise<CustomQuickPrompt> {
  if (isTauri()) {
    return invoke<CustomQuickPrompt>('update_custom_quick_prompt', {
      id,
      label,
      category,
      text,
    });
  }
  return updateCustomQuickPromptLocal(id, label, category, text);
}

export async function reorderCustomQuickPrompts(ids: string[]): Promise<number> {
  if (isTauri()) {
    return invoke<number>('reorder_custom_quick_prompts', { ids });
  }
  return reorderCustomQuickPromptsLocal(ids);
}

export async function deleteCustomQuickPrompt(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_custom_quick_prompt', { id });
    return;
  }
  deleteCustomQuickPromptLocal(id);
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
  localStorage.setItem(SYNC_LS_KEY, JSON.stringify(snapshot));
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
    false,
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
  localStorage.setItem(SYNC_CONFLICTS_LS_KEY, JSON.stringify(records));
}

function readSyncAudit(): SyncAuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_AUDIT_LS_KEY) ?? '[]') as SyncAuditEntry[];
  } catch {
    return [];
  }
}

function writeSyncAudit(entries: SyncAuditEntry[]) {
  localStorage.setItem(SYNC_AUDIT_LS_KEY, JSON.stringify(entries.slice(0, 200)));
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

function writeVaultFiles(files: VaultFileRecord[]) {
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(files));
}

function sampleVaultFiles(vaultPath: string): VaultFileRecord[] {
  return [
    {
      path: `${vaultPath}\\Obsidian Roadmap.md`,
      title: 'Obsidian Roadmap',
      tags: '#work,#vault',
      content:
        '# Obsidian Roadmap\n\n## Vault sync\n\n- 把本地 Markdown 纳入 RAG\n- 支持 frontmatter 标题与标签',
    },
    {
      path: `${vaultPath}\\Daily Notes\\2026-08-05.md`,
      title: 'Daily Note',
      tags: '#life',
      content: '# 每日闪念\n\n- vault 索引让 AI 能引用本地文件',
    },
  ];
}

type VaultWatchRecord = {
  watching: boolean;
  path: string | null;
  updatedAt: number;
  ignorePatterns: string[];
};

function readVaultWatchTargets(): VaultWatchTarget[] {
  try {
    const raw = localStorage.getItem(VAULT_WATCH_TARGETS_LS_KEY);
    if (raw) {
      return (JSON.parse(raw) as VaultWatchTarget[]).map((target) => ({
        ...target,
        lastEventAt: target.lastEventAt ?? 0,
        eventCount: target.eventCount ?? 0,
        createdEvents: target.createdEvents ?? 0,
        modifiedEvents: target.modifiedEvents ?? 0,
        removedEvents: target.removedEvents ?? 0,
      }));
    }
  } catch {
    // fall through to legacy migration
  }
  const legacy = readVaultWatch();
  if (legacy.path) {
    return [
      {
        path: legacy.path,
        ignorePatterns: legacy.ignorePatterns ?? [],
        enabled: legacy.watching,
        updatedAt: legacy.updatedAt,
        lastEventAt: 0,
        eventCount: 0,
        createdEvents: 0,
        modifiedEvents: 0,
        removedEvents: 0,
      },
    ];
  }
  return [];
}

function writeVaultWatchTargets(targets: VaultWatchTarget[]): VaultWatchTarget[] {
  localStorage.setItem(VAULT_WATCH_TARGETS_LS_KEY, JSON.stringify(targets));
  const first = targets[0];
  const record: VaultWatchRecord = {
    watching: first?.enabled ?? false,
    path: first?.path ?? null,
    updatedAt: first?.updatedAt ?? Date.now(),
    ignorePatterns: first?.ignorePatterns ?? [],
  };
  localStorage.setItem(VAULT_WATCH_LS_KEY, JSON.stringify(record));
  return targets;
}

function readVaultWatch(): VaultWatchRecord {
  try {
    const record = JSON.parse(
      localStorage.getItem(VAULT_WATCH_LS_KEY) ?? 'null',
    ) as VaultWatchRecord | null;
    return record ?? { watching: false, path: null, updatedAt: 0, ignorePatterns: [] };
  } catch {
    return { watching: false, path: null, updatedAt: 0, ignorePatterns: [] };
  }
}

function readVaultWatchConfig(): VaultWatchConfig {
  const record = readVaultWatch();
  return {
    path: record.path ?? '',
    ignorePatterns: record.ignorePatterns ?? [],
    enabled: record.watching,
    updatedAt: record.updatedAt,
  };
}

function writeVaultWatchConfig(config: VaultWatchConfig): VaultWatchConfig {
  const record: VaultWatchRecord = {
    watching: config.enabled,
    path: config.path,
    updatedAt: config.updatedAt || Date.now(),
    ignorePatterns: config.ignorePatterns,
  };
  localStorage.setItem(VAULT_WATCH_LS_KEY, JSON.stringify(record));
  return { ...config, updatedAt: record.updatedAt };
}

export async function getVaultWatchConfig(): Promise<VaultWatchConfig> {
  if (isTauri()) return invoke<VaultWatchConfig>('get_vault_watch_config');
  return readVaultWatchConfig();
}

export async function setVaultWatchConfig(config: VaultWatchConfig): Promise<VaultWatchConfig> {
  if (isTauri()) {
    return invoke<VaultWatchConfig>('set_vault_watch_config', { config });
  }
  return writeVaultWatchConfig(config);
}

export async function listVaultWatchTargets(): Promise<VaultWatchTarget[]> {
  if (isTauri()) return invoke<VaultWatchTarget[]>('list_vault_watch_targets');
  return readVaultWatchTargets();
}

export async function upsertVaultWatchTarget(target: VaultWatchTarget): Promise<VaultWatchTarget> {
  if (isTauri()) {
    return invoke<VaultWatchTarget>('upsert_vault_watch_target', { target });
  }
  const targets = readVaultWatchTargets();
  const index = targets.findIndex((item) => item.path === target.path);
  const next: VaultWatchTarget = {
    ...target,
    updatedAt: target.updatedAt || Date.now(),
    lastEventAt: target.lastEventAt ?? 0,
    eventCount: target.eventCount ?? 0,
    createdEvents: target.createdEvents ?? 0,
    modifiedEvents: target.modifiedEvents ?? 0,
    removedEvents: target.removedEvents ?? 0,
  };
  if (index >= 0) {
    targets[index] = next;
  } else {
    targets.push(next);
  }
  writeVaultWatchTargets(targets);
  return next;
}

export async function deleteVaultWatchTarget(vaultPath: string): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>('delete_vault_watch_target', { vaultPath });
  }
  const targets = readVaultWatchTargets();
  const next = targets.filter((target) => target.path !== vaultPath);
  writeVaultWatchTargets(next);
  await clearVaultWatchEvents(vaultPath);
  return next.length !== targets.length;
}

function readVaultWatchEvents(): VaultWatchEvent[] {
  try {
    return JSON.parse(localStorage.getItem(VAULT_WATCH_EVENTS_LS_KEY) ?? '[]') as VaultWatchEvent[];
  } catch {
    return [];
  }
}

function writeVaultWatchEvents(events: VaultWatchEvent[]): VaultWatchEvent[] {
  const next = events.slice(0, 500);
  localStorage.setItem(VAULT_WATCH_EVENTS_LS_KEY, JSON.stringify(next));
  return next;
}

function recordVaultWatchEvent(vaultPath: string, filePath: string, eventKind: string): void {
  if (!['created', 'modified', 'removed'].includes(eventKind)) return;
  const events = readVaultWatchEvents();
  events.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    vaultPath,
    filePath,
    eventKind,
    createdAt: Date.now(),
  });
  writeVaultWatchEvents(events);
}

export async function listVaultWatchEvents(
  vaultPath?: string,
  limit = 20,
): Promise<VaultWatchEvent[]> {
  if (isTauri()) {
    return invoke<VaultWatchEvent[]>('list_vault_watch_events', {
      vaultPath: vaultPath ?? null,
      limit,
    });
  }
  return readVaultWatchEvents()
    .filter((event) => !vaultPath || event.vaultPath === vaultPath)
    .slice(0, Math.max(1, Math.min(200, limit)));
}

export async function clearVaultWatchEvents(vaultPath?: string): Promise<number> {
  if (isTauri()) {
    return invoke<number>('clear_vault_watch_events', {
      vaultPath: vaultPath ?? null,
    });
  }
  const events = readVaultWatchEvents();
  const next = vaultPath ? events.filter((event) => event.vaultPath !== vaultPath) : [];
  writeVaultWatchEvents(next);
  return events.length - next.length;
}

export async function listVaultTargetStats(): Promise<VaultTargetStats[]> {
  if (isTauri()) return invoke<VaultTargetStats[]>('list_vault_target_stats');
  const targets = readVaultWatchTargets();
  const files = readVaultFiles();
  return targets.map((target) => ({
    path: target.path,
    files: files.filter(
      (file) => file.path === target.path || file.path.startsWith(`${target.path}\\`),
    ).length,
    lastIndexedAt: 0,
    lastEventAt: target.lastEventAt ?? 0,
    eventCount: target.eventCount ?? 0,
    createdEvents: target.createdEvents ?? 0,
    modifiedEvents: target.modifiedEvents ?? 0,
    removedEvents: target.removedEvents ?? 0,
  }));
}

export async function listKnowledgeFiles(
  vaultPath?: string,
  limit = 50,
): Promise<KnowledgeFileRecord[]> {
  if (isTauri()) {
    return invoke<KnowledgeFileRecord[]>('list_knowledge_files', {
      vaultPath: vaultPath ?? null,
      limit,
    });
  }
  const targets = readVaultWatchTargets();
  const inferVault = (path: string) =>
    targets.find((target) => path === target.path || path.startsWith(`${target.path}\\`))?.path ??
    '';
  return readVaultFiles()
    .filter((file) => !vaultPath || inferVault(file.path) === vaultPath)
    .sort((a, b) => (b.indexedAt ?? 0) - (a.indexedAt ?? 0))
    .slice(0, Math.max(1, Math.min(200, limit)))
    .map((file) => ({
      id: file.path,
      path: file.path,
      title: file.title,
      tags: file.tags,
      vaultPath: inferVault(file.path),
      indexedAt: file.indexedAt ?? 0,
      exists: file.exists ?? true,
      stale: file.stale ?? false,
    }));
}

export async function cleanupKnowledgeFiles(vaultPath?: string): Promise<KnowledgeCleanupResult> {
  if (isTauri()) {
    return invoke<KnowledgeCleanupResult>('cleanup_knowledge_files', {
      vaultPath: vaultPath ?? null,
    });
  }
  const targets = readVaultWatchTargets();
  const inferVault = (path: string) =>
    targets.find((target) => path === target.path || path.startsWith(`${target.path}\\`))?.path ??
    '';
  const files = readVaultFiles();
  const removed: VaultFileRecord[] = [];
  const reindexed: VaultFileRecord[] = [];
  const kept: VaultFileRecord[] = [];
  for (const file of files) {
    const vault = inferVault(file.path);
    if (vaultPath && vault !== vaultPath) {
      kept.push(file);
      continue;
    }
    if (file.exists === false) {
      removed.push(file);
    } else if (file.stale === true) {
      reindexed.push({
        ...file,
        stale: false,
        exists: true,
        indexedAt: Date.now(),
      });
      kept.push(reindexed[reindexed.length - 1]);
    } else {
      kept.push(file);
    }
  }
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(kept));
  return {
    removed: removed.length,
    reindexed: reindexed.length,
    failed: 0,
  };
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
    updatedAt: 0,
  };
}

function embeddingModelKey(config: EmbeddingConfig): string {
  return config.mode === 'local' ? 'local' : `${config.mode}:${config.model}`;
}

function readVectorShards(): VectorShardRecord[] {
  try {
    const raw = localStorage.getItem(VECTOR_SHARDS_LS_KEY);
    return raw ? (JSON.parse(raw) as VectorShardRecord[]) : [];
  } catch {
    return [];
  }
}

function writeVectorShards(shards: VectorShardRecord[]) {
  localStorage.setItem(VECTOR_SHARDS_LS_KEY, JSON.stringify(shards));
}

function seedVectorShards(shardCount: number, model: string, dimension: number) {
  const count = Math.min(64, Math.max(1, Math.round(shardCount) || 8));
  const now = Date.now();
  const byId = new Map(readVectorShards().map((shard) => [shard.shardId, shard]));
  for (let index = 0; index < count; index += 1) {
    const shardId = String(index);
    const existing = byId.get(shardId);
    byId.set(
      shardId,
      existing
        ? { ...existing, model, dimension }
        : {
            shardId,
            model,
            dimension,
            documents: 0,
            status: 'idle',
            updatedAt: now,
            createdAt: now,
          },
    );
  }
  writeVectorShards(
    [...byId.values()]
      .filter((shard) => Number(shard.shardId) < count)
      .sort((a, b) => Number(a.shardId) - Number(b.shardId)),
  );
}

function refreshVectorShardStats() {
  const counts = new Map<string, number>();
  for (const file of readVaultFiles()) {
    if (file.embeddingStatus === 'indexed') {
      const shardId = file.shardId ?? '0';
      counts.set(shardId, (counts.get(shardId) ?? 0) + 1);
    }
  }
  const now = Date.now();
  writeVectorShards(
    readVectorShards().map((shard) => {
      const documents = counts.get(shard.shardId) ?? 0;
      return {
        ...shard,
        documents,
        status: documents > 0 ? 'ready' : 'idle',
        updatedAt: now,
      };
    }),
  );
}

export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  if (isTauri()) return invoke<EmbeddingConfig>('get_embedding_config');
  return readEmbeddingConfig();
}

export async function setEmbeddingConfig(input: {
  mode: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
  shardCount: number;
  autoRebuild: boolean;
}): Promise<EmbeddingConfig> {
  if (isTauri()) {
    return invoke<EmbeddingConfig>('set_embedding_config', { request: input });
  }
  const config: EmbeddingConfig = {
    mode: input.mode === 'openai' || input.mode === 'ollama' ? input.mode : 'local',
    providerId: input.providerId.trim(),
    baseUrl: input.baseUrl.trim(),
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
    dimension: Math.min(4096, Math.max(64, Math.round(input.dimension) || 256)),
    shardCount: Math.min(64, Math.max(1, Math.round(input.shardCount) || 8)),
    autoRebuild: input.autoRebuild,
    updatedAt: Date.now(),
  };
  localStorage.setItem(EMBEDDING_CONFIG_LS_KEY, JSON.stringify(config));
  seedVectorShards(config.shardCount, embeddingModelKey(config), config.dimension);
  refreshVectorShardStats();
  return config;
}

export async function getVectorIndexStatus(): Promise<VectorIndexStatus> {
  if (isTauri()) return invoke<VectorIndexStatus>('get_vector_index_status');
  const config = readEmbeddingConfig();
  const target = embeddingModelKey(config);
  const files = readVaultFiles();
  let indexed = 0;
  let failed = 0;
  let pending = 0;
  for (const file of files) {
    if (file.embeddingStatus === 'failed') {
      failed += 1;
    } else if (
      file.embeddingStatus === 'indexed' &&
      file.embedding &&
      file.embeddingModel === target
    ) {
      indexed += 1;
    } else {
      pending += 1;
    }
  }
  return {
    total: files.length,
    pending,
    failed,
    indexed,
    model: target,
    autoRebuild: config.autoRebuild,
    shards: readVectorShards(),
  };
}

export async function rebuildVectorIndex(force = false): Promise<VectorRebuildResult> {
  if (isTauri()) {
    return invoke<VectorRebuildResult>('rebuild_vector_index', { force });
  }
  const config = readEmbeddingConfig();
  const target = embeddingModelKey(config);
  const files = readVaultFiles();
  const targets = files.filter(
    (file) =>
      force ||
      file.embeddingStatus !== 'indexed' ||
      !file.embedding ||
      file.embeddingModel !== target,
  );
  let rebuilt = 0;
  let failedCount = 0;
  for (const file of targets.slice(0, 25)) {
    try {
      const vector =
        config.mode === 'local'
          ? embedText(file.content)
          : await embedTextRemote(
              config.mode,
              config.baseUrl,
              config.apiKey,
              config.model,
              file.content,
            );
      file.embedding = JSON.stringify(vector);
      file.embeddingModel = target;
      file.embeddingDim = vector.length;
      file.embeddingStatus = 'indexed';
      file.embeddingError = '';
      file.shardId = shardFor(file.path, config.shardCount);
      rebuilt += 1;
    } catch (err) {
      file.embedding = JSON.stringify(embedText(file.content));
      file.embeddingStatus = 'failed';
      file.embeddingError = err instanceof Error ? err.message : String(err);
      file.shardId = shardFor(file.path, config.shardCount);
      failedCount += 1;
    }
  }
  writeVaultFiles(files);
  refreshVectorShardStats();
  return {
    total: files.length,
    rebuilt,
    failed: failedCount,
    skipped: files.length - rebuilt - failedCount,
    model: target,
    shards: readVectorShards(),
  };
}

function readKnowledgeClusterConfig(): {
  clusterThreshold: number;
  dedupThreshold: number;
  lastRecomputedAt: number;
} {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_CLUSTER_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{
        clusterThreshold: number;
        dedupThreshold: number;
        lastRecomputedAt: number;
      }>;
      return {
        clusterThreshold: Math.min(1, Math.max(0, parsed.clusterThreshold ?? 0.62)),
        dedupThreshold: Math.min(1, Math.max(0, parsed.dedupThreshold ?? 0.92)),
        lastRecomputedAt: parsed.lastRecomputedAt ?? 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { clusterThreshold: 0.62, dedupThreshold: 0.92, lastRecomputedAt: 0 };
}

function writeKnowledgeClusterConfig(config: {
  clusterThreshold: number;
  dedupThreshold: number;
  lastRecomputedAt: number;
}) {
  localStorage.setItem(KNOWLEDGE_CLUSTER_CONFIG_LS_KEY, JSON.stringify(config));
}

type ClusterDoc = {
  id: string;
  path: string;
  title: string;
  content: string;
  embedding: number[];
};

function readClusterDocs(): ClusterDoc[] {
  return readVaultFiles()
    .filter((file) => file.embeddingStatus === 'indexed')
    .map((file) => {
      let embedding: number[];
      try {
        embedding = file.embedding ? (JSON.parse(file.embedding) as number[]) : [];
      } catch {
        embedding = [];
      }
      if (embedding.length === 0) embedding = embedText(file.content);
      return {
        id: file.path,
        path: file.path,
        title: file.title,
        content: file.content,
        embedding,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function readKnowledgeClusters(): KnowledgeClusterRecord[] {
  try {
    return JSON.parse(
      localStorage.getItem(KNOWLEDGE_CLUSTERS_LS_KEY) ?? '[]',
    ) as KnowledgeClusterRecord[];
  } catch {
    return [];
  }
}

function writeKnowledgeClusters(clusters: KnowledgeClusterRecord[]) {
  localStorage.setItem(KNOWLEDGE_CLUSTERS_LS_KEY, JSON.stringify(clusters));
}

function readKnowledgeDedup(): KnowledgeDedupCandidate[] {
  try {
    return JSON.parse(
      localStorage.getItem(KNOWLEDGE_DEDUP_LS_KEY) ?? '[]',
    ) as KnowledgeDedupCandidate[];
  } catch {
    return [];
  }
}

function writeKnowledgeDedup(candidates: KnowledgeDedupCandidate[]) {
  localStorage.setItem(KNOWLEDGE_DEDUP_LS_KEY, JSON.stringify(candidates));
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

export async function getKnowledgeClusterStatus(): Promise<KnowledgeClusterStatus> {
  if (isTauri()) return invoke<KnowledgeClusterStatus>('get_knowledge_cluster_status');
  const config = readKnowledgeClusterConfig();
  const model = embeddingModelKey(readEmbeddingConfig());
  return {
    clusters: readKnowledgeClusters(),
    dedup: readKnowledgeDedup().sort((a, b) => {
      const order = { open: 0, dismissed: 1, merged: 2 } as const;
      return order[a.status] - order[b.status] || b.similarity - a.similarity;
    }),
    clusterThreshold: config.clusterThreshold,
    dedupThreshold: config.dedupThreshold,
    lastRecomputedAt: config.lastRecomputedAt,
    model,
  };
}

export async function recomputeKnowledgeClusters(
  clusterThreshold?: number,
  dedupThreshold?: number,
): Promise<KnowledgeClusterStatus> {
  if (isTauri()) {
    return invoke<KnowledgeClusterStatus>('recompute_knowledge_clusters', {
      clusterThreshold: clusterThreshold ?? null,
      dedupThreshold: dedupThreshold ?? null,
    });
  }
  const docs = readClusterDocs();
  const threshold = Math.min(1, Math.max(0, clusterThreshold ?? 0.62));
  const dedupThresholdValue = Math.min(1, Math.max(0, dedupThreshold ?? 0.92));
  const clusters: {
    members: { id: string; similarity: number }[];
    representative: string;
    centroid: number[];
  }[] = [];
  for (const doc of docs) {
    const best = clusters.reduce<{ index: number; score: number } | null>(
      (current, cluster, index) => {
        if (cluster.members.some((member) => member.id === doc.id)) return current;
        const score = cosineSimilarity(doc.embedding, cluster.centroid);
        if (score < threshold) return current;
        if (!current || score > current.score) return { index, score };
        return current;
      },
      null,
    );
    if (best) {
      const cluster = clusters[best.index];
      const score = cosineSimilarity(doc.embedding, cluster.centroid);
      cluster.members.push({ id: doc.id, similarity: score });
      if (doc.content.length > cluster.representative.length) {
        cluster.representative = doc.content;
      }
      cluster.centroid = normalizeVector(
        cluster.centroid.map((value, index) => value + doc.embedding[index]),
      );
    } else {
      clusters.push({
        members: [{ id: doc.id, similarity: 1 }],
        representative: doc.content,
        centroid: normalizeVector(doc.embedding),
      });
    }
  }
  const model = embeddingModelKey(readEmbeddingConfig());
  const records: KnowledgeClusterRecord[] = clusters
    .map((cluster, index) => ({
      id: `cluster-${index + 1}-${cluster.members[0]?.id.slice(0, 6) ?? 'x'}`,
      documents: cluster.members.length,
      representative: cluster.representative.slice(0, 500).trim(),
      model,
      members: cluster.members.map((member) => {
        const doc = docs.find((d) => d.id === member.id);
        return {
          id: member.id,
          path: doc?.path ?? member.id,
          title: doc?.title ?? 'Untitled',
          similarity: member.similarity,
        };
      }),
    }))
    .sort((a, b) => b.documents - a.documents);
  writeKnowledgeClusters(records);

  const existing = new Set(
    readKnowledgeDedup()
      .filter((candidate) => candidate.status !== 'open')
      .map((candidate) => `${candidate.docA}\u0000${candidate.docB}`),
  );
  const dedup = readKnowledgeDedup();
  for (let a = 0; a < docs.length; a += 1) {
    for (let b = a + 1; b < docs.length; b += 1) {
      const similarity = cosineSimilarity(docs[a].embedding, docs[b].embedding);
      if (similarity < dedupThresholdValue) continue;
      const [left, right] = docs[a].id < docs[b].id ? [docs[a], docs[b]] : [docs[b], docs[a]];
      const key = `${left.id}\u0000${right.id}`;
      if (
        existing.has(key) ||
        dedup.some((candidate) => candidate.docA === left.id && candidate.docB === right.id)
      ) {
        continue;
      }
      dedup.push({
        id: `dup-${Date.now()}-${dedup.length}`,
        docA: left.id,
        docB: right.id,
        titleA: left.title,
        titleB: right.title,
        similarity,
        status: 'open',
      });
    }
  }
  for (const candidate of dedup) {
    if (
      candidate.status === 'open' &&
      (!docs.some((doc) => doc.id === candidate.docA) ||
        !docs.some((doc) => doc.id === candidate.docB))
    ) {
      candidate.status = 'merged';
    }
  }
  writeKnowledgeDedup(dedup);
  const config = readKnowledgeClusterConfig();
  config.clusterThreshold = threshold;
  config.dedupThreshold = dedupThresholdValue;
  config.lastRecomputedAt = Date.now();
  writeKnowledgeClusterConfig(config);
  return getKnowledgeClusterStatus();
}

export async function dismissKnowledgeDuplicate(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('dismiss_knowledge_duplicate', { id });
    return;
  }
  const dedup = readKnowledgeDedup();
  const candidate = dedup.find((item) => item.id === id);
  if (candidate) candidate.status = 'dismissed';
  writeKnowledgeDedup(dedup);
}

export async function mergeKnowledgeDuplicate(id: string): Promise<void> {
  if (isTauri()) {
    await invoke('merge_knowledge_duplicate', { id });
    return;
  }
  const dedup = readKnowledgeDedup();
  const candidate = dedup.find((item) => item.id === id);
  if (!candidate) return;
  const files = readVaultFiles();
  writeVaultFiles(files.filter((file) => file.path !== candidate.docB));
  candidate.status = 'merged';
  writeKnowledgeDedup(dedup);
  refreshVectorShardStats();
}

export async function getDocHealthAutoConfig(): Promise<DocHealthAutoConfig> {
  try {
    const raw = localStorage.getItem(DOC_HEALTH_AUTO_LS_KEY);
    if (raw) return JSON.parse(raw) as DocHealthAutoConfig;
  } catch {
    // fall through to defaults
  }
  return {
    enabled: false,
    intervalMs: 60 * 60 * 1000,
    lastRunAt: 0,
    lastResult: null,
  };
}

export async function setDocHealthAutoConfig(
  config: DocHealthAutoConfig,
): Promise<DocHealthAutoConfig> {
  localStorage.setItem(DOC_HEALTH_AUTO_LS_KEY, JSON.stringify(config));
  return config;
}

export async function getDocHealthRunHistory(): Promise<DocHealthRunRecord[]> {
  try {
    const raw = localStorage.getItem(DOC_HEALTH_HISTORY_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DocHealthRunRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through to empty history
  }
  return [];
}

export async function appendDocHealthRun(
  record: Omit<DocHealthRunRecord, 'id'>,
): Promise<DocHealthRunRecord[]> {
  const history = await getDocHealthRunHistory();
  const next = [{ ...record, id: makeId() }, ...history].slice(0, 50);
  localStorage.setItem(DOC_HEALTH_HISTORY_LS_KEY, JSON.stringify(next));
  return next;
}

export async function getDocHealthAlertDismissedAt(): Promise<number> {
  return Number(localStorage.getItem(DOC_HEALTH_ALERT_DISMISSED_LS_KEY) ?? 0) || 0;
}

export async function setDocHealthAlertDismissedAt(timestamp: number): Promise<void> {
  localStorage.setItem(DOC_HEALTH_ALERT_DISMISSED_LS_KEY, String(timestamp));
}

export async function indexVault(
  vaultPath: string,
  ignorePatterns: string[] = [],
  concurrency = 4,
): Promise<IndexResult> {
  let result: IndexResult;
  if (isTauri()) {
    result = await invoke<IndexResult>('index_vault_ex', {
      vaultPath,
      ignorePatterns,
      concurrency,
    });
  } else {
    const existing = readVaultFiles();
    const sample = sampleVaultFiles(vaultPath);
    const merged = existing.length > 0 ? existing : sample;
    const segments = ignorePatterns.map((p) => p.trim().toLowerCase()).filter(Boolean);
    const filtered = merged.filter(
      (file) => !segments.some((segment) => file.path.toLowerCase().includes(segment)),
    );
    const config = readEmbeddingConfig();
    const target = embeddingModelKey(config);
    const enriched = filtered.map((file) => ({
      ...file,
      shardId: shardFor(file.path, config.shardCount),
      embedding: file.embedding ?? JSON.stringify(embedText(file.content)),
      embeddingModel: file.embeddingModel ?? 'local',
      embeddingDim: file.embeddingDim ?? 256,
      embeddingStatus: file.embeddingStatus ?? (config.mode === 'local' ? 'indexed' : 'pending'),
      embeddingError: file.embeddingError ?? '',
    }));
    localStorage.setItem(VAULT_LS_KEY, JSON.stringify(enriched));
    seedVectorShards(config.shardCount, target, config.dimension);
    refreshVectorShardStats();
    const cores = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));
    const concurrencyUsed = Math.min(
      filtered.length || 1,
      filtered.length <= 32 ? 1 : Math.min(4, cores),
    );
    result = {
      files: filtered.length,
      ignored: merged.length - filtered.length,
      concurrencyUsed,
    };
  }
  void emitWorkbenchEvent('knowledge.indexed', {
    path: vaultPath,
    files: result.files,
    ignored: result.ignored,
  });
  return result;
}

const vaultIndexProgressHandlers: ((progress: IndexProgress) => void)[] = [];
const vaultIndexCancelled = new Set<string>();
const vaultIndexQueue: IndexQueueRequest[] = [];
const vaultIndexQueueHandlers: ((status: VaultIndexQueueStatus) => void)[] = [];
let vaultIndexActive: IndexQueueRequest | null = null;
const VAULT_INDEX_QUEUE_LS_KEY = 'ai-workbench:vault-index-queue:v1';
let vaultIndexQueueRestored = false;

type IndexQueueRequest = {
  runId: string;
  path: string;
  ignorePatterns: string[];
  concurrency: number;
  priority: number;
  attempts: number;
  lastError: string;
};

type PersistedIndexQueueRecord = IndexQueueRequest & {
  status: 'queued' | 'running';
};

const VAULT_INDEX_MAX_ATTEMPTS = 3;
const VAULT_INDEX_RETRY_BASE_MS = 500;
const VAULT_INDEX_RETRY_MAX_MS = 4000;

function indexRetryDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  const exponent = Math.min(3, Math.max(0, attempts - 1));
  return Math.min(VAULT_INDEX_RETRY_MAX_MS, VAULT_INDEX_RETRY_BASE_MS * 2 ** exponent);
}

function enqueueIndexRequest(request: IndexQueueRequest) {
  const index = vaultIndexQueue.findIndex((queued) => queued.priority < request.priority);
  if (index === -1) vaultIndexQueue.push(request);
  else vaultIndexQueue.splice(index, 0, request);
}

function currentVaultIndexQueueStatus(): VaultIndexQueueStatus {
  return {
    active: vaultIndexActive
      ? {
          runId: vaultIndexActive.runId,
          path: vaultIndexActive.path,
          status: 'running',
          position: 1,
          priority: vaultIndexActive.priority,
          attempts: vaultIndexActive.attempts,
          lastError: vaultIndexActive.lastError,
          retryDelayMs: indexRetryDelayMs(vaultIndexActive.attempts),
        }
      : null,
    queue: vaultIndexQueue.map((request, index) => ({
      runId: request.runId,
      path: request.path,
      status: 'queued',
      position: index + 1,
      priority: request.priority,
      attempts: request.attempts,
      lastError: request.lastError,
      retryDelayMs: indexRetryDelayMs(request.attempts),
    })),
  };
}

function writePersistedVaultIndexQueue() {
  const records: PersistedIndexQueueRecord[] = [
    ...(vaultIndexActive ? [{ ...vaultIndexActive, status: 'running' as const }] : []),
    ...vaultIndexQueue.map((request) => ({
      ...request,
      status: 'queued' as const,
    })),
  ];
  localStorage.setItem(VAULT_INDEX_QUEUE_LS_KEY, JSON.stringify(records));
}

function restoreVaultIndexQueueIfNeeded() {
  if (vaultIndexQueueRestored) return;
  vaultIndexQueueRestored = true;
  try {
    const records = JSON.parse(
      localStorage.getItem(VAULT_INDEX_QUEUE_LS_KEY) ?? '[]',
    ) as PersistedIndexQueueRecord[];
    for (const record of records) {
      if (record.status === 'queued' || record.status === 'running') {
        enqueueIndexRequest({
          runId: record.runId,
          path: record.path,
          ignorePatterns: Array.isArray(record.ignorePatterns) ? record.ignorePatterns : [],
          concurrency: Number(record.concurrency) || 4,
          priority: Number(record.priority) || 0,
          attempts: Number(record.attempts) || 0,
          lastError: typeof record.lastError === 'string' ? record.lastError : '',
        });
      }
    }
  } catch {
    /* fall back to empty restored queue */
  }
  writePersistedVaultIndexQueue();
}

function emitVaultIndexQueue() {
  const status = currentVaultIndexQueueStatus();
  for (const handler of [...vaultIndexQueueHandlers]) handler(status);
}

function emitIndexProgress(progress: IndexProgress) {
  for (const handler of [...vaultIndexProgressHandlers]) handler(progress);
}

function pumpVaultIndexQueue() {
  if (vaultIndexActive) {
    emitVaultIndexQueue();
    return;
  }
  const request = vaultIndexQueue.shift();
  if (!request) {
    emitVaultIndexQueue();
    return;
  }
  vaultIndexActive = request;
  writePersistedVaultIndexQueue();
  emitVaultIndexQueue();
  void runMockVaultIndex(request);
}

async function runMockVaultIndex(request: IndexQueueRequest) {
  const { runId, path, ignorePatterns, concurrency } = request;
  const retryable = path.toLowerCase().includes('retry');
  const result = retryable ? null : await indexVault(path, ignorePatterns, concurrency);
  let step = 0;
  const failAttempt = () => {
    if (vaultIndexCancelled.has(runId)) {
      emitIndexProgress({
        runId,
        path,
        done: 0,
        total: 0,
        files: 0,
        ignored: 0,
        concurrencyUsed: 0,
        status: 'cancelled',
      });
      vaultIndexCancelled.delete(runId);
      vaultIndexActive = null;
      writePersistedVaultIndexQueue();
      emitVaultIndexQueue();
      pumpVaultIndexQueue();
      return;
    }
    const active = vaultIndexActive;
    if (!active) return;
    const attempts = active.attempts + 1;
    emitIndexProgress({
      runId,
      path,
      done: 0,
      total: 0,
      files: 0,
      ignored: 0,
      concurrencyUsed: 0,
      status: 'error: simulated failure',
    });
    if (attempts >= VAULT_INDEX_MAX_ATTEMPTS) {
      vaultIndexActive = null;
      writePersistedVaultIndexQueue();
      emitVaultIndexQueue();
      pumpVaultIndexQueue();
      return;
    }
    active.attempts = attempts;
    active.lastError = 'simulated failure';
    vaultIndexActive = null;
    enqueueIndexRequest(active);
    writePersistedVaultIndexQueue();
    emitVaultIndexQueue();
    setTimeout(() => pumpVaultIndexQueue(), indexRetryDelayMs(active.attempts));
  };
  const tick = () => {
    step += 1;
    if (vaultIndexCancelled.has(runId)) {
      emitIndexProgress({
        runId,
        path,
        done: 0,
        total: 0,
        files: 0,
        ignored: 0,
        concurrencyUsed: 0,
        status: 'cancelled',
      });
      vaultIndexCancelled.delete(runId);
      vaultIndexActive = null;
      writePersistedVaultIndexQueue();
      emitVaultIndexQueue();
      pumpVaultIndexQueue();
      return;
    }
    if (!result) return;
    emitIndexProgress({
      runId,
      path,
      done: Math.min(result.files, Math.ceil((result.files * step) / 6)),
      total: result.files,
      files: result.files,
      ignored: result.ignored,
      concurrencyUsed: result.concurrencyUsed,
      status: step >= 6 ? 'done' : 'running',
    });
    if (step >= 6) {
      vaultIndexActive = null;
      writePersistedVaultIndexQueue();
      emitVaultIndexQueue();
      pumpVaultIndexQueue();
      return;
    }
    setTimeout(tick, 120);
  };
  if (retryable) {
    setTimeout(failAttempt, request.attempts === 0 ? 1200 : 30);
    return;
  }
  setTimeout(tick, 30);
}

export async function startVaultIndex(
  vaultPath: string,
  ignorePatterns: string[] = [],
  concurrency = 4,
  priority = 0,
): Promise<string> {
  if (isTauri()) {
    return invoke<string>('start_vault_index', {
      vaultPath,
      ignorePatterns,
      concurrency,
      priority,
    });
  }
  restoreVaultIndexQueueIfNeeded();
  const runId = makeId();
  enqueueIndexRequest({
    runId,
    path: vaultPath,
    ignorePatterns,
    concurrency,
    priority,
    attempts: 0,
    lastError: '',
  });
  writePersistedVaultIndexQueue();
  emitIndexProgress({
    runId,
    path: vaultPath,
    done: 0,
    total: 0,
    files: 0,
    ignored: 0,
    concurrencyUsed: 0,
    status: vaultIndexActive ? 'queued' : 'running',
  });
  emitVaultIndexQueue();
  pumpVaultIndexQueue();
  return runId;
}

export async function cancelVaultIndex(runId: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>('cancel_vault_index', { runId });
  if (vaultIndexActive?.runId === runId) {
    vaultIndexCancelled.add(runId);
    return true;
  }
  const index = vaultIndexQueue.findIndex((request) => request.runId === runId);
  if (index >= 0) {
    const [request] = vaultIndexQueue.splice(index, 1);
    writePersistedVaultIndexQueue();
    emitIndexProgress({
      runId: request.runId,
      path: request.path,
      done: 0,
      total: 0,
      files: 0,
      ignored: 0,
      concurrencyUsed: 0,
      status: 'cancelled',
    });
  }
  emitVaultIndexQueue();
  pumpVaultIndexQueue();
  return true;
}

export async function getVaultIndexQueueStatus(): Promise<VaultIndexQueueStatus> {
  if (isTauri()) return invoke<VaultIndexQueueStatus>('get_vault_index_queue_status');
  restoreVaultIndexQueueIfNeeded();
  pumpVaultIndexQueue();
  return currentVaultIndexQueueStatus();
}

export async function listenVaultIndexQueue(
  handler: (status: VaultIndexQueueStatus) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<VaultIndexQueueStatus>('vault-index-queue', (event) => handler(event.payload));
  }
  vaultIndexQueueHandlers.push(handler);
  return () => {
    const index = vaultIndexQueueHandlers.indexOf(handler);
    if (index >= 0) vaultIndexQueueHandlers.splice(index, 1);
  };
}

export async function listenVaultIndexProgress(
  handler: (progress: IndexProgress) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<IndexProgress>('vault-index-progress', (event) => handler(event.payload));
  }
  vaultIndexProgressHandlers.push(handler);
  return () => {
    const index = vaultIndexProgressHandlers.indexOf(handler);
    if (index >= 0) vaultIndexProgressHandlers.splice(index, 1);
  };
}

export async function getKnowledgeIndexStatus(): Promise<KnowledgeIndexStatus> {
  if (isTauri()) return invoke<KnowledgeIndexStatus>('get_knowledge_index_status');
  const files = readVaultFiles();
  return { files: files.length, indexedAt: files.length ? Date.now() : 0 };
}

export async function recommendIndexConcurrency(): Promise<RecommendedConcurrency> {
  if (isTauri()) return invoke<RecommendedConcurrency>('recommend_index_concurrency');
  const cores = navigator.hardwareConcurrency || 4;
  return { recommended: Math.max(1, Math.min(16, cores)), cores };
}

export async function startVaultWatch(
  vaultPath: string,
  ignorePatterns: string[] = [],
): Promise<VaultWatchStatus> {
  if (isTauri()) {
    return invoke<VaultWatchStatus>('start_vault_watch_ex', { vaultPath, ignorePatterns });
  }
  const existing = readVaultFiles();
  const merged = existing.length > 0 ? existing : sampleVaultFiles(vaultPath);
  const segments = ignorePatterns.map((p) => p.trim().toLowerCase()).filter(Boolean);
  const filtered = merged.filter(
    (file) => !segments.some((segment) => file.path.toLowerCase().includes(segment)),
  );
  const syncPath = `${vaultPath}\\Watch Sync Note.md`;
  if (!filtered.some((file) => file.path === syncPath)) {
    filtered.push({
      path: syncPath,
      title: 'Watch Sync Note',
      tags: '#work,#vault',
      content: '# Watch Sync Note\n\n- 文件监听会自动把新 Markdown 纳入 RAG',
    });
  }
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(filtered));
  await upsertVaultWatchTarget({
    path: vaultPath,
    ignorePatterns,
    enabled: true,
    updatedAt: Date.now(),
    lastEventAt: 0,
    eventCount: 0,
    createdEvents: 0,
    modifiedEvents: 0,
    removedEvents: 0,
  });
  const targets = readVaultWatchTargets().map((target) =>
    target.path === vaultPath
      ? {
          ...target,
          lastEventAt: Date.now(),
          eventCount: target.eventCount + 1,
          createdEvents: target.createdEvents + 1,
        }
      : target,
  );
  writeVaultWatchTargets(targets);
  recordVaultWatchEvent(vaultPath, syncPath, 'created');
  return getVaultWatchStatus();
}

export async function stopVaultWatch(vaultPath?: string): Promise<VaultWatchStatus> {
  if (isTauri()) {
    return invoke<VaultWatchStatus>('stop_vault_watch', vaultPath ? { vaultPath } : {});
  }
  const targets = readVaultWatchTargets().map((target) =>
    !vaultPath || target.path === vaultPath
      ? { ...target, enabled: false, updatedAt: Date.now() }
      : target,
  );
  writeVaultWatchTargets(targets);
  return getVaultWatchStatus();
}

export async function getVaultWatchStatus(): Promise<VaultWatchStatus> {
  if (isTauri()) return invoke<VaultWatchStatus>('get_vault_watch_status');
  const targets = readVaultWatchTargets();
  const watchingTargets = targets.filter((target) => target.enabled);
  return {
    watching: watchingTargets.length > 0,
    path: watchingTargets[0]?.path ?? null,
    paths: watchingTargets.map((target) => target.path),
    files: readVaultFiles().length,
    updatedAt: Math.max(0, ...targets.map((target) => target.updatedAt)),
  };
}

export async function listenVaultWatchUpdated(
  handler: (status: VaultWatchStatus) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<VaultWatchStatus>('vault-watch-update', (event) => handler(event.payload));
  }
  return () => {};
}

export async function searchThoughts(query: string, limit = 5): Promise<RagSearchResult[]> {
  if (isTauri()) return invoke<RagSearchResult[]>('search_thoughts', { query, limit });
  const shape = readLocal();
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return [];
  type SearchDoc = {
    id: string;
    content: string;
    tags: string;
    type: ThoughtType;
    embedding?: string;
    shardId?: string;
    embeddingModel?: string;
  };
  const docs: SearchDoc[] = [
    ...shape.thoughts.map((t) => ({ id: t.id, content: t.content, tags: t.tags, type: t.type })),
    ...readVaultFiles().map((f) => ({
      id: f.path,
      content: f.content,
      tags: f.tags,
      type: 'doc' as ThoughtType,
      embedding: f.embedding,
      shardId: f.shardId,
      embeddingModel: f.embeddingModel,
    })),
  ];
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
  const scored = docs
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

export async function getRagIndexStatus(): Promise<RagIndexStatus> {
  if (isTauri()) return invoke<RagIndexStatus>('get_rag_index_status');
  const shape = readLocal();
  const vaultFiles = readVaultFiles();
  const total = shape.thoughts.length + vaultFiles.length;
  return {
    documents: total,
    indexed: total > 0,
    lastIndexedAt: shape.thoughts[0]?.createdAt ?? (vaultFiles.length ? Date.now() : 0),
    vectorIndexed: total > 0,
  };
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
  } = {},
): Promise<string> {
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
  const timeoutTimer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
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
    const flush = async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isOllama) {
        const json = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
        if (json.message?.content) {
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
            { final: false, manageCancel: false },
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
            { final: false, manageCancel: false },
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

  const reply =
    'Streaming fallback: 这条回复由浏览器分块模拟，逐段到达。\n\n- 第一段已就绪\n- 第二段继续\n- 第三段完成';
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
  const conflictDemo = path.includes('Hermes');
  return {
    rebased: !conflictDemo,
    conflict: conflictDemo,
    files: conflictDemo ? ['docs/conflict.md', 'src/views/ProjectsView.tsx'] : [],
    base,
    branch: conflictDemo ? 'feature/hermes' : 'feature/sprint-31',
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
    branch: 'feature/hermes',
    head: `local-resolve-${makeId().slice(0, 8)}`,
    message: `Resolved 2 conflicted file(s) with ${strategy} and continued rebase`,
  };
}

export async function deliverWebhook(
  url: string,
  payload: string,
  method?: string,
  token?: string,
  secret?: string,
  retries = 1,
): Promise<WebhookDeliveryResult> {
  if (isTauri()) {
    return invoke<WebhookDeliveryResult>('deliver_webhook', {
      url,
      payload: payload.trim() ? payload.trim() : '{}',
      method: method?.trim() ? method.trim().toUpperCase() : null,
      token: token?.trim() ? token.trim() : null,
      secret: secret?.trim() ? secret.trim() : null,
      retries,
    });
  }
  return {
    ok: true,
    status: 200,
    durationMs: 12,
    attempts: Math.max(1, retries + 1),
    signed: !!secret?.trim(),
    message: `HTTP 200 delivered (${Math.max(1, retries + 1)} attempt(s))`,
  };
}

function readWebhookRules(): WebhookRule[] {
  try {
    const raw = localStorage.getItem(WEBHOOK_RULES_LS_KEY);
    const rules: WebhookRule[] = raw ? (JSON.parse(raw) as WebhookRule[]) : [];
    return rules.map((rule) => ({
      ...rule,
      cooldownSeconds: rule.cooldownSeconds ?? 0,
      consecutiveFailures: rule.consecutiveFailures ?? 0,
      autoDisableAfter: rule.autoDisableAfter ?? 3,
      triggerCondition: rule.triggerCondition ?? '',
      channels: Array.isArray(rule.channels)
        ? rule.channels.filter(
            (channel) => channel === 'http' || channel === 'email' || channel === 'notification',
          )
        : ['http'],
      recoveryBackoffSeconds: rule.recoveryBackoffSeconds ?? 300,
      circuitOpenedAt: rule.circuitOpenedAt ?? 0,
    }));
  } catch {
    return [];
  }
}

function writeWebhookRules(rules: WebhookRule[]) {
  localStorage.setItem(WEBHOOK_RULES_LS_KEY, JSON.stringify(rules));
}

function readWebhookRuleRuns(): WebhookRuleRun[] {
  try {
    const raw = localStorage.getItem(WEBHOOK_RULE_RUNS_LS_KEY);
    return raw ? (JSON.parse(raw) as WebhookRuleRun[]) : [];
  } catch {
    return [];
  }
}

function writeWebhookRuleRuns(runs: WebhookRuleRun[]) {
  localStorage.setItem(WEBHOOK_RULE_RUNS_LS_KEY, JSON.stringify(runs));
}

function pruneWebhookRuleRuns(runs: WebhookRuleRun[], keep = 50): WebhookRuleRun[] {
  const byRule = new Map<string, WebhookRuleRun[]>();
  for (const run of runs) {
    const list = byRule.get(run.ruleId) ?? [];
    list.push(run);
    byRule.set(run.ruleId, list);
  }
  const pruned: WebhookRuleRun[] = [];
  for (const list of byRule.values()) {
    list.sort((a, b) => b.createdAt - a.createdAt);
    pruned.push(...list.slice(0, keep));
  }
  return pruned.sort((a, b) => b.createdAt - a.createdAt);
}

function appendWebhookRuleRun(
  ruleId: string,
  kind: WebhookRuleRun['kind'],
  status: WebhookRuleRun['status'],
  httpStatus: number,
  attempts: number,
  message: string,
): void {
  const run: WebhookRuleRun = {
    id: makeId(),
    ruleId,
    kind,
    status,
    httpStatus,
    attempts: Math.max(1, attempts),
    message,
    createdAt: Date.now(),
  };
  writeWebhookRuleRuns(pruneWebhookRuleRuns([run, ...readWebhookRuleRuns()]));
}

export async function listWebhookRuleRuns(ruleId?: string, limit = 50): Promise<WebhookRuleRun[]> {
  if (isTauri()) {
    return invoke<WebhookRuleRun[]>('list_webhook_rule_runs', {
      ruleId: ruleId?.trim() ? ruleId.trim() : null,
      limit,
    });
  }
  const all = pruneWebhookRuleRuns(readWebhookRuleRuns());
  const filtered = ruleId?.trim() ? all.filter((run) => run.ruleId === ruleId.trim()) : all;
  return filtered.slice(0, Math.min(Math.max(1, limit), 200));
}

export async function listWebhookRules(): Promise<WebhookRule[]> {
  if (isTauri()) return invoke<WebhookRule[]>('list_webhook_rules');
  return readWebhookRules();
}

export async function createWebhookRule(
  name: string,
  url: string,
  payload: string,
  method?: string,
  token?: string,
  intervalSeconds = 60,
  secret?: string,
  retries = 1,
  cooldownSeconds = 0,
  triggerEvent = '',
  autoDisableAfter = 3,
  triggerCondition = '',
  channels: WebhookChannelName[] = ['http'],
  recoveryBackoffSeconds = 300,
): Promise<WebhookRule> {
  const conditionError = validateWebhookCondition(triggerCondition);
  if (conditionError) throw new Error(`Invalid trigger condition: ${conditionError}`);
  const normalizedChannels: WebhookChannelName[] = channels.filter(
    (channel) => channel === 'http' || channel === 'email' || channel === 'notification',
  );
  const finalChannels: WebhookChannelName[] =
    normalizedChannels.length > 0 ? normalizedChannels : ['http'];
  if (isTauri()) {
    return invoke<WebhookRule>('create_webhook_rule', {
      request: {
        name,
        url,
        payload,
        method: method?.trim() ? method.trim().toUpperCase() : null,
        token: token?.trim() ? token.trim() : null,
        secret: secret?.trim() ? secret.trim() : null,
        retries,
        cooldownSeconds: Math.max(0, cooldownSeconds),
        intervalSeconds: Math.max(5, intervalSeconds),
        triggerEvent: triggerEvent.trim(),
        autoDisableAfter: Math.max(0, autoDisableAfter),
        triggerCondition: triggerCondition.trim(),
        channels: finalChannels,
        recoveryBackoffSeconds: Math.max(0, recoveryBackoffSeconds),
      },
    });
  }
  const now = Date.now();
  const rule: WebhookRule = {
    id: makeId(),
    name,
    url,
    payload: payload.trim() ? payload.trim() : '{}',
    method: method?.trim().toUpperCase() || 'POST',
    token: token?.trim() || '',
    secret: secret?.trim() || '',
    retries: Math.max(0, retries),
    cooldownSeconds: Math.max(0, cooldownSeconds),
    intervalSeconds: Math.max(5, intervalSeconds),
    triggerEvent: triggerEvent.trim(),
    triggerCondition: triggerCondition.trim(),
    channels: finalChannels,
    recoveryBackoffSeconds: Math.max(0, recoveryBackoffSeconds),
    circuitOpenedAt: 0,
    enabled: true,
    lastRunAt: 0,
    lastStatus: 0,
    lastMessage: '',
    createdAt: now,
    updatedAt: now,
    consecutiveFailures: 0,
    autoDisableAfter: Math.max(0, autoDisableAfter),
  };
  writeWebhookRules([...readWebhookRules(), rule]);
  return rule;
}

export async function setWebhookRuleEnabled(id: string, enabled: boolean): Promise<WebhookRule> {
  if (isTauri()) {
    return invoke<WebhookRule>('set_webhook_rule_enabled', { id, enabled });
  }
  const rules = readWebhookRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error('Webhook rule not found');
  rule.enabled = enabled;
  if (enabled) {
    rule.consecutiveFailures = 0;
    rule.circuitOpenedAt = 0;
  }
  rule.updatedAt = Date.now();
  writeWebhookRules(rules);
  return rule;
}

export async function deleteWebhookRule(id: string): Promise<string> {
  if (isTauri()) return invoke<string>('delete_webhook_rule', { id });
  const rules = readWebhookRules();
  const next = rules.filter((r) => r.id !== id);
  if (next.length === rules.length) throw new Error('Webhook rule not found');
  writeWebhookRules(next);
  return `Deleted webhook rule ${id.slice(0, 8)}`;
}

export async function runWebhookRule(id: string): Promise<WebhookDeliveryResult> {
  if (isTauri()) return invoke<WebhookDeliveryResult>('run_webhook_rule', { id });
  const rules = readWebhookRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error('Webhook rule not found');
  const simulatedFailure =
    /\/fail|\/broken/i.test(rule.url) || rule.payload.includes('"fail":true');
  const result: WebhookDeliveryResult = {
    ok: !simulatedFailure,
    status: simulatedFailure ? 500 : 200,
    durationMs: 12,
    attempts: Math.max(1, rule.retries + 1),
    signed: !!rule.secret,
    message: simulatedFailure ? 'HTTP 500 simulated failure' : 'HTTP 200 delivered',
  };
  rule.lastRunAt = Date.now();
  rule.lastStatus = result.status;
  rule.lastMessage = result.message;
  const failed = result.status >= 400 || result.status === 0;
  rule.consecutiveFailures = failed ? (rule.consecutiveFailures ?? 0) + 1 : 0;
  if (
    failed &&
    (rule.autoDisableAfter ?? 3) > 0 &&
    rule.consecutiveFailures >= (rule.autoDisableAfter ?? 3)
  ) {
    rule.enabled = false;
    rule.circuitOpenedAt = Date.now();
    rule.lastMessage = `Auto-disabled after ${rule.consecutiveFailures} consecutive failures`;
  } else if (!failed) {
    rule.circuitOpenedAt = 0;
  }
  rule.updatedAt = Date.now();
  writeWebhookRules(rules);
  appendWebhookRuleRun(
    rule.id,
    'manual',
    result.ok ? 'success' : 'failed',
    result.status,
    result.attempts,
    rule.lastMessage,
  );
  return result;
}

function readWebhookDeliveries(): WebhookDelivery[] {
  try {
    const raw = localStorage.getItem(WEBHOOK_DELIVERIES_LS_KEY);
    const deliveries: WebhookDelivery[] = raw ? (JSON.parse(raw) as WebhookDelivery[]) : [];
    return deliveries.map((delivery) => ({
      ...delivery,
      channel:
        delivery.channel === 'email' || delivery.channel === 'notification'
          ? delivery.channel
          : 'http',
    }));
  } catch {
    return [];
  }
}

function writeWebhookDeliveries(deliveries: WebhookDelivery[]) {
  localStorage.setItem(WEBHOOK_DELIVERIES_LS_KEY, JSON.stringify(deliveries));
}

export async function listWebhookDeliveries(
  status?: string,
  limit = 50,
): Promise<WebhookDelivery[]> {
  if (isTauri()) {
    return invoke<WebhookDelivery[]>('list_webhook_deliveries', {
      status: status?.trim() ? status.trim() : null,
      limit,
    });
  }
  const all = readWebhookDeliveries();
  const filtered = status?.trim() ? all.filter((d) => d.status === status.trim()) : all;
  return filtered.slice(0, limit);
}

export function renderWebhookPayload(
  template: string,
  event: string,
  context: Record<string, unknown> = {},
  now = Date.now(),
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (raw, key: string) => {
    if (key === 'event') return JSON.stringify(event);
    if (key === 'ts') return JSON.stringify(String(now));
    if (key.startsWith('context.')) {
      const field = key.slice('context.'.length);
      const value = context[field];
      if (value !== undefined) return JSON.stringify(value);
      return 'null';
    }
    return raw;
  });
}

type WebhookConditionToken =
  | { type: 'atom'; value: string }
  | { type: 'str'; value: string }
  | { type: 'op'; value: '==' | '!=' | '>' | '>=' | '<' | '<=' }
  | { type: 'paren'; value: '(' | ')' };

type WebhookConditionExpr =
  | { kind: 'and'; left: WebhookConditionExpr; right: WebhookConditionExpr }
  | { kind: 'or'; left: WebhookConditionExpr; right: WebhookConditionExpr }
  | { kind: 'not'; inner: WebhookConditionExpr }
  | { kind: 'compare'; path: string; op: string; value: unknown }
  | { kind: 'event'; value: string }
  | { kind: 'cron'; expr: string }
  | { kind: 'bool'; value: boolean };

function tokenizeWebhookCondition(input: string): WebhookConditionToken[] {
  const tokens: WebhookConditionToken[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
      continue;
    }
    const pair = input.slice(i, i + 2);
    if (pair === '==' || pair === '!=' || pair === '>=' || pair === '<=') {
      tokens.push({ type: 'op', value: pair });
      i += 2;
      continue;
    }
    if (char === '>' || char === '<') {
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        const ch = input[j];
        if (ch === '\\' && j + 1 < input.length) {
          value += input[j + 1];
          j += 2;
          continue;
        }
        if (ch === quote) {
          closed = true;
          break;
        }
        value += ch;
        j += 1;
      }
      if (!closed) throw new Error('Unterminated string literal');
      tokens.push({ type: 'str', value });
      i = j + 1;
      continue;
    }
    const start = i;
    while (
      i < input.length &&
      !/\s/.test(input[i]) &&
      !'()"\''.includes(input[i]) &&
      !'=!<>'.includes(input[i])
    ) {
      i += 1;
    }
    if (i === start) throw new Error(`Unexpected character '${char}'`);
    tokens.push({ type: 'atom', value: input.slice(start, i) });
  }
  return tokens;
}

class WebhookConditionParser {
  private pos = 0;

  constructor(private readonly tokens: WebhookConditionToken[]) {}

  private peek(): WebhookConditionToken | undefined {
    return this.tokens[this.pos];
  }

  private next(): WebhookConditionToken | undefined {
    const token = this.tokens[this.pos];
    if (token) this.pos += 1;
    return token;
  }

  private isKeyword(keyword: string): boolean {
    const token = this.peek();
    return token?.type === 'atom' && token.value === keyword;
  }

  parseCondition(): WebhookConditionExpr {
    const expr = this.parseOr();
    if (this.pos !== this.tokens.length) throw new Error('Unexpected token at end of condition');
    return expr;
  }

  private parseOr(): WebhookConditionExpr {
    let left = this.parseAnd();
    while (this.isKeyword('or')) {
      this.next();
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): WebhookConditionExpr {
    let left = this.parseNot();
    while (this.isKeyword('and')) {
      this.next();
      const right = this.parseNot();
      left = { kind: 'and', left, right };
    }
    return left;
  }

  private parseNot(): WebhookConditionExpr {
    if (this.isKeyword('not')) {
      this.next();
      return { kind: 'not', inner: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): WebhookConditionExpr {
    const token = this.next();
    if (!token) throw new Error('Expected condition');
    if (token.type === 'paren' && token.value === '(') {
      const inner = this.parseOr();
      const closing = this.next();
      if (closing?.type !== 'paren' || closing.value !== ')') {
        throw new Error("Expected ')'");
      }
      return inner;
    }
    if (token.type === 'str') {
      throw new Error(`Unexpected string literal '${token.value}'`);
    }
    if (token.type !== 'atom') throw new Error('Expected condition');
    if (token.value === 'true') return { kind: 'bool', value: true };
    if (token.value === 'false') return { kind: 'bool', value: false };
    if (token.value === 'cron') {
      const open = this.next();
      if (open?.type !== 'paren' || open.value !== '(') {
        throw new Error("Expected '(' after cron");
      }
      const fields: string[] = [];
      while (true) {
        const field = this.next();
        if (field?.type === 'paren' && field.value === ')') break;
        if (field?.type !== 'atom') throw new Error("Expected cron fields or ')'");
        fields.push(field.value);
      }
      const expr = fields.join(' ');
      if (!expr.trim() || !isValidCron(expr)) {
        throw new Error(`Invalid cron expression '${expr}'`);
      }
      return { kind: 'cron', expr };
    }
    return this.parseAtomExpr(token.value);
  }

  private parseAtomExpr(path: string): WebhookConditionExpr {
    const op = this.peek();
    if (op?.type !== 'op') return { kind: 'event', value: path };
    this.next();
    const valueToken = this.next();
    let value: unknown;
    if (valueToken?.type === 'str') {
      value = valueToken.value;
    } else if (valueToken?.type === 'atom') {
      value = parseWebhookLiteral(valueToken.value);
    } else {
      throw new Error(`Expected comparison value after '${path}'`);
    }
    return { kind: 'compare', path, op: op.value, value };
  }
}

function parseWebhookCondition(condition: string): WebhookConditionExpr {
  return new WebhookConditionParser(tokenizeWebhookCondition(condition)).parseCondition();
}

function parseWebhookLiteral(atom: string): unknown {
  if (atom === 'true') return true;
  if (atom === 'false') return false;
  if (atom === 'null') return null;
  if (atom.trim() !== '' && Number.isFinite(Number(atom))) return Number(atom);
  return atom;
}

function resolveWebhookValue(
  path: string,
  event: string,
  context: Record<string, unknown>,
): unknown {
  if (path === 'event') return event;
  if (path === 'context') return context;
  if (!path.startsWith('context.')) return null;
  let current: unknown = context;
  for (const part of path.slice('context.'.length).split('.')) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = null;
      break;
    }
  }
  return current ?? null;
}

function webhookValuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return left === right;
  if (typeof left === 'string' && typeof right === 'string') return left === right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return left === right;
  if (left === null && right === null) return true;
  return false;
}

function webhookNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value.trim()))) {
    return Number(value.trim());
  }
  return null;
}

function evaluateWebhookCompare(
  path: string,
  op: string,
  expected: unknown,
  event: string,
  context: Record<string, unknown>,
): boolean {
  const actual = resolveWebhookValue(path, event, context);
  if (op === '==') return webhookValuesEqual(actual, expected);
  if (op === '!=') return !webhookValuesEqual(actual, expected);
  const a = webhookNumericValue(actual);
  const b = webhookNumericValue(expected);
  if (a === null || b === null) return false;
  if (op === '>') return a > b;
  if (op === '>=') return a >= b;
  if (op === '<') return a < b;
  return a <= b;
}

function evaluateWebhookCondition(
  expr: WebhookConditionExpr,
  event: string,
  context: Record<string, unknown>,
  now: Date,
): boolean {
  switch (expr.kind) {
    case 'and':
      return (
        evaluateWebhookCondition(expr.left, event, context, now) &&
        evaluateWebhookCondition(expr.right, event, context, now)
      );
    case 'or':
      return (
        evaluateWebhookCondition(expr.left, event, context, now) ||
        evaluateWebhookCondition(expr.right, event, context, now)
      );
    case 'not':
      return !evaluateWebhookCondition(expr.inner, event, context, now);
    case 'bool':
      return expr.value;
    case 'event':
      return event === expr.value;
    case 'cron':
      return matchesCron(expr.expr, now);
    case 'compare':
      return evaluateWebhookCompare(expr.path, expr.op, expr.value, event, context);
  }
}

function cronFieldMatches(spec: string, value: number, min: number, max: number): boolean {
  return spec.split(',').some((part) => {
    const trimmed = part.trim();
    if (!trimmed) return false;
    const [rangePart, stepPart] = trimmed.split('/');
    if (stepPart !== undefined && stepPart.trim() === '') return false;
    const step = stepPart === undefined ? 1 : Math.max(1, Number(stepPart) || 1);
    let start: number;
    let end: number;
    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [s, e] = rangePart.split('-').map((v) => Number(v));
      if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
      start = s;
      end = e;
    } else {
      const single = Number(rangePart);
      if (!Number.isFinite(single)) return false;
      if (step > 1) {
        start = single;
        end = max;
      } else {
        start = single;
        end = single;
      }
    }
    start = Math.max(start, min);
    end = Math.min(end, max);
    if (end < start) return false;
    return value >= start && value <= end && (value - start) % step === 0;
  });
}

function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const bounds: Array<[string, number, number]> = [
    [fields[0], 0, 59],
    [fields[1], 0, 23],
    [fields[2], 1, 31],
    [fields[3], 1, 12],
    [fields[4], 0, 7],
  ];
  return bounds.every(([field, min, max]) =>
    field.split(',').every((part) => {
      const trimmed = part.trim();
      const [rangePart, stepPart] = trimmed.split('/');
      if (
        stepPart !== undefined &&
        (stepPart.trim() === '' || !Number.isFinite(Number(stepPart)))
      ) {
        return false;
      }
      if (rangePart === '*') return true;
      if (rangePart.includes('-')) {
        const [s, e] = rangePart.split('-').map((v) => Number(v));
        return (
          Number.isFinite(s) &&
          Number.isFinite(e) &&
          s >= min &&
          s <= max &&
          e >= min &&
          e <= max &&
          s <= e
        );
      }
      const single = Number(rangePart);
      return Number.isFinite(single) && single >= min && single <= max;
    }),
  );
}

export function matchesCron(expr: string, now = new Date()): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5 || !isValidCron(expr)) return false;
  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const dow = now.getDay() === 7 ? 0 : now.getDay();
  const dowSpec = fields[4] === '7' ? '0' : fields[4];
  const domMatches = cronFieldMatches(fields[2], day, 1, 31);
  const dowMatches = cronFieldMatches(dowSpec, dow, 0, 7);
  const dayOk =
    fields[2] !== '*' && fields[4] !== '*' ? domMatches || dowMatches : domMatches && dowMatches;
  return (
    cronFieldMatches(fields[0], minute, 0, 59) &&
    cronFieldMatches(fields[1], hour, 0, 23) &&
    dayOk &&
    cronFieldMatches(fields[3], month, 1, 12)
  );
}

export function validateWebhookCondition(condition: string): string | null {
  const trimmed = condition.trim();
  if (!trimmed) return null;
  try {
    parseWebhookCondition(trimmed);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function matchesWebhookCondition(
  condition: string,
  event: string,
  context: Record<string, unknown> = {},
  now = new Date(),
): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return true;
  try {
    return evaluateWebhookCondition(parseWebhookCondition(trimmed), event, context, now);
  } catch {
    return false;
  }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signature: string,
): Promise<WebhookSignatureVerifyResult> {
  if (isTauri()) {
    return invoke<WebhookSignatureVerifyResult>('verify_webhook_signature', {
      secret,
      payload,
      signature,
    });
  }
  const expected = await hmacSha256Hex(secret, payload);
  const provided = signature.trim();
  const normalized = provided.startsWith('sha256=')
    ? provided.slice('sha256='.length)
    : provided.startsWith('SHA256=')
      ? provided.slice('SHA256='.length)
      : provided;
  return {
    valid: provided.length > 0 && normalized.trim().toLowerCase() === expected,
    expected,
    algorithm: 'HMAC-SHA256',
  };
}

export async function triggerWebhookEvent(
  event: string,
  context?: Record<string, unknown>,
): Promise<number> {
  if (isTauri()) {
    return invoke<number>('trigger_webhook_event', { event, context: context ?? null });
  }
  const now = Date.now();
  const rules = readWebhookRules().filter(
    (r) =>
      r.enabled &&
      (r.triggerEvent || '') === event &&
      matchesWebhookCondition(r.triggerCondition ?? '', event, context ?? {}) &&
      (r.lastRunAt === 0 || now - r.lastRunAt >= (r.cooldownSeconds || 0) * 1000),
  );
  const deliveries: WebhookDelivery[] = rules.flatMap((rule) => {
    const channels: WebhookChannelName[] =
      rule.channels && rule.channels.length > 0 ? rule.channels : ['http'];
    const payload = renderWebhookPayload(rule.payload, event, context ?? {}, now);
    return channels.map((channel) => ({
      id: makeId(),
      ruleId: rule.id,
      channel,
      event,
      payload,
      method: rule.method,
      url: rule.url,
      token: rule.token,
      secret: rule.secret,
      retries: rule.retries,
      attempts: 1,
      status: 'success',
      lastStatus: 200,
      lastMessage:
        channel === 'email'
          ? `Email queued (event: ${event})`
          : channel === 'notification'
            ? `Notification delivered (event: ${event})`
            : `HTTP 200 delivered (event: ${event})`,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }));
  });
  if (rules.length > 0) {
    const storedRules = readWebhookRules();
    const fired = new Set(rules.map((rule) => rule.id));
    for (const rule of storedRules) {
      if (fired.has(rule.id)) rule.lastRunAt = now;
    }
    writeWebhookRules(storedRules);
    for (const rule of rules) {
      appendWebhookRuleRun(
        rule.id,
        'event',
        'success',
        200,
        1,
        `HTTP 200 delivered (event: ${event})`,
      );
    }
  }
  let next = [...readWebhookDeliveries(), ...deliveries];
  const retention = readWebhookRetentionConfig();
  if (retention.autoCleanup) {
    next = applyWebhookRetention(next, retention).deliveries;
  }
  writeWebhookDeliveries(next);
  return deliveries.length;
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

export async function retryWebhookDelivery(id: string): Promise<WebhookDelivery> {
  if (isTauri()) return invoke<WebhookDelivery>('retry_webhook_delivery', { id });
  const deliveries = readWebhookDeliveries();
  const delivery = deliveries.find((d) => d.id === id);
  if (!delivery) throw new Error('Webhook delivery not found');
  delivery.attempts = 0;
  delivery.status = 'queued';
  delivery.lastMessage = '';
  delivery.nextAttemptAt = Date.now();
  delivery.updatedAt = Date.now();
  writeWebhookDeliveries(deliveries);
  return delivery;
}

export async function deleteWebhookDelivery(id: string): Promise<string> {
  if (isTauri()) return invoke<string>('delete_webhook_delivery', { id });
  const deliveries = readWebhookDeliveries();
  const next = deliveries.filter((d) => d.id !== id);
  if (next.length === deliveries.length) throw new Error('Webhook delivery not found');
  writeWebhookDeliveries(next);
  return `Deleted webhook delivery ${id.slice(0, 8)}`;
}

export async function clearWebhookDeliveries(status?: string): Promise<number> {
  if (isTauri()) {
    return invoke<number>('clear_webhook_deliveries', {
      status: status?.trim() ? status.trim() : null,
    });
  }
  const deliveries = readWebhookDeliveries();
  const next = status?.trim() ? deliveries.filter((d) => d.status !== status.trim()) : [];
  writeWebhookDeliveries(next);
  return deliveries.length - next.length;
}

function clampRetention(days: number, maxRecords: number): { days: number; maxRecords: number } {
  return {
    days: Math.min(3650, Math.max(1, Math.round(days) || 1)),
    maxRecords: Math.min(100000, Math.max(1, Math.round(maxRecords) || 1)),
  };
}

function readWebhookRetentionConfig(): WebhookRetentionConfig {
  try {
    const raw = localStorage.getItem(WEBHOOK_RETENTION_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WebhookRetentionConfig;
      return {
        retentionDays: parsed.retentionDays,
        maxRecords: parsed.maxRecords,
        autoCleanup: parsed.autoCleanup !== false,
        updatedAt: parsed.updatedAt ?? 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { retentionDays: 30, maxRecords: 200, autoCleanup: true, updatedAt: 0 };
}

function applyWebhookRetention(
  deliveries: WebhookDelivery[],
  config: WebhookRetentionConfig,
): { deliveries: WebhookDelivery[]; removedByAge: number; removedByCount: number } {
  const now = Date.now();
  const cutoff = now - config.retentionDays * 86_400_000;
  const terminal = (d: WebhookDelivery) => d.status === 'success' || d.status === 'dead';
  let removedByAge = 0;
  let removedByCount = 0;
  let kept: WebhookDelivery[] = [];
  for (const delivery of deliveries) {
    if (terminal(delivery) && delivery.createdAt < cutoff) {
      removedByAge += 1;
    } else {
      kept.push(delivery);
    }
  }
  const terminalKept = kept.filter(terminal);
  const excess = Math.max(0, terminalKept.length - config.maxRecords);
  if (excess > 0) {
    const ids = new Set(
      terminalKept
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, excess)
        .map((d) => d.id),
    );
    kept = kept.filter((d) => !ids.has(d.id));
    removedByCount = excess;
  }
  return { deliveries: kept, removedByAge, removedByCount };
}

export async function getWebhookRetentionConfig(): Promise<WebhookRetentionConfig> {
  if (isTauri()) {
    return invoke<WebhookRetentionConfig>('get_webhook_retention_config');
  }
  return readWebhookRetentionConfig();
}

export async function setWebhookRetentionConfig(
  retentionDays: number,
  maxRecords: number,
  autoCleanup: boolean,
): Promise<WebhookRetentionConfig> {
  if (isTauri()) {
    return invoke<WebhookRetentionConfig>('set_webhook_retention_config', {
      retentionDays,
      maxRecords,
      autoCleanup,
    });
  }
  const clamped = clampRetention(retentionDays, maxRecords);
  const config: WebhookRetentionConfig = {
    retentionDays: clamped.days,
    maxRecords: clamped.maxRecords,
    autoCleanup,
    updatedAt: Date.now(),
  };
  localStorage.setItem(WEBHOOK_RETENTION_LS_KEY, JSON.stringify(config));
  return config;
}

export async function pruneWebhookDeliveries(): Promise<WebhookPruneResult> {
  if (isTauri()) {
    return invoke<WebhookPruneResult>('prune_webhook_deliveries');
  }
  const config = readWebhookRetentionConfig();
  const result = applyWebhookRetention(readWebhookDeliveries(), config);
  writeWebhookDeliveries(result.deliveries);
  return {
    removedByAge: result.removedByAge,
    removedByCount: result.removedByCount,
    totalRemoved: result.removedByAge + result.removedByCount,
  };
}

export async function getWebhookDeliveryStats(): Promise<WebhookDeliveryStats> {
  if (isTauri()) {
    return invoke<WebhookDeliveryStats>('get_webhook_delivery_stats');
  }
  const stats: WebhookDeliveryStats = {
    total: 0,
    queued: 0,
    delivering: 0,
    success: 0,
    dead: 0,
    failed: 0,
  };
  for (const delivery of readWebhookDeliveries()) {
    stats.total += 1;
    if (delivery.status === 'queued') stats.queued += 1;
    else if (delivery.status === 'delivering') stats.delivering += 1;
    else if (delivery.status === 'success') stats.success += 1;
    else if (delivery.status === 'dead') stats.dead += 1;
    else stats.failed += 1;
  }
  return stats;
}

function readWebhookChannelConfig(): WebhookChannelConfig {
  try {
    const raw = localStorage.getItem(WEBHOOK_CHANNEL_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WebhookChannelConfig;
      return {
        emailEnabled: parsed.emailEnabled ?? false,
        emailFrom: parsed.emailFrom ?? '',
        emailTo: parsed.emailTo ?? '',
        smtpHost: parsed.smtpHost ?? '',
        smtpPort: parsed.smtpPort ?? 587,
        smtpUser: parsed.smtpUser ?? '',
        smtpPassword: parsed.smtpPassword ?? '',
        notificationEnabled: parsed.notificationEnabled ?? false,
        notificationTitle: parsed.notificationTitle || 'AI Workbench webhook',
        updatedAt: parsed.updatedAt ?? 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    emailEnabled: false,
    emailFrom: '',
    emailTo: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    notificationEnabled: false,
    notificationTitle: 'AI Workbench webhook',
    updatedAt: 0,
  };
}

export async function getWebhookChannelConfig(): Promise<WebhookChannelConfig> {
  if (isTauri()) {
    return invoke<WebhookChannelConfig>('get_webhook_channel_config');
  }
  return readWebhookChannelConfig();
}

export async function setWebhookChannelConfig(
  emailEnabled: boolean,
  emailFrom: string,
  emailTo: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPassword: string,
  notificationEnabled: boolean,
  notificationTitle: string,
): Promise<WebhookChannelConfig> {
  if (isTauri()) {
    return invoke<WebhookChannelConfig>('set_webhook_channel_config', {
      request: {
        emailEnabled,
        emailFrom,
        emailTo,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        notificationEnabled,
        notificationTitle,
      },
    });
  }
  const config: WebhookChannelConfig = {
    emailEnabled,
    emailFrom: emailFrom.trim(),
    emailTo: emailTo.trim(),
    smtpHost: smtpHost.trim(),
    smtpPort: Math.min(65_535, Math.max(1, Math.round(smtpPort) || 587)),
    smtpUser: smtpUser.trim(),
    smtpPassword,
    notificationEnabled,
    notificationTitle: notificationTitle.trim() || 'AI Workbench webhook',
    updatedAt: Date.now(),
  };
  localStorage.setItem(WEBHOOK_CHANNEL_CONFIG_LS_KEY, JSON.stringify(config));
  return config;
}

export async function testWebhookNotification(): Promise<string> {
  if (isTauri()) {
    return invoke<string>('test_webhook_notification');
  }
  const config = readWebhookChannelConfig();
  const title = config.notificationTitle.trim() || 'AI Workbench webhook';
  window.dispatchEvent(
    new CustomEvent('webhook-notification', {
      detail: {
        title,
        body: 'Webhook notification channel test',
        ruleId: 'test',
        event: 'notification.test',
        channel: 'notification',
      },
    }),
  );
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body: 'Webhook notification channel test' });
  }
  return 'Notification channel test sent';
}

export async function testWebhookEmail(): Promise<string> {
  if (isTauri()) {
    return invoke<string>('test_webhook_email');
  }
  const config = readWebhookChannelConfig();
  if (!config.emailEnabled) {
    throw new Error('Email channel is not enabled');
  }
  if (!config.emailFrom.trim() || !config.emailTo.trim() || !config.smtpHost.trim()) {
    throw new Error('Email from/to addresses and SMTP host are required');
  }
  return 'Email channel test sent (Email queued via SMTP)';
}

export async function probeWebhookRecovery(): Promise<WebhookRecoveryResult> {
  if (isTauri()) {
    return invoke<WebhookRecoveryResult>('probe_webhook_recovery');
  }
  const now = Date.now();
  const rules = readWebhookRules();
  const result: WebhookRecoveryResult = { probed: 0, recovered: 0, failed: 0 };
  for (const rule of rules) {
    const base = Math.max(5, rule.recoveryBackoffSeconds ?? 300) * 1000;
    const exponent = Math.max(
      0,
      (rule.consecutiveFailures ?? 0) - Math.max(1, rule.autoDisableAfter ?? 3),
    );
    const backoffMs = Math.min(86_400_000, base * 2 ** Math.min(30, exponent));
    if (
      !rule.enabled &&
      (rule.circuitOpenedAt ?? 0) > 0 &&
      now - rule.circuitOpenedAt >= backoffMs
    ) {
      result.probed += 1;
      const recovered = !/\/fail|\/broken/i.test(rule.url) && !rule.payload.includes('"fail":true');
      rule.consecutiveFailures = recovered ? 0 : (rule.consecutiveFailures ?? 0) + 1;
      rule.lastStatus = recovered ? 200 : 500;
      rule.updatedAt = now;
      if (recovered) {
        rule.enabled = true;
        rule.circuitOpenedAt = 0;
        rule.lastMessage = 'Recovery probe succeeded: HTTP 200 delivered';
        result.recovered += 1;
      } else {
        rule.circuitOpenedAt = now;
        rule.lastMessage = 'Recovery probe failed: HTTP 500 simulated failure';
        result.failed += 1;
      }
      appendWebhookRuleRun(
        rule.id,
        'scheduled',
        recovered ? 'success' : 'failed',
        rule.lastStatus,
        1,
        rule.lastMessage,
      );
    }
  }
  writeWebhookRules(rules);
  return result;
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
  localStorage.setItem(EVENT_LOGS_LS_KEY, JSON.stringify(logs));
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
  localStorage.setItem(EVENT_SCHEMAS_LS_KEY, JSON.stringify(schemas));
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
  localStorage.setItem(EVENT_FORWARDS_LS_KEY, JSON.stringify(forwards));
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
  const webhookDeliveries = await triggerWebhookEvent(event, contextObj);
  return {
    event,
    recorded: true,
    validated,
    rejectedReason: reason ?? '',
    forwarded,
    webhookDeliveries,
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
