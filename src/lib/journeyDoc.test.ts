import { describe, expect, it } from 'vitest';
import {
  JOURNEY_STAGES,
  allowedTargets,
  buildArchiveRecord,
  buildJourneyDoc,
  isAllowedTransition,
  journeyDocFileName,
} from './journeyDoc';

const SECTIONS = [
  '背景与目标',
  'PRD 要点',
  '设计决策',
  '风险与 Trade-off',
  '论证结论',
  '交付任务清单',
  '实现与验证记录',
];

describe('journeyDoc module', () => {
  it('builds a single artifact with frontmatter and seven sections', () => {
    const doc = buildJourneyDoc({
      projectId: 'p1',
      topic: 'AI 工作台',
      opinions: [
        {
          seat: { id: 'ui-designer', name: 'UI Designer', role: 'Design' },
          opinion: '保持旅程阶段可视化',
        },
        {
          seat: { id: 'rust-architect', name: 'Rust Architect', role: 'Engineering' },
          opinion: '文档路径由后端原子写入',
        },
      ],
      consensus: {
        viewpoints: ['CLI 引用同一文档'],
        summary: '共识：旅程文档单一产物',
      },
      updatedAt: '2026-08-13T00:00:00.000Z',
    });

    expect(doc).toContain('projectId: p1');
    expect(doc).toContain('journeyStage: ready');
    expect(doc).toContain('participants: [ui-designer, rust-architect]');
    expect(doc).toContain('updatedAt: 2026-08-13T00:00:00.000Z');
    for (const section of SECTIONS) {
      expect(doc).toContain(`## ${section}`);
    }
    expect(doc).toContain('### UI Designer（Design）');
    expect(doc).toContain('共识：旅程文档单一产物');
  });

  it('derives unique readable file names per project', () => {
    expect(journeyDocFileName({ id: 'p1', name: 'AI 工作台' })).toBe('docs/journey/p1-ai.md');
    expect(journeyDocFileName({ id: 'p2', name: 'AI 工作台' })).toBe('docs/journey/p2-ai.md');
    expect(journeyDocFileName({ id: 'p3', name: '' })).toBe('docs/journey/p3-project-p3.md');
  });

  it('enforces the agreed transition table', () => {
    expect(isAllowedTransition('idea', 'discussing')).toBe(true);
    expect(isAllowedTransition('idea', 'ready')).toBe(true);
    expect(isAllowedTransition('idea', 'archived')).toBe(true);
    expect(isAllowedTransition('discussing', 'ready')).toBe(true);
    expect(isAllowedTransition('ready', 'building')).toBe(true);
    expect(isAllowedTransition('building', 'archived')).toBe(true);
    expect(isAllowedTransition('archived', 'ready')).toBe(true);
    expect(isAllowedTransition('idea', 'building')).toBe(false);
    expect(isAllowedTransition('archived', 'idea')).toBe(false);
    expect(allowedTargets('idea')).toEqual(
      expect.arrayContaining(['idea', 'discussing', 'ready', 'archived']),
    );
    expect(allowedTargets('idea')).not.toContain('building');
    expect(JOURNEY_STAGES).toHaveLength(5);
  });

  it('builds an archive record that keeps project context', () => {
    const record = buildArchiveRecord({
      projectName: 'Demo',
      fromStage: 'ready',
      journeyDocPath: 'docs/journey/p1-demo.md',
      doneCount: 3,
      pendingCount: 1,
      runsCount: 5,
      successRunsCount: 4,
      archivedAt: '2026-08-13T00:00:00.000Z',
    });
    expect(record).toContain('## 归档记录');
    expect(record).toContain('- 项目: Demo');
    expect(record).toContain('- 归档阶段: ready → archived');
    expect(record).toContain('- 已完成 DoD: 3 项');
    expect(record).toContain('CLI 运行记录: 5 次（成功 4 次）');
  });
});
