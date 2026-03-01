import { useState, useRef, useCallback } from "react";

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  lang?: string;
}

interface UseSpeechRecognitionReturn {
  listening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = false;
    recognition.lang = options.lang ?? "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const text = event.results[0][0].transcript.trim();
      onResultRef.current(text);
    };

    recognition.start();
  }, [supported, options.continuous, options.lang]);

  const stop = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
