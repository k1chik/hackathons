import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, AlertTriangle, CheckCircle } from "lucide-react";
import type { InspectionResult } from "../lib/api";
import ProtectedImage from "../components/ProtectedImage";

const CONDITION_COLOR: Record<string, string> = {
  GOOD: "#16a34a",
  FAIR: "#ca8a04",
  POOR: "#ea580c",
  CRITICAL: "#dc2626",
};

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#ca8a04",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export default function ReportPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<InspectionResult | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sensill_last_inspection");
    if (stored) setResult(JSON.parse(stored));
    else navigate("/");
  }, [navigate]);

  if (!result) return null;

  const date = new Date(result.timestamp).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const photoSrc = result.photoUrl ?? null;

  const condColor = CONDITION_COLOR[result.overallCondition] ?? "#374151";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      {/* Screen-only action bar */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Results
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: "#FFCD00", color: "#1a1a1a" }}
        >
          <Printer size={15} /> Save as PDF
        </button>
      </div>

      {/* Report body — light theme for print */}
      <div className="bg-white text-gray-900 min-h-screen px-6 py-8 max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b-4 pb-6" style={{ borderColor: "#FFCD00" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                Sensill Inspection Report
              </p>
              <h1 className="text-3xl font-black tracking-tight">{result.equipmentId}</h1>
              <p className="text-gray-500 text-sm mt-1">{date}</p>
            </div>
            {/* Score badge */}
            <div
              className="flex-shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: condColor + "18", border: `2px solid ${condColor}` }}
            >
              <span className="text-3xl font-black" style={{ color: condColor }}>
                {result.conditionScore}
              </span>
              <span className="text-[10px] text-gray-400">/10</span>
              <span className="text-[10px] font-bold mt-0.5" style={{ color: condColor }}>
                {result.overallCondition}
              </span>
            </div>
          </div>

          {result.immediateAction && (
            <div
              className="mt-4 flex items-start gap-3 p-3 rounded-xl"
              style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5" }}
            >
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
              <div>
                <p className="font-bold text-sm" style={{ color: "#dc2626" }}>Immediate Action Required</p>
                <p className="text-xs text-gray-600 mt-0.5">This equipment requires attention within 24 hours.</p>
              </div>
            </div>
          )}
        </div>

        {/* Photo */}
        {photoSrc && (
          <div>
            <SectionTitle>Inspection Photo</SectionTitle>
            <ProtectedImage
              photoUrl={photoSrc}
              alt="Inspection"
              className="w-full rounded-xl object-cover"
              style={{ maxHeight: 320 }}
            />
          </div>
        )}

        {/* Summary */}
        <div>
          <SectionTitle>AI Summary</SectionTitle>
          <p className="text-gray-700 text-sm leading-relaxed">{result.summary}</p>
          {result.inspectorNotes && (
            <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Inspector Notes</p>
              <p className="text-gray-700 text-sm">{result.inspectorNotes}</p>
            </div>
          )}
        </div>

        {/* Findings */}
        <div>
          <SectionTitle>Findings ({result.findings.length})</SectionTitle>
          <div className="space-y-3">
            {result.findings.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{f.component}</span>
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      color: SEVERITY_COLOR[f.severity] ?? "#374151",
                      backgroundColor: (SEVERITY_COLOR[f.severity] ?? "#374151") + "18",
                    }}
                  >
                    {f.severity}
                  </span>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{f.description}</p>
                {f.progression && (
                  <p className="text-xs font-medium mt-2" style={{ color: "#ca8a04" }}>
                    ↗ {f.progression}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Memory Insights */}
        {result.historicalContext.length > 0 && (
          <div>
            <SectionTitle>Memory Insights</SectionTitle>
            <div className="space-y-3">
              {result.historicalContext.map((ctx, i) => {
                const isPattern = ctx.type === "PATTERN_MATCH";
                return (
                  <div
                    key={i}
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor: isPattern ? "#fefce8" : "#f0fdf4",
                      borderColor: isPattern ? "#fde047" : "#86efac",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isPattern
                        ? <AlertTriangle size={13} style={{ color: "#ca8a04" }} />
                        : <CheckCircle size={13} style={{ color: "#16a34a" }} />}
                      <span className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: isPattern ? "#ca8a04" : "#16a34a" }}>
                        {isPattern ? "Pattern Match" : "Progression Detected"}
                      </span>
                    </div>
                    <p className="text-gray-700 text-xs leading-relaxed">{ctx.description}</p>
                    {(ctx.referenceUnit || ctx.referenceDate) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {ctx.referenceUnit && `Ref: ${ctx.referenceUnit}`}
                        {ctx.referenceUnit && ctx.referenceDate && " · "}
                        {ctx.referenceDate}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div>
          <SectionTitle>Recommendations</SectionTitle>
          <ol className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: "#FFCD00", color: "#1a1a1a" }}
                >
                  {i + 1}
                </span>
                <p className="text-gray-700 text-sm leading-relaxed">{rec}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 flex justify-between">
          <span>Generated by Sensill</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 pb-1 border-b border-gray-100">
      {children}
    </h2>
  );
}
