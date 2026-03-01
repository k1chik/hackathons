import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, ChevronRight, Clock } from "lucide-react";
import type { FleetSummary, FleetUnit } from "../lib/api";
import { getFleet, conditionBadge, conditionColor, timeAgo } from "../lib/api";

const EMPTY_FLEET: FleetSummary = {
  total: 0, critical: 0, poor: 0, fair: 0, good: 0, immediateActionRequired: 0, units: [],
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [fleet, setFleet] = useState<FleetSummary>(EMPTY_FLEET);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filterCondition, setFilterCondition] = useState<"ALL" | "CRITICAL" | "POOR" | "FAIR" | "GOOD">("ALL");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getFleet();
      setFleet(data);
    } catch {
      // keep existing state on error
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const criticalUnits = fleet.units.filter(
    (u) => u.overallCondition === "CRITICAL" || u.immediateAction
  );
  const otherUnits = fleet.units.filter(
    (u) => u.overallCondition !== "CRITICAL" && !u.immediateAction
  );
  const filteredUnits = filterCondition === "ALL" ? fleet.units : fleet.units.filter(u => u.overallCondition === filterCondition);

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Fleet Overview</h1>
          <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
            <Clock size={11} />
            Updated {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={refresh}
          className={`w-10 h-10 bg-cat-dark rounded-xl flex items-center justify-center border border-white/10 ${
            loading ? "animate-spin-slow" : ""
          }`}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Fleet Health Score */}
      {fleet.total > 0 && (() => {
        const weightedSum = fleet.units.reduce((sum, u) => {
          const w = u.overallCondition === "CRITICAL" ? 2 : 1;
          return sum + u.conditionScore * w;
        }, 0);
        const totalWeight = fleet.units.reduce((sum, u) => sum + (u.overallCondition === "CRITICAL" ? 2 : 1), 0);
        const score = Math.round((weightedSum / totalWeight) * 10);
        const color = score >= 70 ? "text-status-good" : score >= 40 ? "text-status-fair" : "text-status-critical";
        const label = score >= 70 ? "Good Standing" : score >= 40 ? "Needs Monitoring" : "Requires Attention";
        const attention = fleet.poor + fleet.critical;
        return (
          <div className="card flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-0.5">Fleet Health</p>
              <p className={`text-5xl font-black ${color}`}>{score}</p>
              <p className={`text-xs font-semibold mt-1 ${color}`}>{label}</p>
              {attention > 0 && (
                <p className="text-xs text-white/40 mt-0.5">{attention} unit{attention !== 1 ? "s" : ""} need attention</p>
              )}
            </div>
            <div className="flex-shrink-0">
              <svg viewBox="0 0 80 80" width="80" height="80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={score >= 70 ? "#34C759" : score >= 40 ? "#FF9F0A" : "#FF3B30"}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - score / 100)}`}
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="45" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.35)" fontFamily="system-ui">out of 100</text>
              </svg>
            </div>
          </div>
        );
      })()}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard
          value={fleet.good}
          label="Good"
          color="text-status-good"
          bg="bg-status-good/10"
        />
        <StatCard
          value={fleet.fair}
          label="Fair"
          color="text-status-fair"
          bg="bg-status-fair/10"
        />
        <StatCard
          value={fleet.poor}
          label="Poor"
          color="text-status-poor"
          bg="bg-status-poor/10"
        />
        <StatCard
          value={fleet.critical}
          label="Critical"
          color="text-status-critical"
          bg="bg-status-critical/10"
        />
      </div>

      {/* Fleet health bar */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">
            Fleet Health
          </p>
          <p className="text-xs text-white/40">{fleet.total} units</p>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-status-good rounded-l-full"
            style={{ width: `${(fleet.good / fleet.total) * 100}%` }}
          />
          <div
            className="h-full bg-status-fair"
            style={{ width: `${(fleet.fair / fleet.total) * 100}%` }}
          />
          <div
            className="h-full bg-status-poor"
            style={{ width: `${(fleet.poor / fleet.total) * 100}%` }}
          />
          <div
            className="h-full bg-status-critical rounded-r-full"
            style={{ width: `${(fleet.critical / fleet.total) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/30">
          <span>Needs Attention: {fleet.poor + fleet.critical}</span>
          <span>
            {Math.round((fleet.good / fleet.total) * 100)}% healthy
          </span>
        </div>
      </div>

      {/* Filter chips */}
      {fleet.total > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["ALL", "CRITICAL", "POOR", "FAIR", "GOOD"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterCondition(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                filterCondition === f
                  ? "bg-cat-yellow text-cat-black border-cat-yellow"
                  : "bg-transparent text-white/50 border-white/15 hover:border-white/30"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Alerts section — hidden when filter active */}
      {filterCondition === "ALL" && false &&
        false // kept for structure
      }
      {/* Alerts section */}
      {criticalUnits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-status-critical" />
            <h2 className="font-bold text-sm uppercase tracking-wider text-status-critical">
              Requires Attention
            </h2>
          </div>
          {criticalUnits.map((unit) => (
            <UnitCard
              key={unit.equipmentId}
              unit={unit}
              onClick={() => navigate(`/history/${unit.equipmentId}`)}
            />
          ))}
        </div>
      )}

      {/* Units list — filtered */}
      <div className="space-y-3">
        <h2 className="font-bold text-sm uppercase tracking-wider text-white/60">
          {filterCondition === "ALL" ? "All Units" : `${filterCondition} Units`}
        </h2>
        {fleet.total === 0 && !loading ? (
          <div className="card text-center py-10 space-y-2">
            <p className="text-white/40 text-sm">No inspections yet</p>
            <p className="text-white/25 text-xs">Start an inspection to see your fleet here</p>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-white/40 text-sm">No {filterCondition.toLowerCase()} units</p>
          </div>
        ) : (
          filteredUnits.map((unit) => (
            <UnitCard
              key={unit.equipmentId}
              unit={unit}
              onClick={() => navigate(`/history/${unit.equipmentId}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
  bg,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-3 flex flex-col items-center gap-0.5`}>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
      <span className="text-white/50 text-xs">{label}</span>
    </div>
  );
}

function UnitCard({
  unit,
  onClick,
}: {
  unit: FleetUnit;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full card flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
    >
      {/* Score */}
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
        <span
          className={`text-xl font-black ${conditionColor(unit.overallCondition)}`}
        >
          {unit.conditionScore}
        </span>
        <span className="text-[10px] text-white/40">/10</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{unit.equipmentId}</span>
          {unit.immediateAction && (
            <span className="w-2 h-2 bg-status-critical rounded-full animate-pulse flex-shrink-0" />
          )}
        </div>
        <p className="text-white/50 text-xs">{unit.equipmentType}</p>
        <p className="text-white/40 text-xs mt-0.5 truncate">
          {timeAgo(unit.lastInspection)}
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {unit.previousConditionScore !== undefined && (
          <span className={`text-base font-bold ${
            unit.conditionScore > unit.previousConditionScore
              ? "text-status-good"
              : unit.conditionScore < unit.previousConditionScore
              ? "text-status-critical"
              : "text-white/30"
          }`}>
            {unit.conditionScore > unit.previousConditionScore ? "↑" : unit.conditionScore < unit.previousConditionScore ? "↓" : "→"}
          </span>
        )}
        <span
          className={`status-badge ${conditionBadge(unit.overallCondition)}`}
        >
          {unit.overallCondition}
        </span>
        <ChevronRight size={14} className="text-white/20" />
      </div>
    </button>
  );
}
