import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function collectFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

function frontendInvokes() {
  const files = [
    ...collectFiles(path.join(root, 'src'), '.ts'),
    ...collectFiles(path.join(root, 'src'), '.tsx'),
  ];
  const commands = new Set();
  const dynamicCalls = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      if (line.includes('function invoke')) return;
      for (const match of line.matchAll(/invoke(?:<[^>]+>)?\(\s*([`'"])([^`'"]+)\1/g)) {
        commands.add(match[2]);
      }
      for (const match of line.matchAll(/invoke(?:<[^>]+>)?\(\s*(?!['"`])[^)]*?\)/g)) {
        const first = match[0].replace(/^invoke(?:<[^>]+>)?\(\s*/, '').trim();
        if (/^cmd[,)]/.test(first)) continue;
        if (!first.startsWith("'") && !first.startsWith('"') && !first.startsWith('`')) {
          dynamicCalls.push({
            file: path.relative(root, file),
            line: lineIndex + 1,
            snippet: match[0].slice(0, 80),
          });
        }
      }
    });
  }
  return { commands: [...commands].sort(), dynamicCalls };
}

function rustHandlers() {
  const lib = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const start = lib.indexOf('tauri::generate_handler![');
  if (start < 0) throw new Error('generate_handler block not found');
  const open = lib.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < lib.length; i++) {
    if (lib[i] === '[') depth += 1;
    else if (lib[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = lib.slice(open + 1, end);
  const handlers = block
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('::').pop());
  return [...new Set(handlers)].sort();
}

const { commands, dynamicCalls } = frontendInvokes();
const handlers = rustHandlers();
const missing = commands.filter((command) => !handlers.includes(command));
const unused = handlers.filter((handler) => !commands.includes(handler));

console.log(
  JSON.stringify(
    {
      frontendCommands: commands.length,
      rustHandlers: handlers.length,
      missingInRust: missing,
      dynamicInvokeCalls: dynamicCalls,
      rustHandlersNotCalledFromFrontend: unused,
    },
    null,
    2,
  ),
);

if (missing.length || dynamicCalls.length) {
  console.error(`CONTRACT_AUDIT_FAILED: ${missing.length} missing, ${dynamicCalls.length} dynamic`);
  process.exit(1);
}
console.log('CONTRACT_AUDIT_EXIT=0');
