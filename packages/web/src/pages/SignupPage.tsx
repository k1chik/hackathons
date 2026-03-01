import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signupUser, joinOrg } from "../lib/api";

type Mode = "create" | "join";

export default function SignupPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("create");
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { token } = mode === "create"
        ? await signupUser(email, password, orgName)
        : await joinOrg(email, password, inviteCode);
      setAuth(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cat-black flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-cat-yellow rounded-xl flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" width="20" height="20">
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
        <span className="font-bold text-2xl tracking-tight">Sensill</span>
      </div>

      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">
          {mode === "create" ? "Create your org" : "Join an org"}
        </h1>
        <p className="text-sm text-white/40 mb-4">
          {mode === "create"
            ? "One account for your entire team"
            : "Enter the invite code your teammate shared"}
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("create"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === "create" ? "bg-cat-yellow text-cat-black" : "text-white/50"
            }`}
          >
            Create org
          </button>
          <button
            type="button"
            onClick={() => { setMode("join"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === "join" ? "bg-cat-yellow text-cat-black" : "text-white/50"
            }`}
          >
            Join org
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "create" ? (
            <div>
              <label className="text-sm text-white/50 mb-1.5 block">Company name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoComplete="organization"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cat-yellow/50 transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-white/50 mb-1.5 block">Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono tracking-widest focus:outline-none focus:border-cat-yellow/50 transition-colors"
              />
              <p className="text-xs text-white/30 mt-1.5">8-character code from your team admin</p>
            </div>
          )}

          <div>
            <label className="text-sm text-white/50 mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cat-yellow/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 mb-1.5 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-cat-yellow/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 mb-1.5 block">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white focus:outline-none transition-colors ${
                confirmPassword && password !== confirmPassword
                  ? "border-red-500/50 focus:border-red-500/70"
                  : "border-white/10 focus:border-cat-yellow/50"
              }`}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (!!confirmPassword && password !== confirmPassword)}
            className="w-full py-3 rounded-xl bg-cat-yellow text-cat-black font-semibold active:scale-95 transition-transform disabled:opacity-50 mt-2"
          >
            {loading
              ? mode === "create" ? "Creating account..." : "Joining org..."
              : mode === "create" ? "Create account" : "Join org"}
          </button>
        </form>

        <p className="text-sm text-white/40 text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-cat-yellow hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
