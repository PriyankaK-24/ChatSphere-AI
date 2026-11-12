import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import * as api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";

const CATEGORIES = ["preference", "style", "interest", "context"];

export default function MemoryPanel({ open, onClose, settings, onSettingsChange }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("context");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  // Reload every time the panel opens, so memories saved in the background show up.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .listMemories()
      .then(setMemories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !confirmClear && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmClear]);

  if (!open) return null;

  async function add() {
    const content = newText.trim();
    if (!content) return;
    try {
      setError(null);
      const created = await api.createMemory(content, newCategory);
      setMemories((prev) => [created, ...prev]);
      setNewText("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveEdit(id) {
    const content = editText.trim();
    if (!content) return;
    try {
      setError(null);
      const updated = await api.updateMemory(id, { content });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    try {
      setError(null);
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function clearAll() {
    setConfirmClear(false);
    try {
      setError(null);
      await api.clearMemories();
      setMemories([]);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-ink-700 bg-ink-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 id="memory-title" className="text-lg font-semibold">Memory</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-ink-700 p-3">
            <span>
              <span className="block text-sm font-medium">Remember useful things about me</span>
              <span className="block text-xs text-slate-400">
                When off, nothing is saved and saved memories are not used. Existing memories are kept.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.memory_enabled}
              onChange={() => onSettingsChange({ memory_enabled: !settings.memory_enabled })}
              className="mt-1 h-4 w-4 accent-teal-300"
            />
          </label>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="flex gap-2">
            <input
              value={newText}
              maxLength={300}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add a memory, e.g. “Prefers short answers”"
              className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-accent/50"
              aria-label="New memory"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-950 px-2 text-sm"
              aria-label="Memory category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={!newText.trim()}
              className="rounded-lg bg-accent px-3 text-ink-950 disabled:opacity-40"
              aria-label="Add memory"
            >
              <Plus size={16} />
            </button>
          </div>

          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && memories.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              No memories yet. Useful details you share in chat may be saved here automatically.
            </p>
          )}

          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="rounded-xl border border-ink-700 p-3">
                {editingId === m.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editText}
                      maxLength={300}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(m.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-sm outline-none focus:border-accent/50"
                      aria-label="Edit memory"
                    />
                    <button onClick={() => saveEdit(m.id)} className="rounded p-1.5 text-accent hover:bg-ink-800" aria-label="Save">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-slate-400 hover:bg-ink-800" aria-label="Cancel edit">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm">{m.content}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {m.category} · {m.source === "auto" ? "saved automatically" : "added by you"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditText(m.content);
                        }}
                        className="rounded p-1.5 text-slate-400 hover:bg-ink-800 hover:text-slate-200"
                        aria-label="Edit memory"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-ink-800 hover:text-red-400"
                        aria-label="Delete memory"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {memories.length > 0 && (
          <div className="border-t border-ink-700 px-5 py-3">
            <button onClick={() => setConfirmClear(true)} className="text-sm text-red-400 hover:underline">
              Delete all memories
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all memories?"
        message="This permanently removes every saved memory. Your conversations are not affected."
        confirmLabel="Delete all"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
