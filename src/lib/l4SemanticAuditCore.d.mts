export function isCodeFile(file: string): boolean;

export function isDocFile(file: string): boolean;

export function parseDoTasks(dod: string): {
  checked: number;
  pending: number;
  archived: boolean;
};

export function runSemanticAudit(
  dod: string | null,
  files: Array<{ path: string; insertions: number }>,
): {
  status: 'NO_CHANGES' | 'FAIL' | 'PASS';
  errors: string[];
  warnings: string[];
  evidence: {
    checkedTasks: number;
    pendingTasks: number;
    codeFiles: number;
    docFiles: number;
    otherFiles: number;
    archived: boolean;
  };
};
