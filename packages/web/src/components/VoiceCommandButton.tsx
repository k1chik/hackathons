import { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

interface Toast {
  text: string;
  type: "action" | "error";
}

// Normalise spoken equipment IDs: "336 EX 001" → "336-EX-001"
function toEquipmentId(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, "-");
}

function matchesAny(transcript: string, patterns: string[]): boolean {
  return patterns.some((p) => transcript.includes(p));
}

export default function VoiceCommandButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<Toast | null>(null);

  // Hide on /report (print layout) and /login /signup
  const hidden = ["/report", "/login", "/signup", "/forgot-password", "/reset-password"].some(
    (p) => location.pathname.startsWith(p)
  );

  const showToast = (text: string, type: Toast["type"] = "action") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCommand = (transcript: string) => {
    const t = transcript.toLowerCase();

    // ── Navigation commands ────────────────────────────────────
    if (matchesAny(t, ["go home", "open home", "home page"])) {
      showToast("Going home");
      navigate("/");
      return;
    }
    if (matchesAny(t, ["start inspection", "new inspection", "open inspect", "take photo", "inspect"])) {
      showToast("Starting inspection");
      navigate("/inspect");
      return;
    }
    if (matchesAny(t, ["scan qr", "scan code", "scan equipment", "qr code"])) {
      showToast("Opening QR scanner");
      navigate("/inspect?scan=true");
      return;
    }
    if (matchesAny(t, ["fleet", "dashboard", "view fleet", "open dashboard"])) {
      showToast("Opening fleet");
      navigate("/dashboard");
      return;
    }

    // ── Form commands (dispatched to InspectPage) ──────────────
    if (matchesAny(t, ["submit", "analyze", "analyze equipment", "done", "finish"])) {
      showToast("Submitting inspection");
      window.dispatchEvent(new Event("sensill:voice-submit"));
      return;
    }

    // "equipment 336 EX 001" or "set equipment 336-EX-001"
    const equipmentMatch = t.match(/(?:equipment|set equipment|id|equipment id)[:\s]+(.+)/);
    if (equipmentMatch) {
      const id = toEquipmentId(equipmentMatch[1]);
      showToast(`Equipment: ${id}`);
      window.dispatchEvent(new CustomEvent("sensill:voice-equipment", { detail: { id } }));
      return;
    }

    // Unrecognised
    showToast(`"${transcript}" — not recognised`, "error");
  };

  const { listening, supported, start, stop } = useSpeechRecognition(handleCommand);

  // Keyboard shortcut: Space bar when not focused on an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        listening ? stop() : start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, start, stop]);

  if (!supported || hidden) return null;

  return (
    <>
      {/* Toast feedback */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all ${
            toast.type === "error"
              ? "bg-status-critical/20 border border-status-critical/40 text-status-critical"
              : "bg-cat-yellow/15 border border-cat-yellow/40 text-cat-yellow"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Floating mic button */}
      <button
        type="button"
        onClick={listening ? stop : start}
        title="Voice command (or press Space)"
        className={`fixed bottom-28 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          listening
            ? "bg-status-critical text-white animate-pulse shadow-status-critical/40"
            : "bg-cat-surface border border-white/10 text-white/50 hover:text-cat-yellow hover:border-cat-yellow/30 shadow-black/40"
        }`}
      >
        {listening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
    </>
  );
}
