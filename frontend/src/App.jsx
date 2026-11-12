
import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, LogOut, Menu, Volume2, VolumeX, X } from "lucide-react";
import * as api from "./services/api";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";
import MemoryPanel from "./components/MemoryPanel";
import ConfirmDialog from "./components/ConfirmDialog";

const PENDING_USER = "pending-user";
const STREAMING = "streaming";

export default function App() {
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(api.getStoredToken())
  );

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [settings, setSettings] = useState({
    memory_enabled: true,
    speak_responses: false,
  });

  const abortRef = useRef(null);
  const speech = useSpeechSynthesis();

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    refreshConversations();
    api.getSettings().then(setSettings).catch(() => {});
  }, [authenticated, refreshConversations]);

  function handleLogin() {
    setAuthenticated(true);
    setError(null);
  }

  function handleLogout() {
    abortRef.current?.abort();
    speech.stop();
    api.clearAuthToken();

    setAuthenticated(false);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setSettings({
      memory_enabled: true,
      speak_responses: false,
    });
    setError(null);
    setMemoryOpen(false);
    setSidebarOpen(false);
    setPendingDelete(null);
  }

  async function runStream(starter) {
    setError(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      { id: STREAMING, role: "assistant", content: "", streaming: true },
    ]);

    let text = "";
    let savedId = null;

    try {
      await starter({
        signal: controller.signal,
        onMeta: (meta) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === PENDING_USER
                ? { ...m, id: meta.user_message_id }
                : m
            )
          ),
        onToken: (piece) => {
          text += piece;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === STREAMING
                ? { ...m, content: m.content + piece }
                : m
            )
          );
        },
        onDone: (done) => {
          savedId = done.message_id;
        },
        onError: (err) => {
          setError(err.message);
          if (err.message_id) savedId = err.message_id;
        },
      });
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      const finalId = savedId ?? `local-${Date.now()}`;

      setMessages((prev) =>
        prev.flatMap((m) => {
          if (m.id !== STREAMING) return [m];
          return m.content
            ? [{ ...m, id: finalId, streaming: false }]
            : [];
        })
      );

      abortRef.current = null;
      setBusy(false);
      refreshConversations();
    }

    return { text, id: savedId };
  }

  function maybeSpeak(result) {
    if (settings.speak_responses && result.text && result.id) {
      speech.speak(result.id, result.text);
    }
  }

  async function handleSend(content) {
    setError(null);
    speech.stop();

    let conversationId = activeId;

    if (conversationId === null) {
      try {
        const created = await api.createConversation();
        conversationId = created.id;
        setActiveId(created.id);
        setConversations((prev) => [created, ...prev]);
      } catch (e) {
        setError(e.message);
        return;
      }
    }

    setMessages((prev) => [
      ...prev,
      { id: PENDING_USER, role: "user", content },
    ]);

    const result = await runStream((handlers) =>
      api.streamMessage(conversationId, content, handlers)
    );

    maybeSpeak(result);
  }

  async function handleRegenerate() {
    if (busy || activeId === null) return;

    speech.stop();

    setMessages((prev) =>
      prev.length && prev[prev.length - 1].role === "assistant"
        ? prev.slice(0, -1)
        : prev
    );

    const result = await runStream((handlers) =>
      api.streamRegenerate(activeId, handlers)
    );

    maybeSpeak(result);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleNewChat() {
    abortRef.current?.abort();
    speech.stop();
    setActiveId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  }

  async function handleSelect(id) {
    if (id === activeId) {
      setSidebarOpen(false);
      return;
    }

    abortRef.current?.abort();
    speech.stop();

    try {
      const conversation = await api.getConversation(id);
      setActiveId(id);
      setMessages(conversation.messages);
      setError(null);
      setSidebarOpen(false);
    } catch (e) {
      setError(e.message);
      refreshConversations();
    }
  }

  async function handleRename(id, title) {
    try {
      const updated = await api.renameConversation(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);

    if (!target) return;

    try {
      await api.deleteConversation(target.id);
      setConversations((prev) =>
        prev.filter((c) => c.id !== target.id)
      );

      if (target.id === activeId) handleNewChat();
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateSettings(patch) {
    const previous = settings;

    setSettings({ ...settings, ...patch });

    if (patch.speak_responses === false) speech.stop();

    try {
      setSettings(await api.updateSettings(patch));
    } catch (e) {
      setSettings(previous);
      setError(e.message);
    }
  }

  if (!authenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title ?? "New chat";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={handleNewChat}
        onSelect={handleSelect}
        onRename={handleRename}
        onDelete={setPendingDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-ink-700 px-3 py-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-slate-300">
            {activeTitle}
          </h1>

          {speech.supported && (
            <button
              onClick={() =>
                updateSettings({
                  speak_responses: !settings.speak_responses,
                })
              }
              className={`rounded-lg p-2 hover:bg-ink-800 ${
                settings.speak_responses
                  ? "text-accent"
                  : "text-slate-400"
              }`}
              title={
                settings.speak_responses
                  ? "Spoken responses: on"
                  : "Spoken responses: off"
              }
              aria-label="Toggle spoken responses"
              aria-pressed={settings.speak_responses}
            >
              {settings.speak_responses ? (
                <Volume2 size={18} />
              ) : (
                <VolumeX size={18} />
              )}
            </button>
          )}

          <button
            onClick={() => setMemoryOpen(true)}
            className={`rounded-lg p-2 hover:bg-ink-800 ${
              settings.memory_enabled ? "text-accent" : "text-slate-400"
            }`}
            title={settings.memory_enabled ? "Memory: on" : "Memory: off"}
            aria-label="Open memory"
          >
            <Brain size={18} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-ink-800 hover:text-white"
            title="Sign out"
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <ChatWindow
          conversationId={activeId}
          messages={messages}
          busy={busy}
          speech={speech}
          onRegenerate={handleRegenerate}
        />

        {error && (
          <div className="mx-auto mb-2 flex w-full max-w-3xl items-start gap-3 px-4">
            <p
              className="flex-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>

            <button
              onClick={() => setError(null)}
              className="mt-1 rounded p-1 text-slate-400 hover:bg-ink-800"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <Composer
          busy={busy}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>

      <MemoryPanel
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this conversation?"
        message={
          pendingDelete
            ? `“${pendingDelete.title}” and all its messages will be permanently deleted.`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}