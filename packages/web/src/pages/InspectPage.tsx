import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Upload, X, ArrowLeft, ChevronDown, Loader2, WifiOff, QrCode, Mic, MicOff, Plus } from "lucide-react";
import QRScanner from "../components/QRScanner";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { submitInspection, fileToBase64, getFleet } from "../lib/api";
import type { FleetUnit } from "../lib/api";
import { isOnline } from "../lib/connectivity";
import { queueInspection } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";
const EQUIPMENT_TYPES = [
  "336 Excavator",
  "950M Wheel Loader",
  "D6 Dozer",
  "770 Off-Highway Truck",
  "120 Motor Grader",
  "420 Backhoe Loader",
  "308 Mini Excavator",
  "Hydraulic System",
  "Undercarriage",
  "Other",
];
export default function InspectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(() => searchParams.get("scan") === "true");
  const [notesEditing, setNotesEditing] = useState(false);
  const { listening: notesListening, supported: speechSupported, start: startNotes, stop: stopNotes } =
    useSpeechRecognition((text) => {
      setNotes((prev) => prev ? `${prev}. ${text}` : text);
    });
  const [equipmentType, setEquipmentType] = useState(EQUIPMENT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<FleetUnit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimer = () => {
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  };
  useEffect(() => () => stopTimer(), []);
  useEffect(() => {
    getFleet().then((data) => setFleet(data.units)).catch(() => {});
  }, []);

  // Voice command events dispatched by VoiceCommandButton
  useEffect(() => {
    const onSubmit = () => handleSubmit();
    const onEquipment = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      setEquipmentId(id);
    };
    window.addEventListener("sensill:voice-submit", onSubmit);
    window.addEventListener("sensill:voice-equipment", onEquipment);
    return () => {
      window.removeEventListener("sensill:voice-submit", onSubmit);
      window.removeEventListener("sensill:voice-equipment", onEquipment);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile, equipmentId, equipmentType, notes]);
  const LOADING_STEPS = [
    "Retrieving inspection history...",
    "Analyzing image...",
    "Saving inspection...",
  ];
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setError(null);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };
  const handleSubmit = async () => {
    if (!equipmentId.trim()) {
      setError("Equipment ID is required");
      return;
    }
    if (!imageFile) {
      setError("Please take or upload a photo");
      return;
    }
    setError(null);
    const { base64, mediaType } = await fileToBase64(imageFile);

    const online = await isOnline();
    if (!online) {
      await queueInspection({
        tenantId: user?.tenantId ?? "",
        equipmentId: equipmentId.trim().toUpperCase(),
        equipmentType,
        imageBase64: base64,
        mediaType,
        inspectorNotes: notes.trim() || undefined,
      });
      window.dispatchEvent(new Event("sensill:queue-updated"));
      setQueued(true);
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    startTimer();
    try {
      const result = await submitInspection(
        {
          equipmentId: equipmentId.trim().toUpperCase(),
          equipmentType,
          imageBase64: base64,
          mediaType,
          inspectorNotes: notes.trim() || undefined,
        },
        (step) => setLoadingStep(step)
      );
      stopTimer();
      localStorage.setItem("sensill_last_inspection", JSON.stringify(result));
      navigator.vibrate?.(200);
      navigate("/results");
    } catch (err) {
      stopTimer();
      setError(err instanceof Error ? err.message : "Inspection failed");
      setLoading(false);
    }
  };

  const suggestions = equipmentId.length > 0
    ? fleet.filter(u => u.equipmentId.startsWith(equipmentId.trim().toUpperCase())).slice(0, 5)
    : [];

  // Progress bar fills based on step + elapsed time within step
  const STEP_WEIGHTS = [0.15, 0.75, 0.1]; // history=15%, analysis=75%, save=10%
  const stepBase = STEP_WEIGHTS.slice(0, loadingStep).reduce((a, b) => a + b, 0);
  const stepWeight = STEP_WEIGHTS[loadingStep] ?? 0;
  // Within analysis step, use elapsed time (cap at 55s) to fill the step's share
  const withinStep = loadingStep === 1
    ? Math.min(elapsed / 55, 0.95)
    : 0.5;
  const progress = Math.min((stepBase + stepWeight * withinStep) * 100, 97);
  const ANALYSIS_HINTS = [
    "Comparing hydraulic wear patterns across fleet...",
    "Checking failure progression against historical data...",
    "Cross-referencing component wear signatures...",
    "Building structured inspection report...",
    "Evaluating maintenance urgency indicators...",
  ];
  const hint = ANALYSIS_HINTS[elapsed % ANALYSIS_HINTS.length];
  if (queued) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-status-fair/15 flex items-center justify-center">
          <WifiOff size={32} className="text-status-fair" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Saved for later</h2>
          <p className="text-white/50 text-sm max-w-xs">
            No connection right now. Your inspection is saved and will be submitted automatically when you're back online.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="btn-primary w-full max-w-xs"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 gap-6">
        {/* Spinner */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-cat-yellow/20 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-cat-yellow border-r-cat-yellow border-b-transparent border-l-transparent animate-spin" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
        </div>
        {/* Current step label */}
        <div className="text-center space-y-1">
          <p className="text-white/40 text-xs uppercase tracking-widest">Sensill</p>
          <p className="font-semibold text-base">{LOADING_STEPS[loadingStep]}</p>
          {loadingStep === 1 && (
            <motion.p
              key={hint}
              className="text-white/40 text-xs max-w-[220px] mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {hint}
            </motion.p>
          )}
        </div>
        {/* Progress bar */}
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-xs text-white/30">
            <span>{Math.round(progress)}%</span>
            {loadingStep === 1 && <span>{elapsed}s</span>}
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-cat-yellow rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
        {/* Step checklist */}
        <div className="w-full max-w-xs space-y-2">
          <AnimatePresence>
            {LOADING_STEPS.map((step, i) => (
              i <= loadingStep ? (
                <motion.div
                  key={step}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i < loadingStep ? "bg-cat-yellow" : "border-2 border-cat-yellow"
                  }`}>
                    {i < loadingStep && <span className="text-cat-black text-xs font-bold">✓</span>}
                    {i === loadingStep && <Loader2 size={12} className="text-cat-yellow animate-spin" />}
                  </div>
                  <span className={`text-sm ${i === loadingStep ? "text-white font-medium" : "text-white/50"}`}>
                    {step}
                  </span>
                </motion.div>
              ) : (
                <div key={step} className="flex items-center gap-3 opacity-20">
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 flex-shrink-0" />
                  <span className="text-sm text-white/50">{step}</span>
                </div>
              )
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {showQRScanner && (
        <QRScanner
          onDetected={(value) => { setEquipmentId(value); setShowQRScanner(false); }}
          onClose={() => setShowQRScanner(false)}
        />
      )}
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/50 text-sm"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">New Inspection</h1>
        <p className="text-white/50 text-sm">
          AI analysis with full history context
        </p>
      </div>
      {/* Equipment ID */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Equipment ID *
        </label>
        <div className="relative flex gap-2">
          <input
            type="text"
            value={equipmentId}
            onChange={(e) => { setEquipmentId(e.target.value.toUpperCase()); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => setShowSuggestions(true)}
            className="flex-1 bg-cat-dark text-white placeholder-white/30 rounded-2xl px-4 py-3.5 text-base font-medium border border-white/10 outline-none focus:border-cat-yellow/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowQRScanner(true)}
            className="bg-cat-dark border border-white/10 rounded-2xl px-3.5 flex items-center justify-center"
            title="Scan QR code"
          >
            <QrCode size={20} className="text-cat-yellow" />
          </button>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-cat-dark border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              {suggestions.map((u) => (
                <button
                  key={u.equipmentId}
                  onMouseDown={() => { setEquipmentId(u.equipmentId); setShowSuggestions(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition-colors text-left"
                >
                  <span className="font-medium">{u.equipmentId}</span>
                  <span className="text-white/40 text-xs">{u.overallCondition} · {u.conditionScore}/10</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Equipment Type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Equipment Type
        </label>
        <div className="relative">
          <button
            onClick={() => setShowTypes(!showTypes)}
            className="w-full bg-cat-dark text-white rounded-2xl px-4 py-3.5 text-base font-medium border border-white/10 flex items-center justify-between"
          >
            <span>{equipmentType}</span>
            <ChevronDown
              size={18}
              className={`text-white/40 transition-transform ${showTypes ? "rotate-180" : ""}`}
            />
          </button>
          {showTypes && (
            <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-cat-dark border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              {EQUIPMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setEquipmentType(type);
                    setShowTypes(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors ${
                    type === equipmentType ? "text-cat-yellow font-semibold" : "text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Photo capture */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Inspection Photo *
        </label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Inspection"
              className="w-full h-56 object-cover rounded-2xl"
            />
            <button
              onClick={() => {
                setImagePreview(null);
                setImageFile(null);
              }}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <X size={16} />
            </button>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1">
              <p className="text-xs text-white/80">Tap X to retake</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Camera capture */}
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.capture = "environment";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleImageSelect(file);
                };
                input.click();
              }}
              className="bg-cat-dark border-2 border-dashed border-white/20 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Camera size={28} className="text-cat-yellow" />
              <span className="text-sm font-medium text-white/80">Take Photo</span>
            </button>
            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-cat-dark border-2 border-dashed border-white/20 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Upload size={28} className="text-white/40" />
              <span className="text-sm font-medium text-white/60">Upload</span>
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      {/* Notes — voice first */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Inspector Notes (optional)
        </label>

        {notesEditing ? (
          /* Manual edit mode */
          <div className="relative">
            <textarea
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => setNotesEditing(false)}
              rows={4}
              placeholder="Type your observations..."
              className="w-full bg-cat-dark text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm border border-cat-yellow/40 outline-none resize-none"
            />
          </div>
        ) : notes ? (
          /* Notes filled — show text + actions */
          <div className="bg-cat-dark border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-white/80 text-sm leading-relaxed">{notes}</p>
            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
              {speechSupported && (
                <button
                  type="button"
                  onClick={notesListening ? stopNotes : startNotes}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                    notesListening
                      ? "bg-status-critical/20 text-status-critical border border-status-critical/40 animate-pulse"
                      : "bg-cat-yellow/10 text-cat-yellow border border-cat-yellow/20"
                  }`}
                >
                  {notesListening ? <MicOff size={13} /> : <Plus size={13} />}
                  {notesListening ? "Listening..." : "Add more"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotesEditing(true)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setNotes("")}
                className="ml-auto text-xs text-white/20 hover:text-status-critical/60 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          /* Empty — voice as primary CTA */
          <div className="space-y-2">
            {speechSupported ? (
              <button
                type="button"
                onClick={notesListening ? stopNotes : startNotes}
                className={`w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 transition-all active:scale-[0.98] ${
                  notesListening
                    ? "border-status-critical/60 bg-status-critical/5"
                    : "border-white/20 bg-cat-dark hover:border-cat-yellow/30"
                }`}
              >
                {notesListening ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-status-critical/20 flex items-center justify-center animate-pulse">
                      <MicOff size={22} className="text-status-critical" />
                    </div>
                    <span className="text-sm font-semibold text-status-critical">Listening… tap to stop</span>
                    <span className="text-xs text-white/40">Speak your observations</span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-cat-yellow/10 flex items-center justify-center">
                      <Mic size={22} className="text-cat-yellow" />
                    </div>
                    <span className="text-sm font-semibold text-white/70">Tap to dictate notes</span>
                    <span className="text-xs text-white/30">e.g. "crack on left track, fluid near boom"</span>
                  </>
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setNotesEditing(true)}
              className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-1"
            >
              or type manually
            </button>
          </div>
        )}
      </div>
      {/* Error */}
      {error && (
        <div className="bg-status-critical/10 border border-status-critical/30 rounded-2xl p-3 flex items-center gap-2">
          <X size={16} className="text-status-critical flex-shrink-0" />
          <p className="text-status-critical text-sm">{error}</p>
        </div>
      )}
      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!equipmentId.trim() || !imageFile}
        className="btn-primary w-full"
      >
        Analyze Equipment
      </button>
    </div>
  );
}
