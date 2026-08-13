import journeyStages from '../../journey-stages.json';
import type { ProjectJourneyStage } from './db';

type JourneyStageModel = {
  version: number;
  stages: ProjectJourneyStage[];
  labels: Record<ProjectJourneyStage, string>;
  transitions: Record<ProjectJourneyStage, ProjectJourneyStage[]>;
};

const model = journeyStages as JourneyStageModel;

export const JOURNEY_STAGES = model.stages;
export const JOURNEY_STAGE_LABELS = model.labels;

export function isAllowedTransition(from: ProjectJourneyStage, to: ProjectJourneyStage): boolean {
  if (from === to) return true;
  return (model.transitions[from] ?? []).includes(to);
}

export function allowedTargets(stage: ProjectJourneyStage): ProjectJourneyStage[] {
  return model.stages.filter((candidate) => isAllowedTransition(stage, candidate));
}

export type JourneyOpinion = {
  seat: { id: string; name: string; role: string };
  opinion: string;
};

export type JourneyConsensus = {
  viewpoints?: string[];
  summary?: string;
};

export type JourneyDocInput = {
  projectId: string;
  topic: string;
  opinions: JourneyOpinion[];
  consensus?: JourneyConsensus;
  updatedAt?: string;
};

export function journeyDocFileName(project: { id: string; name: string }): string {
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `project-${project.id.slice(0, 8)}`;
  return `docs/journey/${project.id}-${slug}.md`;
}

export function buildJourneyDoc(input: JourneyDocInput): string {
  const { projectId, topic, opinions, consensus, updatedAt = new Date().toISOString() } = input;
  const participants = opinions.map((opinion) => opinion.seat.id).join(', ');
  const opinionsMarkdown = opinions
    .map(
      (opinion) =>
        `### ${opinion.seat.name}（${opinion.seat.role}）\n${opinion.opinion.trim().slice(0, 500)}`,
    )
    .join('\n\n');
  const riskLines = consensus?.viewpoints?.length
    ? consensus.viewpoints.map((viewpoint) => `- ${viewpoint}`).join('\n')
    : '- 待补充';
  const summary = consensus?.summary ?? '- 待 CPO 确认';
  return [
    '---',
    `projectId: ${projectId}`,
    'journeyStage: ready',
    `participants: [${participants}]`,
    `updatedAt: ${updatedAt}`,
    'tags: [prism, journey, consensus]',
    '---',
    '',
    `# ${topic}`,
    '',
    '## 背景与目标',
    `围绕「${topic}」发起 Agency 圆桌论证，由 ${opinions.length} 位 Agency Agent 独立发言并汇总共识。`,
    '',
    '## PRD 要点',
    '待 CPO 根据共识结论补充正式 PRD；本旅程文档作为需求源头。',
    '',
    '## 设计决策',
    opinionsMarkdown,
    '',
    '## 风险与 Trade-off',
    riskLines,
    '',
    '## 论证结论',
    summary,
    '',
    '## 交付任务清单',
    '- [ ] 由 Actions 派发本地 CLI 实现',
    '',
    '## 实现与验证记录',
    '- 待 CLI 完成后回填验证记录',
    '',
  ].join('\n');
}

export type ArchiveRecordInput = {
  projectName: string;
  fromStage: ProjectJourneyStage;
  journeyDocPath: string | null;
  doneCount: number;
  pendingCount: number;
  runsCount: number;
  successRunsCount: number;
  archivedAt?: string;
};

export function buildArchiveRecord(input: ArchiveRecordInput): string {
  const archivedAt = input.archivedAt ?? new Date().toISOString();
  return [
    '## 归档记录',
    '',
    `- 项目: ${input.projectName}`,
    `- 归档时间: ${archivedAt}`,
    `- 归档阶段: ${input.fromStage} → archived`,
    `- 旅程文档: ${input.journeyDocPath || '未生成'}`,
    '',
    '### 交付总结',
    `- 已完成 DoD: ${input.doneCount} 项`,
    `- 待完成: ${input.pendingCount} 项`,
    `- CLI 运行记录: ${input.runsCount} 次（成功 ${input.successRunsCount} 次）`,
    '',
  ].join('\n');
}

export function buildJourneyDocIndex(input: {
  projectId: string;
  topic: string;
  fileName: string;
  opinions: JourneyOpinion[];
  consensus?: JourneyConsensus;
}): string {
  const summary = input.consensus?.summary ?? '- 待 CPO 确认';
  return [
    `# ${input.topic}`,
    '',
    `- 旅程文档: ${input.fileName}`,
    '- 阶段: ready',
    `- 参与 Agent: ${input.opinions.length}`,
    `- 论证结论: ${summary}`,
    '',
  ].join('\n');
}

export function buildArchiveIndex(input: {
  projectName: string;
  fileName: string;
  fromStage: ProjectJourneyStage;
  doneCount: number;
  pendingCount: number;
  runsCount: number;
  successRunsCount: number;
}): string {
  return [
    `# ${input.projectName}（已归档）`,
    '',
    `- 旅程文档: ${input.fileName}`,
    `- 归档阶段: ${input.fromStage} → archived`,
    `- 已完成 DoD: ${input.doneCount} 项`,
    `- 待完成: ${input.pendingCount} 项`,
    `- CLI 运行记录: ${input.runsCount} 次（成功 ${input.successRunsCount} 次）`,
    '',
  ].join('\n');
}

export function buildArchiveJourneyDoc(input: {
  projectId: string;
  projectName: string;
  fromStage: ProjectJourneyStage;
  doneCount: number;
  pendingCount: number;
  runsCount: number;
  successRunsCount: number;
  archivedAt?: string;
}): string {
  const archivedAt = input.archivedAt ?? new Date().toISOString();
  return [
    '---',
    `projectId: ${input.projectId}`,
    'journeyStage: archived',
    `updatedAt: ${archivedAt}`,
    'tags: [prism, journey, archived]',
    '---',
    '',
    `# ${input.projectName}（旅程归档）`,
    '',
    '## 背景与目标',
    `项目「${input.projectName}」完成旅程闭环后手动归档，旅程文档作为项目决策与交付的单一记录。`,
    '',
    '## PRD 要点',
    '见上方旅程记录；归档时未新增需求。',
    '',
    '## 设计决策',
    '归档决策由 CPO 手动确认，保留交付摘要与 CLI 运行记录。',
    '',
    '## 风险与 Trade-off',
    '- 待补充',
    '',
    '## 论证结论',
    `已完成 DoD ${input.doneCount} 项，待完成 ${input.pendingCount} 项。`,
    '',
    '## 交付任务清单',
    `- [x] 已完成 DoD: ${input.doneCount} 项`,
    `- [ ] 待完成: ${input.pendingCount} 项`,
    '',
    '## 实现与验证记录',
    `- CLI 运行: ${input.runsCount} 次（成功 ${input.successRunsCount} 次）`,
    '',
  ].join('\n');
}
