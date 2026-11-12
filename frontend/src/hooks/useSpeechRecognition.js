import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

function describeError(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow it in your browser's site settings.";
    case "no-speech":
      return "No speech detected. Try again.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Speech recognition needs an internet connection in this browser.";
    case "aborted":
      return null;
    default:
      return "Speech recognition failed. Try again or type your message.";
  }
}

export function useSpeechRecognition() {
  const recRef = useRef(null);
  const handlersRef = useRef({});
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const start = useCallback((handlers) => {
    if (!SpeechRecognitionImpl) return;
    handlersRef.current = handlers || {};
    setError(null);

    const rec = new SpeechRecognitionImpl();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      handlersRef.current.onText?.(text.trim());
    };
    rec.onerror = (event) => setError(describeError(event.error));
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start the microphone. Try again.");
      recRef.current = null;
    }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { supported: Boolean(SpeechRecognitionImpl), listening, error, start, stop };
}
