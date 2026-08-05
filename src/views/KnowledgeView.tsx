import { BookOpen, FolderOpen, Plus, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import ModelBadge from "../components/ui/ModelBadge";

export default function KnowledgeView() {
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("#work");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<db.RagSearchResult[] | null>(null);
  const [indexStatus, setIndexStatus] = useState<db.RagIndexStatus | null>(null);
  const [vaultPath, setVaultPath] = useState("");
  const [vaultStatus, setVaultStatus] = useState<db.KnowledgeIndexStatus | null>(null);
  const [watchStatus, setWatchStatus] = useState<db.VaultWatchStatus | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void db.getRagIndexStatus().then(setIndexStatus);
  }, [thoughts.length]);

  useEffect(() => {
    void db.getKnowledgeIndexStatus().then(setVaultStatus);
  }, []);

  useEffect(() => {
    void db.getVaultWatchStatus().then(setWatchStatus);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenVaultWatchUpdated((status) => {
        if (disposed) return;
        setWatchStatus(status);
        void db.getKnowledgeIndexStatus().then((next) => {
          if (!disposed) setVaultStatus(next);
        });
        void db.getRagIndexStatus().then((next) => {
          if (!disposed) setIndexStatus(next);
        });
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  const allTags = Array.from(new Set(thoughts.flatMap((t) => t.tags.split(",").map((x) => x.trim()).filter(Boolean))));
  const filtered = filter === "all" ? thoughts : thoughts.filter((t) => t.tags.includes(filter));
  const visibleThoughts = results ?? filtered;
  const selected = visibleThoughts.find((t) => t.id === selectedId) ?? visibleThoughts[0] ?? null;

  const add = async () => {
    if (!content.trim()) return;
    await addThought(content.trim(), tags, "inbox");
    setContent("");
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setResults(await db.searchThoughts(query.trim(), 5));
  };

  const runIndex = async () => {
    if (!vaultPath.trim()) return;
    await db.indexVault(vaultPath.trim());
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  const toggleWatch = async () => {
    if (!vaultPath.trim() && !watchStatus?.watching) return;
    setWatchStatus(
      watchStatus?.watching ? await db.stopVaultWatch() : await db.startVaultWatch(vaultPath.trim()),
    );
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <BentoCard title="Thought Inbox" subtitle="Command+N 闪念速记" icon={BookOpen} colSpan={12}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void add();
              }
            }}
            rows={2}
            placeholder="Capture a thought..."
            className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="h-9 w-28 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none"
            placeholder="#tags"
          />
          <button
            type="button"
            onClick={() => void add()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </BentoCard>

      <BentoCard title="Vault Index" subtitle="Obsidian / Markdown 文件夹纳入 RAG" icon={FolderOpen} colSpan={12}>
        <div className="flex items-end gap-2">
          <input
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runIndex();
              }
            }}
            placeholder="Vault path..."
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void runIndex()}
            className="flex h-9 items-center rounded-xl bg-blue-500/20 px-3 text-xs text-[#7FB4FF] hover:bg-blue-500/30"
          >
            Index vault
          </button>
          <button
            type="button"
            onClick={() => void toggleWatch()}
            data-vault-watch={watchStatus?.watching ? "on" : "off"}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <RefreshCw size={14} className={watchStatus?.watching ? "animate-spin" : ""} />
            {watchStatus?.watching ? "Stop watch" : "Watch vault"}
          </button>
          <span data-vault-watch-status={watchStatus?.watching ? "on" : "off"}>
            <ModelBadge
              label="Watch"
              tone="green"
              status={watchStatus?.watching ? "watching" : "off"}
              pulse={watchStatus?.watching}
            />
          </span>
          <span data-vault-files={vaultStatus?.files ?? 0}>
            <ModelBadge
              label="Vault"
              tone="blue"
              status={vaultStatus ? `${vaultStatus.files} files` : "pending"}
            />
          </span>
        </div>
      </BentoCard>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-2 flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-3 shadow-xl">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2 py-1.5 text-left text-[11px] ${
              filter === "all" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`rounded-lg px-2 py-1.5 text-left text-[11px] ${
                filter === t ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="col-span-5 flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-3 shadow-xl">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 focus-within:border-emerald-500/40">
              <Search size={12} className="shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="RAG search..."
                className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults(null);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              className="flex h-8 items-center rounded-xl bg-emerald-500/20 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
            >
              Search
            </button>
          </div>
          {results !== null && results.length > 0 && (
            <div className="shrink-0 border-b border-white/10 pb-2 text-[10px] text-slate-500">
              {results.length} RAG matches
            </div>
          )}
          {visibleThoughts.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                selected?.id === t.id
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <span className="block truncate">{t.content.split("\n")[0]}</span>
              {"score" in t && typeof t.score === "number" && (
                <span className="mt-0.5 block text-[10px] text-slate-500">score {t.score.toFixed(2)}</span>
              )}
            </button>
          ))}
          {visibleThoughts.length === 0 && <div className="py-10 text-center text-xs text-slate-600">No thoughts</div>}
        </div>
        <div
          key={selected?.id ?? "empty"}
          className={`col-span-5 flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl ${
            selected ? "detail-enter" : ""
          }`}
        >
          {selected ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{selected.type}</span>
                <ModelBadge label={selected.tags} tone="green" />
              </div>
              <div className="markdown-body min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed text-slate-300">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-slate-600">Select a thought</div>
          )}
          <div className="mt-auto pt-4">
            <ModelBadge
              label="RAG index"
              tone="blue"
              status={indexStatus?.indexed ? `${indexStatus.documents} docs` : "pending"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
