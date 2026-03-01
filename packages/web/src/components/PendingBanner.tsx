import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { getPendingCount } from "../lib/offlineQueue";
import { syncPendingInspections } from "../lib/syncManager";
import { isOnline } from "../lib/connectivity";

export default function PendingBanner() {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    const n = await getPendingCount();
    setCount(n);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("sensill:queue-updated", refresh);
    return () => window.removeEventListener("sensill:queue-updated", refresh);
  }, []);

  if (count === 0) return null;

  const handleSyncNow = async () => {
    if (!(await isOnline())) return;
    setSyncing(true);
    await syncPendingInspections();
    await refresh();
    setSyncing(false);
  };

  return (
    <div className="bg-status-fair/10 border border-status-fair/30 rounded-2xl p-4 flex items-center gap-3">
      <WifiOff size={18} className="text-status-fair flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-status-fair font-semibold text-sm">
          {count} inspection{count !== 1 ? "s" : ""} pending
        </p>
        <p className="text-white/50 text-xs mt-0.5">
          Will submit automatically when online
        </p>
      </div>
      <button
        onClick={handleSyncNow}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs font-semibold text-cat-yellow active:scale-95 transition-transform disabled:opacity-50"
      >
        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing..." : "Submit now"}
      </button>
    </div>
  );
}
