import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, SendHorizontal, Square } from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

export default function Composer({ busy, onSend, onStop }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);
  const baseRef = useRef("");
  const recognition = useSpeechRecognition();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value || busy) return;
    if (recognition.listening) recognition.stop();
    onSend(value);
    setText("");
  }

  function toggleMic() {
    if (recognition.listening) {
      recognition.stop();
      return;
    }
    // Spoken words are appended to whatever is already typed, and stay editable.
    baseRef.current = text ? `${text.trimEnd()} ` : "";
    recognition.start({ onText: (spoken) => setText(baseRef.current + spoken) });
    textareaRef.current?.focus();
  }

  return (
    <div className="px-4 pb-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-2 focus-within:border-accent/50">
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            maxLength={8000}
            placeholder={recognition.listening ? "Listening… speak now" : "Message ChatSphere AI"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-slate-500"
            aria-label="Message"
          />
          <button
            onClick={toggleMic}
            disabled={!recognition.supported}
            title={
              recognition.supported
                ? recognition.listening
                  ? "Stop listening"
                  : "Speak your message"
                : "Voice input isn't supported in this browser"
            }
            aria-label={recognition.listening ? "Stop listening" : "Start voice input"}
            className={`rounded-xl p-2.5 ${
              recognition.listening
                ? "bg-red-500/20 text-red-400"
                : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {recognition.supported ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          {busy ? (
            <button
              onClick={onStop}
              title="Stop generating"
              aria-label="Stop generating"
              className="rounded-xl bg-ink-700 p-2.5 text-slate-200 hover:bg-ink-700/80"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              title="Send"
              aria-label="Send message"
              className="rounded-xl bg-accent p-2.5 text-ink-950 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendHorizontal size={18} />
            </button>
          )}
        </div>
        <div className="mt-1.5 min-h-[1rem] px-1 text-xs text-slate-500">
          {recognition.error ? (
            <span className="text-amber-400">{recognition.error}</span>
          ) : !recognition.supported ? (
            "Voice input isn't available in this browser. Try Chrome or Edge, or type your message."
          ) : (
            "Enter to send · Shift+Enter for a new line"
          )}
        </div>
      </div>
    </div>
  );
}
