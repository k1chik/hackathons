import { useState, FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "../lib/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-cat-black flex flex-col items-center justify-center px-6">
        <p className="text-white/50 text-sm">Invalid reset link.</p>
        <Link to="/forgot-password" className="text-cat-yellow text-sm mt-3 hover:underline">Request a new one</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cat-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">New password</h1>
        <p className="text-sm text-white/40 mb-6">Choose a new password for your account.</p>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-white/50 mb-1.5 block">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cat-yellow/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-white/50 mb-1.5 block">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cat-yellow/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-cat-yellow text-cat-black font-semibold active:scale-95 transition-transform disabled:opacity-50 mt-2"
          >
            {loading ? "Saving..." : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
