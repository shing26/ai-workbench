import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSemanticAudit } from '../src/lib/l4SemanticAuditCore.mjs';

function git(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  });
}

function changedFiles(projectRoot) {
  const porcelain = git(['status', '--porcelain'], projectRoot);
  if (porcelain.status !== 0) {
    throw new Error(`git status failed: ${porcelain.stderr || porcelain.stdout}`);
  }
  const names = porcelain.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll('\\', '/'));

  const numstat = git(['diff', '--numstat'], projectRoot);
  const additions = new Map();
  if (numstat.status === 0) {
    for (const line of numstat.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [added, , file] = line.split('\t');
      if (file) additions.set(file, Number(added || 0));
    }
  }

  return names.map((file) => ({
    path: file,
    insertions: additions.get(file) ?? 0,
  }));
}

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), dodPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--dod') args.dodPath = argv[index + 1];
    else if (argv[index] === '--project-root') args.projectRoot = argv[index + 1];
    else if (argv[index] === '--') break;
  }
  return args;
}

function main() {
  const { projectRoot, dodPath } = parseArgs(process.argv.slice(2));
  let dod = null;
  const resolvedDod = dodPath
    ? path.isAbsolute(dodPath)
      ? dodPath
      : path.join(projectRoot, dodPath.replaceAll('\\', '/'))
    : discoverJourneyDoc(projectRoot);
  if (resolvedDod) dod = fs.readFileSync(resolvedDod, 'utf8');
  const files = changedFiles(projectRoot);
  const result = runSemanticAudit(dod, files);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'FAIL') {
    console.error('L4_SEMANTIC_AUDIT_FAILED');
    process.exit(1);
  }
  console.log('L4_SEMANTIC_AUDIT_EXIT=0');
}

function discoverJourneyDoc(projectRoot) {
  const journeyDir = path.join(projectRoot, 'docs', 'journey');
  if (!fs.existsSync(journeyDir)) return null;
  const docs = fs
    .readdirSync(journeyDir)
    .filter((file) => file.endsWith('.md'))
    .sort();
  return docs.length > 0 ? path.join(journeyDir, docs[0]) : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
