import { describe, expect, it } from 'vitest';
import manifest from '../../verify.matrix.json';

type ManifestCheck = {
  name: string;
  program: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  requires?: string;
};

type ManifestLevel = {
  level: number;
  name: string;
  checks: ManifestCheck[];
  aiAudit?: { mode: string };
};

type Manifest = {
  version: number;
  failFast: string;
  levels: ManifestLevel[];
  securityRules: {
    ignorePaths: string[];
    secrets: { id: string; prefix?: string; contains?: string; minLength?: number }[];
    debugCalls: { ts: string[]; rs: string[] };
  };
};

describe('verify.matrix.json contract', () => {
  const matrix = manifest as Manifest;

  it('declares four levels with non-empty checks', () => {
    expect(matrix.version).toBe(1);
    expect(matrix.failFast).toBe('level');
    expect(matrix.levels).toHaveLength(4);
    matrix.levels.forEach((level, index) => {
      expect(level.level).toBe(index + 1);
      expect(level.name.length).toBeGreaterThan(0);
      expect(level.checks.length).toBeGreaterThan(0);
    });
  });

  it('keeps check commands portable for both runners', () => {
    for (const level of matrix.levels) {
      for (const check of level.checks) {
        expect(check.program.length).toBeGreaterThan(0);
        expect(check.timeoutMs).toBeGreaterThan(0);
        if (check.program === 'internal') continue;
        expect(['root', 'src-tauri']).toContain(check.cwd);
      }
    }
  });

  it('keeps L4 CLI audit mode and shared security rules', () => {
    const l4 = matrix.levels[3];
    expect(l4.aiAudit?.mode).toBe('cli');
    expect(l4.checks.some((check) => check.name === 'semantic audit')).toBe(true);
    expect(matrix.securityRules.ignorePaths).toContain('verify.matrix.json');
    expect(matrix.securityRules.secrets.length).toBeGreaterThan(0);
    for (const rule of matrix.securityRules.secrets) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(Boolean(rule.prefix) || Boolean(rule.contains)).toBe(true);
    }
    expect(matrix.securityRules.debugCalls.ts).toContain('console.log');
    expect(matrix.securityRules.debugCalls.rs).toContain('dbg!');
  });
});
