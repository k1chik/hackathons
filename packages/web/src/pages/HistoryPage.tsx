import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { getEquipmentHistory, conditionBadge, conditionColor } from "../lib/api";
import type { InspectionResult, Finding } from "../lib/api";
import ProtectedImage from "../components/ProtectedImage";

interface MemoryEntry {
  id: string;
  content: string;
  metadata?: {
    equipmentId?: string;
    equipmentType?: string;
    timestamp?: string;
    overallCondition?: string;
    conditionScore?: string;
    immediateAction?: string;
    photoUrl?: string;
  };
}

function parseMemoryEntry(entry: MemoryEntry): InspectionResult {
  const content = entry.content;
  const meta = entry.metadata ?? {};

  const section = (tag: string, next: string) => {
    const re = new RegExp(`### ${tag}:\\n([\\s\\S]*?)(?=\\n### ${next}|$)`);
    const m = content.match(re);
    return m ? m[1].trim() : "";
  };

  const summary = section("Summary", "Recommendations");
  const recsText = section("Recommendations", "Inspector Notes");
  const findingsText = section("Findings", "Summary");

  const recommendations = recsText
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());

  const findings: Finding[] = findingsText
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .flatMap((l) => {
      const m = l
        .slice(2)
        .match(/^(.+?)\s+\((LOW|MEDIUM|HIGH|CRITICAL)\):\s+([\s\S]+?)(?:\s+\[Progression:\s+(.+?)\])?$/);
      if (!m) return [];
      return [{
        component: m[1],
        severity: m[2] as Finding["severity"],
        description: m[3],
        ...(m[4] ? { progression: m[4] } : {}),
      }];
    });

  return {
    equipmentId: meta.equipmentId ?? "",
    timestamp: meta.timestamp ?? new Date().toISOString(),
    overallCondition: (meta.overallCondition as InspectionResult["overallCondition"]) ?? "FAIR",
    conditionScore: parseInt(meta.conditionScore ?? "5"),
    findings,
    historicalContext: [],
    recommendations,
    immediateAction: meta.immediateAction === "true",
    summary,
    inspectorNotes: undefined,
    photoUrl: meta.photoUrl,
  };
}

function TrendGraph({ entries, scores }: { entries: MemoryEntry[]; scores: number[] }) {
  const W = 280;
  const H = 100;
  const PAD = { top: 12, right: 16, bottom: 28, left: 24 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const n = scores.length;
  const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;

  const x = (i: number) => PAD.left + (n > 1 ? i * xStep : chartW / 2);
  const y = (s: number) => PAD.top + chartH - (s / 10) * chartH;

  const pointColor = (s: number) =>
    s >= 7 ? "#34C759" : s >= 5 ? "#FF9F0A" : s >= 3 ? "#FF6B00" : "#FF3B30";

  const polyline = scores.map((s, i) => `${x(i)},${y(s)}`).join(" ");

  const dates = entries
    .filter((e) => e.metadata?.timestamp)
    .map((e) =>
      new Date(e.metadata!.timestamp!).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[2, 5, 8].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={y(v)}
            x2={W - PAD.right} y2={y(v)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          />
          <text x={PAD.left - 4} y={y(v) + 4} textAnchor="end"
            fontSize="8" fill="rgba(255,255,255,0.3)">{v}</text>
        </g>
      ))}

      {n > 1 && (
        <polyline
          points={`${x(0)},${PAD.top + chartH} ${polyline} ${x(n - 1)},${PAD.top + chartH}`}
          fill="rgba(255,205,0,0.08)" stroke="none"
        />
      )}

      {n > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="#FFCD00"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {scores.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s)} r="5" fill={pointColor(s)} stroke="#1a1a1a" strokeWidth="2" />
          <text
            x={x(i)} y={H - 4}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="8" fill="rgba(255,255,255,0.35)"
          >
            {dates[i] || ""}
          </text>
          <text x={x(i)} y={y(s) - 9} textAnchor="middle"
            fontSize="9" fontWeight="bold" fill={pointColor(s)}>{s}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HistoryPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!equipmentId) return;

    async function load() {
      setLoading(true);
      try {
        const data = await getEquipmentHistory(equipmentId!);
        const inspections = (data.inspections as MemoryEntry[]) || [];
        const sortByDate = (a: MemoryEntry, b: MemoryEntry) =>
          new Date(a.metadata?.timestamp || 0).getTime() - new Date(b.metadata?.timestamp || 0).getTime();
        setEntries(inspections.sort(sortByDate));
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [equipmentId]);

  const scores = entries
    .filter((e) => e.metadata?.conditionScore)
    .map((e) => parseInt(e.metadata!.conditionScore!));

  const trend =
    scores.length >= 2
      ? scores[scores.length - 1] > scores[0]
        ? "up"
        : scores[scores.length - 1] < scores[0]
        ? "down"
        : "flat"
      : "flat";

  const latestCondition = entries[entries.length - 1]?.metadata?.overallCondition || "GOOD";

  const handleDownloadReport = (entry: MemoryEntry) => {
    const result = parseMemoryEntry(entry);
    localStorage.setItem("sensill_last_inspection", JSON.stringify(result));
    navigate("/report");
  };

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-white/50">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black">{equipmentId}</h1>
          <p className="text-white/40 text-xs">
            {entries[0]?.metadata?.equipmentType || "Equipment"}
          </p>
        </div>
        <span className={`status-badge ${conditionBadge(latestCondition)}`}>
          {latestCondition}
        </span>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Trend summary */}
        {scores.length >= 2 && (
          <div className="card flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                trend === "up"
                  ? "bg-status-good/20"
                  : trend === "down"
                  ? "bg-status-poor/20"
                  : "bg-white/10"
              }`}
            >
              {trend === "up" ? (
                <TrendingUp size={24} className="text-status-good" />
              ) : trend === "down" ? (
                <TrendingDown size={24} className="text-status-poor" />
              ) : (
                <Minus size={24} className="text-white/40" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {trend === "up"
                  ? "Improving"
                  : trend === "down"
                  ? "Deteriorating"
                  : "Stable"}
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                Score: {scores[0]}/10 → {scores[scores.length - 1]}/10 over{" "}
                {scores.length} inspections
              </p>
            </div>
          </div>
        )}

        {/* Score trend graph */}
        {scores.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-bold text-xs uppercase tracking-wider text-white/60">
              Condition Trend
            </h2>
            <TrendGraph entries={entries} scores={scores} />
          </div>
        )}

        {/* Inspection timeline */}
        <div className="space-y-3">
          <h2 className="font-bold text-xs uppercase tracking-wider text-white/60">
            Inspection History
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-cat-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="card text-center py-8 space-y-2">
              <p className="text-4xl">📋</p>
              <p className="text-white/60 text-sm">No inspection history yet</p>
              <button
                onClick={() => navigate("/inspect")}
                className="btn-primary mt-2 inline-flex items-center gap-2"
              >
                <Camera size={16} />
                Start First Inspection
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-white/10" />

              <div className="space-y-4">
                {[...entries].reverse().map((entry) => {
                  const condition = entry.metadata?.overallCondition || "GOOD";
                  const score = parseInt(entry.metadata?.conditionScore || "5");
                  const ts = entry.metadata?.timestamp;
                  const date = ts
                    ? new Date(ts).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown date";

                  return (
                    <div key={entry.id} className="flex gap-4">
                      {/* Timeline dot */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center z-10 relative ${
                            condition === "CRITICAL"
                              ? "bg-status-critical/20 border-2 border-status-critical"
                              : condition === "POOR"
                              ? "bg-status-poor/20 border-2 border-status-poor"
                              : condition === "FAIR"
                              ? "bg-status-fair/20 border-2 border-status-fair"
                              : "bg-status-good/20 border-2 border-status-good"
                          }`}
                        >
                          <span className={`text-xs font-black ${conditionColor(condition)}`}>
                            {score}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-cat-dark rounded-2xl mb-2 border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="w-full p-4 flex items-center justify-between gap-2 text-left"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold">{date}</p>
                              <span className={`status-badge ${conditionBadge(condition)}`}>
                                {condition}
                              </span>
                            </div>
                            {entry.metadata?.immediateAction === "true" && (
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-status-critical rounded-full" />
                                <span className="text-xs text-status-critical font-semibold">
                                  Immediate action required
                                </span>
                              </div>
                            )}
                          </div>
                          {expandedId === entry.id
                            ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" />
                            : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />
                          }
                        </button>

                        {expandedId === entry.id && (
                          <div className="border-t border-white/5">
                            {entry.metadata?.photoUrl && (
                              <ProtectedImage
                                photoUrl={entry.metadata.photoUrl}
                                alt="Inspection photo"
                                className="w-full h-48 object-cover"
                              />
                            )}
                            <div className="px-4 pb-4 pt-3 space-y-3">
                              <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                                {entry.content
                                  .replace(/## Inspection Record.*\n/, "")
                                  .replace(/Equipment ID:.*\n/, "")
                                  .trim()}
                              </pre>
                              <button
                                onClick={() => handleDownloadReport(entry)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/8 transition-colors active:scale-95"
                              >
                                <FileDown size={14} />
                                Download Report
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Inspect again CTA */}
        <button
          onClick={() => navigate("/inspect")}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Camera size={18} />
          Inspect {equipmentId}
        </button>
      </div>
    </div>
  );
}
