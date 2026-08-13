const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.rs',
  '.py',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.cs',
  '.rb',
  '.php',
];

const DOC_EXTENSIONS = ['.md', '.txt', '.rst'];

export function isCodeFile(file) {
  const lower = file.toLowerCase();
  return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isDocFile(file) {
  const lower = file.toLowerCase();
  return DOC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function parseDoTasks(dod) {
  let checked = 0;
  let pending = 0;
  let archived = false;
  for (const line of dod.split(/\r?\n/)) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('- [x]')) checked += 1;
    else if (lower.startsWith('- [ ]')) pending += 1;
    else if (lower.includes('journeystage: archived')) archived = true;
  }
  return { checked, pending, archived };
}

export function runSemanticAudit(dod, files) {
  const errors = [];
  const warnings = [];
  let codeFiles = 0;
  let docFiles = 0;
  let otherFiles = 0;
  for (const file of files) {
    if (isCodeFile(file.path)) codeFiles += 1;
    else if (isDocFile(file.path)) docFiles += 1;
    else otherFiles += 1;
  }

  let checkedTasks = 0;
  let pendingTasks = 0;
  let archived = false;
  if (dod !== null) {
    ({ checked: checkedTasks, pending: pendingTasks, archived } = parseDoTasks(dod));
  }

  const evidence = {
    checkedTasks,
    pendingTasks,
    codeFiles,
    docFiles,
    otherFiles,
    archived,
  };

  let status;
  if (files.length === 0) {
    status = 'NO_CHANGES';
  } else if (dod === null) {
    errors.push('未提供旅程文档（DoD），无法执行语义对齐审查');
    status = 'FAIL';
  } else if (codeFiles === 0 && pendingTasks > 0 && !archived) {
    errors.push(`DoD 仍有 ${pendingTasks} 项待办任务，但变更未包含代码实现`);
    status = 'FAIL';
  } else {
    if (codeFiles === 0 && pendingTasks === 0) {
      warnings.push('变更未包含代码文件，且 DoD 无待办任务');
    }
    status = 'PASS';
  }

  return { status, errors, warnings, evidence };
}
