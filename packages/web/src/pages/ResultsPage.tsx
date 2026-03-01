import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Share2,
  History,
  Zap,
  FileDown,
  Copy,
  ClipboardCheck,
} from "lucide-react";
import type { InspectionResult, Finding, HistoricalMatch } from "../lib/api";
import {
  conditionBadge,
  conditionColor,
} from "../lib/api";

function conditionHex(condition: string): string {
  switch (condition) {
    case "GOOD": return "#34C759";
    case "FAIR": return "#FF9F0A";
    case "POOR": return "#FF6B00";
    case "CRITICAL": return "#FF3B30";
    default: return "#FFCD00";
  }
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [expandedFindings, setExpandedFindings] = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(true);
  const [expandedSummary, setExpandedSummary] = useState(true);
  const [expandedRecs, setExpandedRecs] = useState(true);
  const [displayScore, setDisplayScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const scoreRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sensill_last_inspection");
    if (stored) {
      const parsed = JSON.parse(stored);
      setResult(parsed);
      // Count-up animation — 1.5s total
      let current = 0;
      const target = parsed.conditionScore;
      const totalSteps = 30;
      const intervalMs = 1500 / totalSteps;
      scoreRef.current = setInterval(() => {
        current += 1;
        const eased = Math.round((current / totalSteps) * target);
        setDisplayScore(eased);
        if (current >= totalSteps) {
          setDisplayScore(target);
          clearInterval(scoreRef.current!);
        }
      }, intervalMs);
    } else {
      navigate("/");
    }
    return () => { if (scoreRef.current) clearInterval(scoreRef.current); };
  }, [navigate]);

  if (!result) return null;

  const date = new Date(result.timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleShare = async () => {
    const text = `Sensill Inspection Report
Equipment: ${result.equipmentId}
Condition: ${result.overallCondition} (${result.conditionScore}/10)
${result.immediateAction ? "⚠️ IMMEDIATE ACTION REQUIRED" : ""}
${result.summary}`;

    if (navigator.share) {
      await navigator.share({ title: "Inspection Report", text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };


  const handleCopy = async () => {
    const lines = [
      `Sensill Inspection Report`,
      `Equipment: ${result.equipmentId}`,
      `Condition: ${result.overallCondition} (${result.conditionScore}/10)`,
      result.immediateAction ? "⚠️ IMMEDIATE ACTION REQUIRED" : "",
      "",
      result.summary,
      "",
      "Findings:",
      ...result.findings.map(f => `  [${f.severity}] ${f.component}: ${f.description}`),
      "",
      "Recommendations:",
      ...result.recommendations.map((r, i) => `  ${i + 1}. ${r}`),
    ].filter(l => l !== undefined);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-6">
      {/* Header bar */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/50 text-sm"
        >
          <ArrowLeft size={16} />
          Home
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-white/50 text-sm font-semibold"
          >
            {copied ? <ClipboardCheck size={16} className="text-status-good" /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-cat-yellow text-sm font-semibold"
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Equipment header */}
        <motion.div
          className="flex items-start justify-between gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
              Inspection Report
            </p>
            <h1 className="text-2xl font-black tracking-tight">
              {result.equipmentId}
            </h1>
            <p className="text-white/35 text-xs mt-1 flex items-center gap-1">
              <Clock size={11} />
              {date}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.3 }}
            >
              <ScoreRing score={displayScore} condition={result.overallCondition} />
            </motion.div>
            <motion.span
              className={`status-badge mt-2 ${conditionBadge(result.overallCondition)}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.4 }}
            >
              {result.overallCondition}
            </motion.span>
          </div>
        </motion.div>

        {/* Immediate action alert */}
        {result.immediateAction && (
          <motion.div
            className="bg-status-critical/10 border border-status-critical/25 rounded-2xl p-4 flex items-start gap-3"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2.0, duration: 0.5 }}
          >
            <AlertTriangle
              size={20}
              className="text-status-critical flex-shrink-0 mt-0.5 animate-pulse"
            />
            <div>
              <p className="text-status-critical font-bold text-sm">
                Immediate Action Required
              </p>
              <p className="text-white/60 text-xs mt-1">
                This equipment requires attention within 24 hours.
              </p>
            </div>
          </motion.div>
        )}

        {/* Summary */}
        <div className="card space-y-3">
          <button
            onClick={() => setExpandedSummary(!expandedSummary)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-cat-yellow" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">
                AI Summary
              </h2>
            </div>
            {expandedSummary ? (
              <ChevronUp size={16} className="text-white/30" />
            ) : (
              <ChevronDown size={16} className="text-white/30" />
            )}
          </button>
          {expandedSummary && (
            <div className="space-y-2">
              <p className="text-white/80 text-sm leading-relaxed">{result.summary}</p>
              {result.inspectorNotes && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-white/35 text-xs uppercase tracking-wider mb-1">
                    Inspector Notes
                  </p>
                  <p className="text-white/60 text-sm">{result.inspectorNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Historical context — the magic feature */}
        {result.historicalContext.length > 0 && (
          <motion.div
            className="card space-y-3"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 0.5 }}
          >
            <button
              onClick={() => setExpandedHistory(!expandedHistory)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <History size={14} className="text-cat-yellow" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">
                  Memory Insights
                </h2>
                <span className="bg-cat-yellow/15 text-cat-yellow text-xs font-bold px-2 py-0.5 rounded-full">
                  {result.historicalContext.length}
                </span>
              </div>
              {expandedHistory ? (
                <ChevronUp size={16} className="text-white/30" />
              ) : (
                <ChevronDown size={16} className="text-white/30" />
              )}
            </button>

            <AnimatePresence>
              {expandedHistory && (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {result.historicalContext.map((ctx, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <HistoryCard ctx={ctx} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Findings */}
        <div className="card space-y-3">
          <button
            onClick={() => setExpandedFindings(!expandedFindings)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">
                Findings
              </h2>
              <span className="bg-white/8 text-white/50 text-xs font-bold px-2 py-0.5 rounded-full">
                {result.findings.length}
              </span>
            </div>
            {expandedFindings ? (
              <ChevronUp size={16} className="text-white/30" />
            ) : (
              <ChevronDown size={16} className="text-white/30" />
            )}
          </button>

          {expandedFindings && (
            <div className="space-y-3">
              {result.findings.map((finding, i) => (
                <FindingCard key={i} finding={finding} />
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="card space-y-3">
          <button
            onClick={() => setExpandedRecs(!expandedRecs)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">
                Recommendations
              </h2>
              <span className="bg-white/8 text-white/50 text-xs font-bold px-2 py-0.5 rounded-full">
                {result.recommendations.length}
              </span>
            </div>
            {expandedRecs ? (
              <ChevronUp size={16} className="text-white/30" />
            ) : (
              <ChevronDown size={16} className="text-white/30" />
            )}
          </button>
          {expandedRecs && (
            <div className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-cat-yellow/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cat-yellow text-xs font-bold">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(`/history/${result.equipmentId}`)}
            className="btn-secondary flex items-center justify-center gap-2 text-sm"
          >
            <History size={16} />
            Full History
          </button>
          <button
            onClick={() => navigate("/inspect")}
            className="btn-primary flex items-center justify-center gap-2 text-sm"
          >
            New Inspection
          </button>
        </div>
        <button
          onClick={() => navigate("/report")}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <FileDown size={16} />
          Download Report
        </button>
      </div>
    </div>
  );
}

function ScoreRing({ score, condition }: { score: number; condition: string }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 10);
  const hex = conditionHex(condition);
  return (
    <svg viewBox="0 0 88 88" width="80" height="80">
      <circle
        cx="44" cy="44" r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="5"
      />
      <circle
        cx="44" cy="44" r={r}
        fill="none"
        stroke={hex}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <text
        x="44" y="40"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fill={hex}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {score}
      </text>
      <text
        x="44" y="54"
        textAnchor="middle"
        fontSize="10"
        fill="rgba(255,255,255,0.35)"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        /10
      </text>
    </svg>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const dotColor: Record<string, string> = {
    LOW: "#34C759",
    MEDIUM: "#FF9F0A",
    HIGH: "#FF6B00",
    CRITICAL: "#FF3B30",
  };
  const color = dotColor[finding.severity] ?? "#ffffff";

  return (
    <div className="bg-white/4 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-sm">{finding.component}</span>
        </div>
        <span className="text-xs text-white/35 uppercase tracking-wider font-medium">
          {finding.severity}
        </span>
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{finding.description}</p>
      {finding.progression && (
        <div className="flex items-center gap-2 mt-1">
          <div className="h-px flex-1 bg-white/8" />
          <p className="text-cat-yellow text-xs font-medium">
            ↗ {finding.progression}
          </p>
          <div className="h-px flex-1 bg-white/8" />
        </div>
      )}
    </div>
  );
}

function HistoryCard({ ctx }: { ctx: HistoricalMatch }) {
  const isPattern = ctx.type === "PATTERN_MATCH";

  return (
    <div
      className={`rounded-xl p-3 space-y-1.5 border-l-2 bg-white/3 ${
        isPattern
          ? "border-cat-yellow"
          : "border-status-good"
      }`}
    >
      <div className="flex items-center gap-2">
        {isPattern ? (
          <AlertTriangle size={14} className="text-cat-yellow flex-shrink-0" />
        ) : (
          <CheckCircle size={14} className="text-status-good flex-shrink-0" />
        )}
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            isPattern ? "text-cat-yellow" : "text-status-good"
          }`}
        >
          {isPattern ? "Pattern Match" : "Progression Detected"}
        </span>
      </div>
      <p className="text-white/70 text-xs leading-relaxed">{ctx.description}</p>
      {(ctx.referenceUnit || ctx.referenceDate) && (
        <div className="flex items-center gap-2 text-xs text-white/35 mt-1">
          {ctx.referenceUnit && (
            <span className="bg-white/8 px-2 py-0.5 rounded-full">
              Ref: {ctx.referenceUnit}
            </span>
          )}
          {ctx.referenceDate && <span>{ctx.referenceDate}</span>}
        </div>
      )}
    </div>
  );
}
