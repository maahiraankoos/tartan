import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Trophy, ArrowRight, PartyPopper } from "lucide-react";
import { Header } from "@/components/Header";
import { SharePanel } from "@/components/SharePanel";
import { LineageView } from "@/components/LineageView";
import { ReportDialog } from "@/components/ReportDialog";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";

export default function MeDashboard() {
  const { shareToken } = useParams();
  const { t } = useApp();
  const [chain, setChain] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/members/${shareToken}/chain`);
      setChain(data);
    } catch (e) {
      setError(true);
    }
  }, [shareToken]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  if (error) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400">
          <p>Branch not found.</p>
          <Link to="/" className="text-cyan-300 mt-3 inline-block">{t("back_home")}</Link>
        </div>
      </>
    );
  }

  if (!chain) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={30} />
      </div>
    );
  }

  const { me, tartan, next_milestone, milestones_reached } = chain;
  const dc = me.downstream_count || 0;
  const prevMs = milestones_reached?.length ? milestones_reached[milestones_reached.length - 1] : 0;
  const progress = next_milestone ? Math.min(100, Math.round(((dc - prevMs) / (next_milestone - prevMs)) * 100)) : 100;

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {tartan && (
          <Link
            to={`/t/${tartan.token}`}
            data-testid="tartan-link"
            className="flex items-center justify-between rounded-2xl border border-slate-700/60 bg-[#0E1526] px-4 py-3 mb-5 hover:border-cyan-500/40 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-cyan-400/80">{tartan.featured ? t("featured") : t("view_chain")}</div>
              <div className="font-display font-bold text-white truncate">{tartan.title}</div>
            </div>
            <ArrowRight size={16} className="text-slate-500 shrink-0" />
          </Link>
        )}

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-5 flex items-center gap-3" data-testid="welcome-banner">
          <PartyPopper size={20} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-slate-300">{t("return_hint")}</p>
        </div>

        <SharePanel shareToken={shareToken} tartanTitle={tartan?.title} />

        {/* Milestone progress */}
        <div className="mt-5 rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5" data-testid="milestone-card">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Trophy size={16} className="text-amber-400" /> {t("next_milestone")}
            </span>
            {next_milestone ? (
              <span className="font-mono text-sm text-amber-300">
                {fmtNum(dc)} / {fmtNum(next_milestone)}
              </span>
            ) : (
              <span className="text-xs text-emerald-400">🎉</span>
            )}
          </div>
          <Progress value={progress} className="h-2 bg-slate-800" data-testid="milestone-progress" />
          {next_milestone && (
            <p className="text-xs text-slate-500 mt-2">
              {fmtNum(next_milestone - dc)} {t("to_go")}
            </p>
          )}
          {milestones_reached?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {milestones_reached.map((m) => (
                <span key={m} className="text-[10px] font-mono text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
                  ✓ {fmtNum(m)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Lineage */}
        <div className="mt-5">
          <h2 className="font-display text-lg font-bold text-white mb-3">{t("your_chain")}</h2>
          <LineageView chain={chain} />
        </div>

        <div className="mt-6 flex justify-end">
          {tartan && <ReportDialog tartanToken={tartan.token} />}
        </div>
      </main>
    </>
  );
}
