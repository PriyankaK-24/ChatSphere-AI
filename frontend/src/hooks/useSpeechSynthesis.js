import { useCallback, useEffect, useRef, useState } from "react";
import { splitIntoChunks, toSpeakableText } from "../utils/speechText";

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
const supported = Boolean(synth) && typeof SpeechSynthesisUtterance !== "undefined";

export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState(null);
  const [paused, setPaused] = useState(false);
  // Incremented on every speak/stop so late events from old utterances are ignored.
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    if (!supported) return;
    tokenRef.current += 1;
    synth.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, []);

  const speak = useCallback((id, markdown) => {
    if (!supported) return;
    synth.cancel();
    tokenRef.current += 1;
    const token = tokenRef.current;
    const chunks = splitIntoChunks(toSpeakableText(markdown));
    if (!chunks.length) return;

    setSpeakingId(id);
    setPaused(false);
    const finish = () => {
      if (tokenRef.current === token) {
        setSpeakingId(null);
        setPaused(false);
      }
    };
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = navigator.language || "en-US";
      if (index === chunks.length - 1) utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") finish();
      };
      synth.speak(utterance);
    });
  }, []);

  const pause = useCallback(() => {
    if (!supported) return;
    synth.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!supported) return;
    synth.resume();
    setPaused(false);
  }, []);

  useEffect(() => () => synth?.cancel(), []);

  return { supported, speakingId, paused, speak, pause, resume, stop };
}
