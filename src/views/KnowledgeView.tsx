import { BookOpen, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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

  const allTags = Array.from(new Set(thoughts.flatMap((t) => t.tags.split(",").map((x) => x.trim()).filter(Boolean))));
  const filtered = filter === "all" ? thoughts : thoughts.filter((t) => t.tags.includes(filter));
  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const add = async () => {
    if (!content.trim()) return;
    await addThought(content.trim(), tags, "inbox");
    setContent("");
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
          {filtered.map((t) => (
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
              {t.content.split("\n")[0]}
            </button>
          ))}
          {filtered.length === 0 && <div className="py-10 text-center text-xs text-slate-600">No thoughts</div>}
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
            <ModelBadge label="RAG index" tone="blue" status="pending" />
          </div>
        </div>
      </div>
    </div>
  );
}
