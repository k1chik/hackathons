import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await forgotPassword(email).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-cat-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">Reset password</h1>
        <p className="text-sm text-white/40 mb-6">
          Enter your email and we'll send a reset link.
        </p>
        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-status-good/10 border border-status-good/20 text-status-good text-sm">
              If that email exists, a reset link has been sent.
            </div>
            <Link to="/login" className="block text-center text-sm text-cat-yellow hover:underline mt-4">
              Back to sign in
            </Link>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-cat-yellow text-cat-black font-semibold active:scale-95 transition-transform disabled:opacity-50 mt-2"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link to="/login" className="text-center text-sm text-white/40 hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
