import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Camera, BarChart3, LogOut, Copy, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { isOnline } from "../lib/connectivity";
import { syncPendingInspections } from "../lib/syncManager";
import { getOrgInviteCode } from "../lib/api";
import PendingBanner from "./PendingBanner";
import VoiceCommandButton from "./VoiceCommandButton";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orgName, logout } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Auto-sync pending inspections when network returns or app becomes visible
  useEffect(() => {
    const trySync = async () => {
      if (await isOnline()) syncPendingInspections();
    };
    const onVisible = () => { if (document.visibilityState === "visible") trySync(); };
    window.addEventListener("online", trySync);
    document.addEventListener("visibilitychange", onVisible);
    trySync(); // also sync on mount
    return () => {
      window.removeEventListener("online", trySync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const showNav = !location.pathname.startsWith("/results");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleOrgClick() {
    setShowInvite(true);
    if (!inviteCode) {
      try {
        const data = await getOrgInviteCode();
        setInviteCode(data.inviteCode);
      } catch {
        setInviteCode("ERROR");
      }
    }
  }

  async function handleCopy() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col bg-cat-black max-w-md mx-auto relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-cat-yellow rounded-lg flex items-center justify-center flex-shrink-0">
            {/* Sensill caterpillar logo */}
            <svg viewBox="0 0 20 20" width="16" height="16">
              <path d="M9 7.5 Q7 4.5 5.5 2" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M13 7.5 Q15 4.5 16.5 2" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <circle cx="5.5" cy="1.5" r="1.8" fill="#080808" />
              <circle cx="16.5" cy="1.5" r="1.8" fill="#080808" />
              <circle cx="6" cy="17" r="2.5" fill="#080808" />
              <circle cx="8" cy="14" r="3" fill="#080808" />
              <circle cx="11" cy="10" r="3.5" fill="#080808" />
              <circle cx="9.5" cy="9" r="1.2" fill="#FFCD00" />
              <circle cx="12.2" cy="9" r="1.2" fill="#FFCD00" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">Sensill</span>
        </div>

        {/* Org name + logout */}
        <div className="flex items-center gap-2">
          {orgName && (
            <button
              onClick={handleOrgClick}
              className="text-xs text-white/35 hover:text-white/60 truncate max-w-[120px] transition-colors"
            >
              {orgName}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors touch-manipulation"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Invite code overlay */}
      {showInvite && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-6">
          <div className="w-full max-w-xs bg-cat-dark border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">Team Invite Code</p>
              <button
                onClick={() => setShowInvite(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              Share this code with teammates so they can join <span className="text-white/70 font-medium">{orgName}</span> on the signup page.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              {inviteCode && inviteCode !== "ERROR" ? (
                <span className="font-mono text-xl font-bold tracking-widest text-cat-yellow">
                  {inviteCode}
                </span>
              ) : inviteCode === "ERROR" ? (
                <span className="text-status-critical text-sm">Failed to load</span>
              ) : (
                <span className="text-white/30 text-sm">Loading...</span>
              )}
              {inviteCode && inviteCode !== "ERROR" && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-cat-yellow active:scale-95 transition-transform"
                >
                  <Copy size={14} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent offline queue banner */}
      <div className="px-4 pt-3">
        <PendingBanner />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      <VoiceCommandButton />

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-cat-dark/95 backdrop-blur-lg border-t border-white/8 pb-safe">
          <div className="flex items-center justify-around px-4 py-3">
            <NavItem
              icon={<Home size={22} />}
              label="Home"
              active={isActive("/")}
              onClick={() => navigate("/")}
            />
            <div className="relative -mt-6">
              <button
                onClick={() => navigate("/inspect")}
                className="w-16 h-16 bg-cat-yellow rounded-full flex items-center justify-center shadow-lg shadow-cat-yellow/20 active:scale-95 transition-transform"
              >
                <Camera size={26} className="text-cat-black" />
              </button>
            </div>
            <NavItem
              icon={<BarChart3 size={22} />}
              label="Fleet"
              active={isActive("/dashboard")}
              onClick={() => navigate("/dashboard")}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors touch-manipulation ${
        active ? "text-cat-yellow" : "text-white/35"
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
