import { useRef, useState } from "react";
import { MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";

export default function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNew,
  onSelect,
  onRename,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const cancelRef = useRef(false);

  function startEdit(conversation) {
    cancelRef.current = false;
    setEditingId(conversation.id);
    setDraft(conversation.title);
  }

  // Enter and click-away both end in blur, so there is exactly one commit path.
  function finishEdit(conversation) {
    const title = draft.trim();
    if (!cancelRef.current && title && title !== conversation.title) {
      onRename(conversation.id, title);
    }
    cancelRef.current = false;
    setEditingId(null);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink-700 bg-ink-900 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={onNew}
            className="flex flex-1 items-center gap-2 rounded-lg border border-ink-700 px-3 py-2 text-sm font-medium hover:bg-ink-800"
          >
            <Plus size={16} className="text-accent" /> New chat
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-ink-800 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversations">
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              No conversations yet. Send a message to start one.
            </p>
          )}
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <div
                  className={`group flex items-center gap-2 rounded-lg px-2 py-2 ${
                    c.id === activeId ? "bg-ink-800" : "hover:bg-ink-800/60"
                  }`}
                >
                  {editingId === c.id ? (
                    <input
                      autoFocus
                      value={draft}
                      maxLength={100}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => finishEdit(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          cancelRef.current = true;
                          e.currentTarget.blur();
                        }
                      }}
                      className="min-w-0 flex-1 rounded bg-ink-950 px-2 py-1 text-sm outline-none ring-1 ring-accent/50"
                      aria-label="Conversation title"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onSelect(c.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                        title={c.title}
                      >
                        <MessageSquare size={14} className="shrink-0 text-slate-500" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <div className="flex shrink-0 gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                        <button
                          onClick={() => startEdit(c)}
                          className="rounded p-1 text-slate-400 hover:bg-ink-700 hover:text-slate-200"
                          aria-label={`Rename ${c.title}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          className="rounded p-1 text-slate-400 hover:bg-ink-700 hover:text-red-400"
                          aria-label={`Delete ${c.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
