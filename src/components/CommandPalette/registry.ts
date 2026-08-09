import {
  BookOpen,
  CheckSquare,
  FolderKanban,
  HeartPulse,
  Lightbulb,
  MessageSquare,
  Plus,
  Settings,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import { useMemo } from 'react';
import type { CommandUsageMap } from '../../lib/commandUsage';
import * as db from '../../lib/db';
import { toast } from '../../lib/toast';
import { emitEvent, TOPICS } from '../../stores/events';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';

export type CommandPrompt = {
  title: string;
  placeholder: string;
  onSubmit: (value: string) => void | Promise<void>;
};

export type CommandEntry = {
  id: string;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  view?: ViewId;
  action?: () => void | Promise<void>;
  prompt?: CommandPrompt;
  keywords?: string[];
  weight: number;
};

const VIEW_COMMANDS: {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  weight: number;
}[] = [
  {
    id: 'ai-studio',
    label: 'AI Studio',
    icon: MessageSquare,
    keywords: ['chat', '对话', 'studio'],
    weight: 90,
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    keywords: ['项目', 'project'],
    weight: 70,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    keywords: ['知识', '闪念', 'thought', 'knowledge'],
    weight: 70,
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: CheckSquare,
    keywords: ['动作', '任务', 'schedule', 'task'],
    weight: 70,
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    keywords: ['系统', 'provider', 'webhook', 'system'],
    weight: 60,
  },
];

const LIMIT_PER_ENTITY = 8;

function buildStaticCommands(deps: {
  setActiveView: (view: ViewId) => void;
  addTask: (title: string, isToday: boolean) => Promise<void>;
  addThought: (content: string, tags: string, type: db.ThoughtType) => Promise<void>;
}): CommandEntry[] {
  return [
    ...VIEW_COMMANDS.map((view) => ({
      id: `view:${view.id}`,
      label: view.label,
      subtitle: '跳转视图',
      icon: view.icon,
      view: view.id,
      keywords: view.keywords,
      weight: view.weight,
      action: () => deps.setActiveView(view.id),
    })),
    {
      id: 'action:capture-thought',
      label: '记闪念',
      subtitle: '快速捕捉一条闪念到收件箱',
      icon: Lightbulb,
      keywords: ['thought', 'capture', '闪念', '捕捉'],
      weight: 80,
      prompt: {
        title: '记闪念',
        placeholder: '输入闪念内容，Enter 保存到收件箱',
        onSubmit: async (value) => {
          await deps.addThought(value.trim(), '', 'inbox');
          toast.success('已保存到收件箱');
        },
      },
    },
    {
      id: 'action:new-task',
      label: '新建任务',
      subtitle: '创建一条今日任务',
      icon: Plus,
      keywords: ['task', 'add', '任务', '新建'],
      weight: 70,
      prompt: {
        title: '新建任务',
        placeholder: '输入任务标题，Enter 创建',
        onSubmit: async (value) => {
          await deps.addTask(value.trim(), true);
          toast.success('任务已创建');
        },
      },
    },
    {
      id: 'action:health-check',
      label: '健康检查',
      subtitle: '运行 Provider 心跳检查',
      icon: HeartPulse,
      keywords: ['health', 'check', '心跳', '健康', 'provider'],
      weight: 60,
      action: async () => {
        const snapshot = await db.runProviderHeartbeat();
        const failed = snapshot.alerts.length;
        if (failed > 0) toast.warning(`健康检查完成 · ${failed} 个 Provider 异常`);
        else toast.success(`健康检查通过 · ${snapshot.providers.length} 个 Provider 正常`);
      },
    },
  ];
}

function buildEntityCommands(deps: {
  sessions: db.Session[];
  thoughts: db.Thought[];
  tasks: db.Task[];
  projects: db.Project[];
  providers: db.Provider[];
  setActiveView: (view: ViewId) => void;
}): CommandEntry[] {
  return [
    ...deps.sessions.slice(0, LIMIT_PER_ENTITY).map((session) => ({
      id: `session:${session.id}`,
      label: session.title || 'Untitled session',
      subtitle: `会话 · ${session.model}`,
      icon: MessageSquare,
      view: 'ai-studio' as const,
      keywords: ['session', '会话', 'chat', session.model],
      weight: 45,
      action: () => {
        deps.setActiveView('ai-studio');
        emitEvent(TOPICS.COMMAND_OPEN_SESSION, { sessionId: session.id });
      },
    })),
    ...deps.thoughts.slice(0, LIMIT_PER_ENTITY).map((thought) => ({
      id: `thought:${thought.id}`,
      label: db.thoughtTitle(thought),
      subtitle: `闪念 · ${thought.type}`,
      icon: StickyNote,
      view: 'knowledge' as const,
      keywords: ['thought', '闪念', thought.tags],
      weight: 40,
      action: () => {
        deps.setActiveView('knowledge');
        emitEvent(TOPICS.COMMAND_OPEN_THOUGHT, { thoughtId: thought.id });
      },
    })),
    ...deps.tasks.slice(0, LIMIT_PER_ENTITY).map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      subtitle: task.status === 'done' ? '任务 · 已完成' : '任务 · 待办',
      icon: CheckSquare,
      view: 'actions' as const,
      keywords: ['task', '任务'],
      weight: 35,
      action: () => deps.setActiveView('actions'),
    })),
    ...deps.projects.slice(0, LIMIT_PER_ENTITY).map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      subtitle: '项目',
      icon: FolderKanban,
      view: 'projects' as const,
      keywords: ['project', '项目'],
      weight: 35,
      action: () => {
        deps.setActiveView('projects');
        emitEvent(TOPICS.COMMAND_OPEN_PROJECT, { projectId: project.id });
      },
    })),
    ...deps.providers.slice(0, LIMIT_PER_ENTITY).map((provider) => ({
      id: `provider:${provider.id}`,
      label: provider.name,
      subtitle: provider.isActive ? 'Provider · 活跃' : 'Provider · 停用',
      icon: HeartPulse,
      view: 'system' as const,
      keywords: ['provider', '模型', provider.model, provider.baseUrl],
      weight: 30,
      action: () => deps.setActiveView('system'),
    })),
  ];
}

export function useCommandRegistry(): CommandEntry[] {
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const addTask = useWorkbenchStore((s) => s.addTask);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const sessions = useWorkbenchStore((s) => s.sessions);
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const tasks = useWorkbenchStore((s) => s.tasks);
  const projects = useWorkbenchStore((s) => s.projects);
  const providers = useWorkbenchStore((s) => s.providers);

  return useMemo(
    () => [
      ...buildStaticCommands({ setActiveView, addTask, addThought }),
      ...buildEntityCommands({ sessions, thoughts, tasks, projects, providers, setActiveView }),
    ],
    [setActiveView, addTask, addThought, sessions, thoughts, tasks, projects, providers],
  );
}

function fuzzyScore(query: string, text: string): number {
  let queryIndex = 0;
  let score = 0;
  let run = 0;
  for (let i = 0; i < text.length && queryIndex < query.length; i += 1) {
    if (text[i] === query[queryIndex]) {
      queryIndex += 1;
      run += 1;
      score += 8 + run * 2;
      if (i === 0) score += 4;
    } else {
      run = 0;
    }
  }
  return queryIndex === query.length ? score : -1;
}

function scoreCommand(query: string, entry: CommandEntry): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const haystack =
    `${entry.label} ${entry.subtitle ?? ''} ${(entry.keywords ?? []).join(' ')}`.toLowerCase();
  const direct = haystack.indexOf(q);
  if (direct >= 0) return 120 - direct;
  const fuzzy = fuzzyScore(q, haystack);
  if (fuzzy >= 0) return fuzzy;
  const pinyinText = pinyin(haystack, { toneType: 'none', type: 'array' }).join('').toLowerCase();
  const pinyinScore = fuzzyScore(q, pinyinText);
  if (pinyinScore >= 0) return 60;
  return -1;
}

function rankCommand(entry: CommandEntry, usage: CommandUsageMap): number {
  const entryUsage = usage[entry.id];
  const boost = entryUsage ? Math.min(entryUsage.count, 10) : 0;
  return entry.weight + boost;
}

export function sortCommands(
  commands: CommandEntry[],
  query: string,
  usage: CommandUsageMap,
): CommandEntry[] {
  return commands
    .map((entry) => ({ entry, score: scoreCommand(query, entry) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (query.trim()) {
        const scoreDiff = b.score - a.score;
        if (scoreDiff) return scoreDiff;
      }
      return rankCommand(b.entry, usage) - rankCommand(a.entry, usage);
    })
    .map((item) => item.entry);
}
