import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

interface Props {
  onResult: (text: string) => void;
  /** Optional transform applied to transcript before calling onResult */
  transform?: (text: string) => string;
  className?: string;
  title?: string;
}

export default function MicButton({ onResult, transform, className, title }: Props) {
  const { listening, supported, start, stop } = useSpeechRecognition((text) => {
    onResult(transform ? transform(text) : text);
  });

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? "Stop listening" : (title ?? "Speak to fill this field")}
      className={`flex items-center justify-center rounded-2xl transition-all active:scale-95 ${
        listening
          ? "bg-status-critical/20 border border-status-critical/50 text-status-critical animate-pulse"
          : "bg-cat-dark border border-white/10 text-white/40 hover:text-cat-yellow hover:border-cat-yellow/40"
      } ${className ?? "w-12 h-12"}`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
