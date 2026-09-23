import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Zap, LogIn } from "lucide-react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dest = loc.state?.from || "/studio";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      nav(u.role === "admin" ? "/admin" : dest, { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-300 border border-cyan-500/30 rounded-full px-3 py-1 bg-cyan-500/10 mb-4">
              <LogIn size={12} /> WELCOME BACK
            </div>
            <h1 className="font-unbounded text-4xl font-black text-white">Sign in</h1>
            <p className="text-slate-400 mt-2 text-sm">Manage your chains, track reach and grow the movement.</p>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0E1526] p-6" data-testid="login-form">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email</Label>
              <Input data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-slate-900/70 border-slate-700 text-white h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Password</Label>
              <Input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-slate-900/70 border-slate-700 text-white h-11" required />
            </div>
            {error && <p className="text-sm text-rose-400" data-testid="login-error">{error}</p>}
            <button type="submit" data-testid="login-submit-button" disabled={loading}
              className="w-full h-12 rounded-full font-unbounded font-bold text-slate-950 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-[0.97] transition-transform disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-5">
            New here?{" "}
            <Link to="/register" data-testid="go-register-link" className="text-cyan-300 font-semibold hover:text-cyan-200">Create an account</Link>
          </p>
        </motion.div>
      </main>
    </>
  );
}
