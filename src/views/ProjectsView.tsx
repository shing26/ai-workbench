import { Archive, FolderKanban, Pin, Plus, Terminal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { usePrismModals } from '../components/modals/prismModalsStore';
import * as db from '../lib/db';
import {
  JOURNEY_STAGE_LABELS,
  allowedTargets,
  buildArchiveIndex,
  buildArchiveJourneyDoc,
  buildArchiveRecord,
  journeyDocFileName,
} from '../lib/journeyDoc';
import { toast } from '../lib/toast';
import { useWorkbenchStore } from '../stores/workbenchStore';

const STAGE_PCT: Record<db.ProjectJourneyStage, number> = {
  idea: 5,
  discussing: 35,
  ready: 70,
  building: 85,
  archived: 100,
};

export default function ProjectsView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const tasks = useWorkbenchStore((s) => s.tasks);
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const addProject = useWorkbenchStore((s) => s.addProject);
  const updateProjectJourney = useWorkbenchStore((s) => s.updateProjectJourney);
  const setProjects = useWorkbenchStore((s) => s.setProjects);
  const setVibeContext = useWorkbenchStore((s) => s.setVibeContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const deleteProject = useWorkbenchStore((s) => s.deleteProject);
  const openCli = usePrismModals((s) => s.openCli);
  const openAttach = usePrismModals((s) => s.openAttach);

  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    await addProject(name.trim(), path.trim());
    setName('');
    setPath('');
  };

  const documentedFor = (project: db.Project) =>
    (project.material?.trim().length ?? 0) > 0 ||
    thoughts.some((t) => t.tags.includes(project.id) || (t.content || '').includes(project.name));

  const pendingTasksFor = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.status !== 'done');

  const doneTasksFor = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.status === 'done');

  const progressFor = (project: db.Project) => {
    const done = doneTasksFor(project.id).length;
    const pending = pendingTasksFor(project.id).length;
    if (done + pending > 0) return Math.round((done / (done + pending)) * 100);
    return STAGE_PCT[project.journeyStage];
  };

  const mountProject = async (project: db.Project) => {
    if (!project.path?.trim()) {
      toast.error('该项目未绑定本地路径，无法挂载');
      return;
    }
    try {
      const ctx = await db.getProjectGitContext(project.path);
      setVibeContext({
        projectId: project.id,
        projectName: project.name,
        journeyDocPath: project.journeyDocPath,
        path: project.path,
        branch: ctx.branch,
        head: ctx.head,
        commitCount: ctx.commitCount,
        latestCommit: ctx.latestCommit,
        changes: ctx.changes,
        mountedAt: Date.now(),
      });
      setActiveView('ai-studio');
      toast.success(`已挂载「${project.name}」，Studio 将自动检索关联旅程`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const archiveProject = async (project: db.Project) => {
    const doneTasks = doneTasksFor(project.id);
    const pending = pendingTasksFor(project.id);
    const runs = await db.listDeliveryRuns();
    const successRuns = runs.filter((r) => r.exitCode === 0).length;
    const record = buildArchiveRecord({
      projectName: project.name,
      fromStage: project.journeyStage,
      journeyDocPath: project.journeyDocPath,
      doneCount: doneTasks.length,
      pendingCount: pending.length,
      runsCount: runs.length,
      successRunsCount: successRuns,
    });
    const fileName = project.journeyDocPath || journeyDocFileName(project);
    const archiveDoc = buildArchiveJourneyDoc({
      projectId: project.id,
      projectName: project.name,
      fromStage: project.journeyStage,
      doneCount: doneTasks.length,
      pendingCount: pending.length,
      runsCount: runs.length,
      successRunsCount: successRuns,
    });
    await db.writeJourneyDoc(
      project.path ?? '',
      fileName,
      project.journeyDocPath ? record : archiveDoc,
      project.id,
      'archived',
      project.journeyDocPath ? 'append' : 'replace',
    );
    await setProjects(await db.listProjects());
    await addThought(
      buildArchiveIndex({
        projectName: project.name,
        fileName,
        fromStage: project.journeyStage,
        doneCount: doneTasks.length,
        pendingCount: pending.length,
        runsCount: runs.length,
        successRunsCount: successRuns,
      }),
      `#prism,#journey,#archived,#project-${project.id}`,
      'doc',
    );
    toast.success(`已归档「${project.name}」到 Knowledge`);
  };

  const reopenProject = async (project: db.Project) => {
    await updateProjectJourney(project.id, 'ready', project.journeyDocPath);
    toast.success(`已重新打开「${project.name}」`);
  };

  const changes = vibeContext?.changes ?? [];
  const stagedCount = changes.filter((c) => /^[MADR]/.test(c.trim())).length;
  const untrackedCount = changes.filter((c) => c.trim().startsWith('?')).length;
  const unstagedCount = Math.max(0, changes.length - stagedCount - untrackedCount);

  return (
    <div className="mission-view space-y-4 p-4 sm:p-5 lg:space-y-5">
      <div className="pc-section-head">
        <span className="pc-section-code">SYS.02 / IDEAS &amp; SCOPES</span>
        <span className="pc-section-title">项目矩阵</span>
        <span className="pc-section-meta">
          SCOPE-LOCKED · {projects.filter((p) => p.journeyStage !== 'archived').length} 个活动旅程
        </span>
      </div>

      <div className="pc-project-grid">
        {projects.map((project) => {
          const isDocumented = documentedFor(project);
          const pending = pendingTasksFor(project.id);
          const progress = progressFor(project);
          return (
            <article
              key={project.id}
              data-project-card={project.id}
              className="pc-panel pc-project-card"
            >
              <div className="pc-project-top">
                <div className="min-w-0">
                  <div className="pc-project-name" data-project-name={project.name}>
                    {project.name}
                  </div>
                  <div className="pc-project-path">{project.path || '未绑定路径'}</div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <select
                    value={project.journeyStage}
                    onChange={(e) =>
                      void updateProjectJourney(
                        project.id,
                        e.target.value as db.ProjectJourneyStage,
                      )
                    }
                    data-project-stage={project.journeyStage}
                    className="h-7 rounded border border-white/10 bg-white/[0.04] px-1.5 text-[10px] text-slate-300 outline-none"
                  >
                    {allowedTargets(project.journeyStage).map((stage) => (
                      <option key={stage} value={stage}>
                        {JOURNEY_STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-project-delete={project.id}
                    onClick={() => setDeleteId(deleteId === project.id ? null : project.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                    aria-label="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="pc-bar-row">
                <span>进度</span>
                <span className="pc-bar-track">
                  <i style={{ width: `${progress}%` }} />
                </span>
                <span>{progress}%</span>
              </div>

              <div
                className={isDocumented ? 'pc-coverage' : 'pc-coverage'}
                style={{ color: isDocumented ? 'var(--color-success)' : undefined }}
                data-project-coverage={isDocumented ? 'ok' : 'low'}
              >
                {isDocumented ? '已文档化' : '⚠️ 建议补充文档 ➔'} · 知识覆盖
              </div>

              <div className="pc-card-actions">
                <button
                  type="button"
                  data-project-cli={project.id}
                  onClick={() =>
                    openCli({
                      projectName: project.name,
                      specPath: project.journeyDocPath || undefined,
                      tasks: pending.slice(0, 3).map((t) => t.title),
                    })
                  }
                  className="pc-mini-btn"
                >
                  <Terminal size={12} />
                  CLI
                </button>
                <button
                  type="button"
                  data-project-attach={project.id}
                  onClick={() => openAttach({ taskTitle: project.name })}
                  className="pc-mini-btn"
                >
                  <FolderKanban size={12} />
                  关联
                </button>
                <button
                  type="button"
                  data-project-mount={project.id}
                  onClick={() => void mountProject(project)}
                  className="pc-mini-btn"
                >
                  <Pin size={12} />
                  挂载
                </button>
                {project.journeyStage === 'archived' ? (
                  <button
                    type="button"
                    data-project-reopen={project.id}
                    onClick={() => void reopenProject(project)}
                    className="pc-mini-btn"
                  >
                    <Archive size={12} />
                    重新打开
                  </button>
                ) : (
                  <button
                    type="button"
                    data-project-archive={project.id}
                    onClick={() => void archiveProject(project)}
                    className="pc-mini-btn danger"
                  >
                    <Archive size={12} />
                    归档
                  </button>
                )}
              </div>

              {deleteId === project.id && (
                <div className="flex items-center justify-between rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-300">
                  <span>确认删除项目？此操作不可撤销。</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-project-delete-cancel={project.id}
                      onClick={() => setDeleteId(null)}
                      className="rounded border border-white/10 px-2 py-1 hover:bg-white/10"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-project-delete-confirm={project.id}
                      onClick={() => void deleteProject(project.id, true)}
                      className="rounded bg-rose-500/20 px-2 py-1 font-semibold hover:bg-rose-500/30"
                    >
                      删除
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="py-16 text-center text-xs text-slate-600">
          还没有项目，先新建一个开始 PRISM 管线。
        </div>
      )}

      <div className="pc-bottom-grid">
        <div className="pc-panel">
          <div className="pc-panel-title">
            <span className="tick" />
            Git 变更挂载<span className="right">LOCAL ONLY</span>
          </div>
          <div className="pc-git-row">
            <div className="pc-git-cell green">
              <b>{stagedCount}</b>staged
            </div>
            <div className="pc-git-cell amber">
              <b>{unstagedCount}</b>unstaged
            </div>
            <div className="pc-git-cell">
              <b>{untrackedCount}</b>untracked
            </div>
          </div>
          <div className="pc-commit-box">
            <b>feat(ui):</b> complete Sprint DoD — {vibeContext?.projectName ?? 'Prism Station'}
            <br />
            <span style={{ color: 'var(--color-text-muted)' }}>
              # generated from git diff + DoD · conventional commit
            </span>
          </div>
        </div>

        <div className="pc-panel">
          <div className="pc-panel-title">
            <span className="tick" />
            新建项目<span className="right">SCOPE LOCK</span>
          </div>
          <div className="pc-form-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
              }}
              placeholder="项目名称"
              data-project-name
              className="pc-text-input"
            />
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
              }}
              placeholder="D:\path\to\repo"
              data-project-path
              className="pc-text-input"
            />
            <button
              type="button"
              data-project-add
              onClick={() => void create()}
              className="pc-mini-btn primary"
            >
              <Plus size={13} />
              添加
            </button>
          </div>
          <p
            style={{
              marginTop: 10,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}
          >
            新增项目默认锁定为{' '}
            <span style={{ color: 'var(--prism-accent-strong)', fontFamily: 'var(--font-mono)' }}>
              IDEA
            </span>{' '}
            阶段，禁止跨目录读写。
          </p>
        </div>
      </div>
    </div>
  );
}
