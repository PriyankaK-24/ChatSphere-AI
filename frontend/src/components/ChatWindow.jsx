import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ conversationId, messages, busy, speech, onRegenerate }) {
  const scrollRef = useRef(null);
  const stickRef = useRef(true); // follow new tokens unless the user scrolled up

  useEffect(() => {
    stickRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, conversationId]);

  function onScroll(e) {
    const el = e.currentTarget;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  let lastAssistantIndex = -1;
  messages.forEach((m, i) => {
    if (m.role === "assistant") lastAssistantIndex = i;
  });

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Sparkles />
            </div>
            <h2 className="text-2xl font-semibold">How can I help today?</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Type a message, or use the microphone to speak. Your conversations are saved
              automatically.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isLastAssistant={i === lastAssistantIndex}
              busy={busy}
              speech={speech}
              onRegenerate={onRegenerate}
            />
          ))
        )}
      </div>
    </div>
  );
}
