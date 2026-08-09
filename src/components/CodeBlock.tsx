import { useState } from 'react';
import { Check, Copy, Sparkles, Undo2 } from 'lucide-react';
import * as db from '../lib/db';
import { toast } from '../lib/toast';

type ApplyState = 'idle' | 'applying' | 'applied';

export default function CodeBlock({
  code,
  lang,
  projectPath,
}: {
  code: string;
  lang: string;
  projectPath?: string;
}) {
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [backupId, setBackupId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const apply = async () => {
    if (!projectPath || applyState !== 'idle') return;
    setApplyState('applying');
    try {
      const rel = prompt('写入目标文件（相对项目路径，如 src/foo.ts）:', 'src/example.ts');
      if (!rel || !rel.trim()) {
        setApplyState('idle');
        return;
      }
      const result = await db.applyCodeSnippet(projectPath, rel.trim(), code);
      setBackupId(result.backupId);
      setApplyState('applied');
      toast.success(`已写入本地 ${result.filePath} (${result.diffDelta})`);
    } catch (err) {
      setApplyState('idle');
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const rollback = async () => {
    if (!projectPath || !backupId) return;
    try {
      await db.rollbackSnapshot(projectPath, backupId);
      setBackupId(null);
      setApplyState('idle');
      toast.success('已安全还原文件至 Apply 前状态');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      data-code-apply
      className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d11]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-2.5 py-1.5">
        <span className="font-mono text-[9px] text-slate-500">{lang || 'code'}</span>
        <div className="flex items-center gap-1">
          {projectPath && (
            <>
              {applyState === 'applied' ? (
                <button
                  type="button"
                  data-code-rollback
                  onClick={() => void rollback()}
                  className="flex h-5 items-center gap-1 rounded-md border border-white/10 px-1.5 text-[9px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                  title="还原 (Cmd+Z)"
                >
                  <Undo2 size={9} /> 还原
                </button>
              ) : (
                <button
                  type="button"
                  data-code-apply-btn
                  disabled={applyState === 'applying'}
                  onClick={() => void apply()}
                  className="flex h-5 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  title="写入本地并备份"
                >
                  {applyState === 'applying' ? (
                    <>
                      <Check size={9} /> 正在写入...
                    </>
                  ) : (
                    <>
                      <Sparkles size={9} /> Apply
                    </>
                  )}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            data-code-copy
            onClick={() => void copy()}
            className="flex h-5 items-center gap-1 rounded-md border border-white/10 px-1.5 text-[9px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            title="Copy"
          >
            <Copy size={9} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="max-h-[40vh] overflow-auto px-3 py-2 text-[11px] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
