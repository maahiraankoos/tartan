import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Zap, User, Building2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [type, setType] = useState("creator");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await register({
        email: email.trim(), password, name: name.trim() || null,
        account_type: type, org_name: type === "company" ? orgName.trim() || null : null,
      });
      nav(u.role === "admin" ? "/admin" : "/studio", { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const TypeBtn = ({ value, icon: Icon, title, sub }) => (
    <button type="button" data-testid={`account-type-${value}`} onClick={() => setType(value)}
      className={`flex-1 rounded-2xl border p-4 text-left transition-all ${type === value ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"}`}>
      <Icon size={20} className={type === value ? "text-cyan-300" : "text-slate-400"} />
      <div className="font-semibold text-white mt-2 text-sm">{title}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </button>
  );

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 bg-emerald-500/10 mb-4">
              <Zap size={12} /> START BUILDING
            </div>
            <h1 className="font-unbounded text-4xl font-black text-white">Create account</h1>
            <p className="text-slate-400 mt-2 text-sm">Launch chains, own the analytics, and reach further.</p>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0E1526] p-6" data-testid="register-form">
            <div className="flex gap-3">
              <TypeBtn value="creator" icon={User} title="Creator" sub="Personal campaigns" />
              <TypeBtn value="company" icon={Building2} title="Company" sub="Brand & teams" />
            </div>

            {type === "company" && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">Company / brand name</Label>
                <Input data-testid="register-org-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." className="bg-slate-900/70 border-slate-700 text-white h-11" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-slate-300">{type === "company" ? "Contact name" : "Your name"}</Label>
              <Input data-testid="register-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amina" className="bg-slate-900/70 border-slate-700 text-white h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email</Label>
              <Input data-testid="register-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-slate-900/70 border-slate-700 text-white h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Password</Label>
              <Input data-testid="register-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="bg-slate-900/70 border-slate-700 text-white h-11" required />
            </div>
            {error && <p className="text-sm text-rose-400" data-testid="register-error">{error}</p>}
            <button type="submit" data-testid="register-submit-button" disabled={loading}
              className="w-full h-12 rounded-full font-unbounded font-bold text-slate-950 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-[0.97] transition-transform disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-5">
            Already have an account?{" "}
            <Link to="/login" data-testid="go-login-link" className="text-cyan-300 font-semibold hover:text-cyan-200">Sign in</Link>
          </p>
        </motion.div>
      </main>
    </>
  );
}
