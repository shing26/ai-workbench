import { describe, expect, it } from 'vitest';
import { parseDoTasks, runSemanticAudit } from './l4SemanticAudit';

describe('l4SemanticAudit', () => {
  it('accepts a clean worktree without a DoD', () => {
    const result = runSemanticAudit(null, []);
    expect(result.status).toBe('NO_CHANGES');
    expect(result.errors).toEqual([]);
  });

  it('fails when a diff exists without a DoD', () => {
    const result = runSemanticAudit(null, [{ path: 'src/lib/app.ts', insertions: 10 }]);
    expect(result.status).toBe('FAIL');
    expect(result.errors[0]).toContain('DoD');
  });

  it('fails doc-only changes while DoD tasks remain pending', () => {
    const dod = [
      '---',
      'journeyStage: ready',
      '---',
      '',
      '## 交付任务清单',
      '- [ ] 实现认证',
      '- [x] 完成调研',
      '',
    ].join('\n');
    const result = runSemanticAudit(dod, [{ path: 'docs/journey/topic.md', insertions: 4 }]);
    expect(result.status).toBe('FAIL');
    expect(result.evidence).toMatchObject({
      checkedTasks: 1,
      pendingTasks: 1,
      docFiles: 1,
      codeFiles: 0,
      archived: false,
    });
  });

  it('fails non-code changes while DoD tasks remain pending', () => {
    const dod = '## 交付任务清单\n- [ ] 更新验证配置\n';
    const result = runSemanticAudit(dod, [{ path: 'verify.matrix.json', insertions: 8 }]);
    expect(result.status).toBe('FAIL');
    expect(result.errors[0]).toContain('DoD');
    expect(result.evidence).toMatchObject({
      otherFiles: 1,
      codeFiles: 0,
      pendingTasks: 1,
    });
  });

  it('passes code changes even when DoD tasks remain pending', () => {
    const dod = '## 交付任务清单\n- [ ] 实现认证\n';
    const result = runSemanticAudit(dod, [
      { path: 'src/lib/auth.ts', insertions: 12 },
      { path: 'docs/journey/topic.md', insertions: 2 },
    ]);
    expect(result.status).toBe('PASS');
    expect(result.errors).toEqual([]);
    expect(result.evidence.codeFiles).toBe(1);
    expect(result.evidence.docFiles).toBe(1);
  });

  it('allows pending tasks when the journey is archived', () => {
    const dod = '---\njourneyStage: archived\n---\n\n- [ ] 剩余记录\n';
    const result = runSemanticAudit(dod, [{ path: 'docs/archive.md', insertions: 5 }]);
    expect(result.status).toBe('PASS');
    expect(parseDoTasks(dod).archived).toBe(true);
  });
});
