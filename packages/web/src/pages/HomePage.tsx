import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock, ChevronRight, QrCode } from "lucide-react";
import { conditionBadge, conditionColor, timeAgo, getFleet } from "../lib/api";
import type { FleetUnit } from "../lib/api";
export default function HomePage() {
  const navigate = useNavigate();
  const [equipmentId, setEquipmentId] = useState("");
  const [recentUnits, setRecentUnits] = useState<FleetUnit[]>([]);
  const [allUnits, setAllUnits] = useState<FleetUnit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    getFleet().then((data) => {
      const sorted = [...data.units].sort(
        (a, b) => new Date(b.lastInspection).getTime() - new Date(a.lastInspection).getTime()
      );
      setAllUnits(data.units);
      setRecentUnits(sorted.slice(0, 3));
    }).catch(() => {});
  }, []);

  const suggestions = equipmentId.length > 0
    ? allUnits.filter(u => u.equipmentId.startsWith(equipmentId.trim().toUpperCase())).slice(0, 5)
    : [];

  const handleSearch = () => {
    if (equipmentId.trim()) {
      navigate(`/history/${encodeURIComponent(equipmentId.trim().toUpperCase())}`);
    }
  };
  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      {/* Hero section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">
          Equipment <span className="text-cat-yellow">Intelligence</span>
        </h1>
        <p className="text-white/50 text-sm">
          Every inspection makes the next one smarter.
        </p>
      </div>
      {/* Search by equipment ID */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="flex items-center gap-3 bg-cat-dark rounded-2xl px-4 py-3 border border-white/10">
              <Search size={18} className="text-white/40 flex-shrink-0" />
              <input
                type="text"
                value={equipmentId}
                onChange={(e) => { setEquipmentId(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-sm font-medium"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-cat-dark border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                {suggestions.map((u) => (
                  <button
                    key={u.equipmentId}
                    onMouseDown={() => { setEquipmentId(u.equipmentId); setShowSuggestions(false); navigate(`/history/${u.equipmentId}`); }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="font-medium">{u.equipmentId}</span>
                    <span className="text-white/40 text-xs">{u.overallCondition} · {u.conditionScore}/10</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!equipmentId.trim()}
            className="bg-cat-yellow text-cat-black font-bold px-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-40 touch-manipulation"
          >
            Go
          </button>
        </div>
        <button
          onClick={() => navigate("/inspect?scan=true")}
          className="w-full flex items-center justify-center gap-2 text-white/40 text-xs py-1"
        >
          <QrCode size={14} />
          Scan QR code instead
        </button>
      </div>
      {/* Start inspection CTA */}
      <button
        onClick={() => navigate("/inspect")}
        className="btn-primary w-full flex items-center justify-center gap-3"
      >
        <span className="text-2xl">📸</span>
        Start New Inspection
      </button>
      {/* Recent inspections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/60">
            Recent Inspections
          </h2>
          {recentUnits.length > 0 && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-cat-yellow text-xs font-semibold flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          )}
        </div>
        {recentUnits.length === 0 ? (
          <div className="card text-center py-8 space-y-1">
            <p className="text-white/40 text-sm">No inspections yet</p>
            <p className="text-white/25 text-xs">Tap the camera button to get started</p>
          </div>
        ) : (
          recentUnits.map((unit) => (
            <button
              key={unit.equipmentId}
              onClick={() => navigate(`/history/${unit.equipmentId}`)}
              className="w-full card flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                  unit.overallCondition === "CRITICAL"
                    ? "bg-status-critical/20"
                    : unit.overallCondition === "POOR"
                    ? "bg-status-poor/20"
                    : unit.overallCondition === "FAIR"
                    ? "bg-status-fair/20"
                    : "bg-status-good/20"
                }`}
              >
                <span className={`text-xl font-black ${conditionColor(unit.overallCondition)}`}>
                  {unit.conditionScore}
                </span>
                <span className="text-[10px] text-white/40">/10</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{unit.equipmentId}</span>
                  {unit.immediateAction && (
                    <span className="w-2 h-2 bg-status-critical rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-white/50 text-xs mt-0.5">{unit.equipmentType}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`status-badge ${conditionBadge(unit.overallCondition)}`}>
                  {unit.overallCondition}
                </span>
                <div className="flex items-center gap-1 text-white/30 text-xs">
                  <Clock size={10} />
                  {timeAgo(unit.lastInspection)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
