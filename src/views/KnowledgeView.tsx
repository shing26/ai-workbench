import { useState } from "react";
import { ChevronRight, BookOpen, Search, Folder, FileText, Tag, Calendar } from "lucide-react";
import { useKnowledgeStore } from "../stores/knowledgeStore";

export default function KnowledgeView() {
  const { notes } = useKnowledgeStore();
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<typeof notes[0] | null>(null);

  const filtered = notes.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const projects = [...new Set(notes.map(n => n.project).filter(Boolean))];

  return (
    <div className="flex h-full w-full">
      {/* === MID PANEL: Folder tree + notes === */}
      <aside className="scrollbar-mid shrink-0 flex flex-col overflow-hidden"
        style={{ width: "var(--chat-mid-panel-min)", minWidth: "var(--chat-mid-panel-min)", maxWidth: "var(--chat-mid-panel-max)", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--color-text-muted)" }}>Knowledge</span>
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sm)] mb-2" style={{ background: "var(--color-bg-primary)", border: "1px solid var(--color-border-subtle)" }}>
            <Search size={12} style={{ color: "var(--color-text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..."
              className="flex-1 bg-transparent outline-none text-[11px]" style={{ color: "var(--color-text-primary)" }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-mid">
          {projects.map((project) => (
            <div key={project}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                <Folder size={12} /> {project}
              </div>
              {filtered.filter(n => n.project === project).map((note) => (
                <button key={note.id} onClick={() => setSelectedNote(note)}
                  className="w-full text-left pl-8 pr-3 py-1.5 text-[11px] transition-colors truncate"
                  style={{ color: selectedNote?.id === note.id ? "var(--color-accent)" : "var(--color-text-muted)", borderLeft: selectedNote?.id === note.id ? "2px solid var(--color-accent)" : "2px solid transparent", background: selectedNote?.id === note.id ? "var(--color-accent-muted)" : "transparent" }}
                  onMouseEnter={(e) => { if (selectedNote?.id !== note.id) e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                  onMouseLeave={(e) => { if (selectedNote?.id !== note.id) e.currentTarget.style.background = "transparent"; }}>
                  <FileText size={10} className="inline mr-1.5" /> {note.title}
                </button>
              ))}
            </div>
          ))}
          {filtered.filter(n => !n.project).map((note) => (
            <button key={note.id} onClick={() => setSelectedNote(note)}
              className="w-full text-left px-3 py-1.5 text-[11px] transition-colors truncate"
              style={{ color: selectedNote?.id === note.id ? "var(--color-accent)" : "var(--color-text-muted)", borderLeft: selectedNote?.id === note.id ? "2px solid var(--color-accent)" : "2px solid transparent", background: selectedNote?.id === note.id ? "var(--color-accent-muted)" : "transparent" }}>
              <FileText size={10} className="inline mr-1.5" /> {note.title}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>No notes found</div>
          )}
        </div>
      </aside>

      {/* === RIGHT PANEL === */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-bg-primary)" }}>
        <div className="flex items-center h-[40px] px-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>AI Workbench</span><ChevronRight size={10} /><span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>Knowledge</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-content p-6">
          {selectedNote ? (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>{selectedNote.title}</h1>
              <div className="flex items-center gap-2 mb-4 text-[10px]">
                {selectedNote.project && <span className="px-2 py-0.5 rounded" style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}>{selectedNote.project}</span>}
                {selectedNote.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-muted)" }}><Tag size={9} />{tag}</span>
                ))}
                <span className="flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}><Calendar size={9} />{new Date(selectedNote.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                {selectedNote.content}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpen size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Select a note to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}