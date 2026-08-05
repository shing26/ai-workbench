import type { ReactNode } from "react";

export type DiffLineKind = "file" | "hunk" | "add" | "del" | "context";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

const KEYWORDS = new Set([
  "async",
  "await",
  "bool",
  "class",
  "const",
  "def",
  "else",
  "enum",
  "export",
  "false",
  "fn",
  "for",
  "from",
  "function",
  "if",
  "impl",
  "import",
  "interface",
  "int",
  "let",
  "match",
  "new",
  "null",
  "pass",
  "print",
  "pub",
  "return",
  "self",
  "str",
  "struct",
  "true",
  "type",
  "undefined",
  "use",
  "var",
  "void",
  "while",
]);

export function detectLanguage(file: string): string {
  const name = file.toLowerCase();
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "tsx";
  if (name.endsWith(".ts")) return "ts";
  if (name.endsWith(".js")) return "js";
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".sql")) return "sql";
  return "plain";
}

export function parseDiffLines(diff: string): DiffLine[] {
  return diff.split("\n").map((raw) => {
    const text = raw;
    if (
      text.startsWith("diff --git") ||
      text.startsWith("index ") ||
      text.startsWith("--- ") ||
      text.startsWith("+++ ") ||
      text.startsWith("new file mode") ||
      text.startsWith("deleted file mode")
    ) {
      return { kind: "file", text };
    }
    if (text.startsWith("@@")) return { kind: "hunk", text };
    if (text.startsWith("+") && !text.startsWith("+++")) return { kind: "add", text };
    if (text.startsWith("-") && !text.startsWith("---")) return { kind: "del", text };
    return { kind: "context", text };
  });
}

const TOKEN_PATTERN =
  /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

export function highlightLine(line: string, language: string): ReactNode[] {
  if (language === "plain" || language === "markdown") return [line];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    const token = match[0];
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    let className = "";
    if (token.startsWith("//") || token.startsWith("#") || token.startsWith("/*")) {
      className = "text-slate-500 italic";
    } else if (
      token.startsWith('"') ||
      token.startsWith("'") ||
      token.startsWith("`")
    ) {
      className = "text-amber-300/90";
    } else if (/^\d/.test(token)) {
      className = "text-sky-300/90";
    } else if (KEYWORDS.has(token)) {
      className = "text-violet-300/90";
    }
    if (className) {
      nodes.push(
        <span key={`${match.index}-${token}`} className={className}>
          {token}
        </span>,
      );
    } else {
      nodes.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }
  return nodes;
}
