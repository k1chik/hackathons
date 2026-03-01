import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../lib/api";
export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await loginUser(email, password);
      setAuth(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
        <h1 className="text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-white/40 mb-6">Access your org's inspection history</p>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cat-yellow/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-cat-yellow text-cat-black font-semibold active:scale-95 transition-transform disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-white/40 text-center mt-4">
          <Link to="/forgot-password" className="hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-sm text-white/40 text-center mt-2">
          New org?{" "}
          <Link to="/signup" className="text-cat-yellow hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
