import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, BarChart3, ArrowRight, Users, Sparkles, Star, Flame, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { StartTartanDialog } from "@/components/StartTartanDialog";
import { ChainSigil } from "@/components/ChainSigil";
import { CATEGORY_MAP } from "@/lib/categories";
import { useAuth } from "@/context/AuthContext";
import { auraFor } from "@/lib/aura";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Studio() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tartans, setTartans] = useState(null);

  const load = useCallback(() => {
    api.get("/my/tartans").then(({ data }) => setTartans(data)).catch(() => setTartans([]));
  }, []);

  useEffect(() => {
    if (user === false) nav("/login", { state: { from: "/studio" } });
    if (user) load();
  }, [user, nav, load]);

  const requestFeature = async (token) => {
    try {
      await api.post(`/tartans/${token}/feature-request`);
      toast.success("Feature request sent — our team will review it.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not send request");
    }
  };

  if (!user || tartans === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={30} />
      </div>
    );
  }

  const totalReach = tartans.reduce((a, x) => a + (x.verified_members || 0), 0);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80">Creator studio</div>
            <h1 className="font-unbounded text-3xl sm:text-4xl font-black text-white">
              {user.org_name || user.name || "Your chains"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">{fmtNum(totalReach)} people reached across {tartans.length} chain{tartans.length === 1 ? "" : "s"}.</p>
          </div>
          <StartTartanDialog onCreated={load} trigger={
            <button data-testid="studio-new-chain" className="flex items-center gap-2 h-12 px-5 rounded-full font-unbounded font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-[0.97] transition-transform">
              <Plus size={18} /> New chain
            </button>
          } />
        </div>

        {tartans.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-10 text-center" data-testid="studio-empty">
            <Sparkles size={30} className="text-cyan-400 mx-auto mb-3" />
            <p className="text-white font-semibold">No chains yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-5">Launch your first Tartan and watch it travel.</p>
            <StartTartanDialog onCreated={load} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tartans.map((tt) => {
              const aura = auraFor(tt.token);
              const cat = CATEGORY_MAP[tt.category];
              return (
                <motion.div key={tt.token} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  data-testid={`studio-tartan-${tt.token}`}
                  className="rounded-2xl border p-5 relative overflow-hidden"
                  style={{ borderColor: aura.palette.primary + "40", background: `linear-gradient(140deg, ${aura.palette.primary}0d, #0B101D 55%, ${aura.palette.secondary}0d)` }}>
                  <div className="absolute -right-5 -top-5 opacity-25"><ChainSigil seed={tt.token} size={90} /></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1.5">
                      {tt.featured && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-400"><Flame size={11} /> Featured</span>}
                      {cat && <span className="text-[10px] uppercase tracking-widest text-slate-400">{cat.emoji} {cat.label}</span>}
                    </div>
                    <h3 className="font-unbounded font-bold text-white leading-snug max-w-[80%]">{tt.title}</h3>
                    {tt.target && <p className="text-xs text-slate-400 mt-1 max-w-[85%]">🎯 {tt.target}</p>}
                    <div className="flex items-center gap-2 text-sm mt-3">
                      <Users size={15} style={{ color: aura.palette.primary }} />
                      <span className="font-mono font-bold" style={{ color: aura.palette.primary }}>{fmtNum(tt.verified_members)}</span>
                      <span className="text-slate-500 text-xs">reached</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/10">
                      <Link to={`/dashboard/${tt.initiator_share_token}`} data-testid={`studio-analytics-${tt.token}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/40 rounded-full px-3 py-1.5 hover:bg-cyan-500/10">
                        <BarChart3 size={13} /> Analytics
                      </Link>
                      <Link to={`/me/${tt.initiator_share_token}`} data-testid={`studio-manage-${tt.token}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border border-slate-600 rounded-full px-3 py-1.5 hover:border-slate-400">
                        Manage <ArrowRight size={13} />
                      </Link>
                      {tt.featured ? (
                        <span className="ml-auto text-[11px] text-amber-400 font-semibold">★ Live on home</span>
                      ) : tt.feature_requested ? (
                        <span className="ml-auto text-[11px] text-amber-300/70">Feature pending review</span>
                      ) : (
                        <button data-testid={`studio-feature-${tt.token}`} onClick={() => requestFeature(tt.token)}
                          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200">
                          <Star size={12} /> Get featured
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm"><Star size={15} /> Featured placement</div>
          <p className="text-slate-400 text-sm mt-1">Want your chain on the home page and top of its category? Request featuring on any chain — our team reviews requests. Payment is arranged directly for now.</p>
        </div>
      </main>
    </>
  );
}
