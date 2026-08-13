export type SemanticAuditFile = {
  path: string;
  insertions: number;
};

export type SemanticAuditEvidence = {
  checkedTasks: number;
  pendingTasks: number;
  codeFiles: number;
  docFiles: number;
  otherFiles: number;
  archived: boolean;
};

export type SemanticAuditResult = {
  status: 'NO_CHANGES' | 'FAIL' | 'PASS';
  errors: string[];
  warnings: string[];
  evidence: SemanticAuditEvidence;
};

export { isCodeFile, isDocFile, parseDoTasks, runSemanticAudit } from './l4SemanticAuditCore.mjs';
