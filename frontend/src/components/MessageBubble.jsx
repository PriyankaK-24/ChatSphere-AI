import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Pause, Play, RefreshCw, Sparkles, Square, Volume2 } from "lucide-react";

const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

function IconButton({ label, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-slate-500 hover:bg-ink-800 hover:text-slate-200"
    >
      {children}
    </button>
  );
}

export default function MessageBubble({ message, isLastAssistant, busy, speech, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-ink-700 px-4 py-2.5">
          {message.content}
        </div>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable on insecure origins; nothing else to do.
    }
  }

  const speaking = speech.speakingId === message.id;

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles size={14} />
      </div>
      <div className="min-w-0 flex-1">
        {message.streaming && !message.content ? (
          <p className="py-1 text-sm text-slate-500" role="status">Thinking…</p>
        ) : (
          <div className="markdown">
            <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.streaming && message.content && (
          <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent/70" aria-label="Generating" />
        )}

        {!message.streaming && message.content && (
          <div className="mt-2 flex items-center gap-0.5">
            <IconButton label={copied ? "Copied" : "Copy response"} onClick={copy}>
              {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
            </IconButton>

            {speech.supported && !speaking && (
              <IconButton label="Read aloud" onClick={() => speech.speak(message.id, message.content)}>
                <Volume2 size={15} />
              </IconButton>
            )}
            {speech.supported && speaking && (
              <>
                <IconButton
                  label={speech.paused ? "Resume reading" : "Pause reading"}
                  onClick={speech.paused ? speech.resume : speech.pause}
                >
                  {speech.paused ? <Play size={15} /> : <Pause size={15} />}
                </IconButton>
                <IconButton label="Stop reading" onClick={speech.stop}>
                  <Square size={15} />
                </IconButton>
              </>
            )}

            {isLastAssistant && !busy && (
              <IconButton label="Regenerate response" onClick={onRegenerate}>
                <RefreshCw size={15} />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
