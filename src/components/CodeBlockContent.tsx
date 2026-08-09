import CodeBlock from './CodeBlock';

export function renderRichContent(content: string, projectPath?: string) {
  const parts: React.ReactNode[] = [];
  const blockRe = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let textKey = 0;
  let codeKey = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${textKey}`} className="whitespace-pre-wrap break-words">
          {content.slice(lastIndex, match.index)}
        </span>,
      );
      textKey += 1;
    }
    const lang = match[1] ?? '';
    const code = match[2].replace(/\n$/, '');
    parts.push(
      <CodeBlock key={`c-${codeKey}`} code={code} lang={lang} projectPath={projectPath} />,
    );
    codeKey += 1;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(
      <span key={`t-${textKey}`} className="whitespace-pre-wrap break-words">
        {content.slice(lastIndex)}
      </span>,
    );
  }
  return parts;
}
