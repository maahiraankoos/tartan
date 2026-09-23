import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Trophy, ArrowRight, PartyPopper, Camera, BarChart3, Crown } from "lucide-react";
import { Header } from "@/components/Header";
import { SharePanel } from "@/components/SharePanel";
import { LineageView } from "@/components/LineageView";
import { ReportDialog } from "@/components/ReportDialog";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PersonalRipple } from "@/components/PersonalRipple";
import { RipplePoster } from "@/components/RipplePoster";
import { NotificationsFeed } from "@/components/NotificationsFeed";
import { StreakBadge, OGBadge } from "@/components/Badges";
import { ChainSigil } from "@/components/ChainSigil";
import { Avatar } from "@/components/Avatar";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/context/AppContext";
import { useTartanStream } from "@/hooks/useTartanStream";
import { fmtNum, mediaUrl } from "@/lib/helpers";
import { auraFor } from "@/lib/aura";
import api from "@/lib/api";
import { toast } from "sonner";

export default function MeDashboard() {
  const { shareToken } = useParams();
  const { t } = useApp();
  const [chain, setChain] = useState(null);
  const [error, setError] = useState(false);
  const [msOpen, setMsOpen] = useState(false);
  const [celebrateMs, setCelebrateMs] = useState(null);
  const [recap, setRecap] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/members/${shareToken}/chain`);
      setChain(data);
      api.get(`/members/${shareToken}/recap`).then(({ data }) => setRecap(data)).catch(() => {});
    } catch (e) {
      setError(true);
    }
  }, [shareToken]);

  useEffect(() => {
    load();
  }, [load]);

  // live: re-fetch on any join in this tartan
  useTartanStream(chain?.tartan?.token, { onJoin: () => load() });

  // milestone detection
  useEffect(() => {
    if (!chain) return;
    const reached = chain.milestones_reached || [];
    if (!reached.length) return;
    const top = reached[reached.length - 1];
    const key = `tartan_ms_${shareToken}`;
    const raw = localStorage.getItem(key);
    if (raw === null) {
      localStorage.setItem(key, String(top));
      return;
    }
    if (top > parseInt(raw, 10)) {
      localStorage.setItem(key, String(top));
      setCelebrateMs(top);
      setMsOpen(true);
    }
  }, [chain, shareToken]);

  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/members/${shareToken}/avatar`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Photo updated");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not update photo");
    }
  };

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

  const { me, tartan, next_milestone, milestones_reached, rank, total_in_chain, percentile } = chain;
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

        {/* Profile row */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#0E1526] p-4 mb-5" data-testid="profile-row">
          <button onClick={() => fileRef.current?.click()} className="relative shrink-0" data-testid="change-avatar-button">
            <Avatar name={me.nickname} src={mediaUrl(me.avatar_url)} size={52} ring />
            <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-cyan-500 flex items-center justify-center border-2 border-[#0E1526]">
              <Camera size={12} className="text-slate-950" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={changeAvatar} className="hidden" data-testid="avatar-change-input" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-white truncate">{me.nickname}</span>
              {me.is_initiator && <Crown size={14} className="text-amber-400" />}
            </div>
            <div className="text-xs text-slate-400">{me.city} · {me.verified ? t("verified") : "unverified"}</div>
          </div>
          {me.is_initiator && (
            <Link
              to={`/dashboard/${shareToken}`}
              data-testid="organizer-dashboard-link"
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 border border-amber-500/40 rounded-full px-3 py-2 hover:bg-amber-500/10"
            >
              <BarChart3 size={14} /> {t("view_dashboard")}
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-5 flex items-center gap-3" data-testid="welcome-banner">
          <PartyPopper size={20} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-slate-300">{t("return_hint")}</p>
        </div>

        {/* Spark & spreader status */}
        {tartan && (
          <div
            className="rounded-2xl border p-4 mb-5 relative overflow-hidden"
            data-testid="spark-status"
            style={{
              borderColor: auraFor(tartan.token).palette.primary + "40",
              background: `linear-gradient(135deg, ${auraFor(tartan.token).palette.primary}12, #0B101D 60%, ${auraFor(tartan.token).palette.secondary}10)`,
            }}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0"><ChainSigil seed={tartan.token} size={60} /></div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Your spark</div>
                <div className="flex items-center gap-2">
                  <div className="font-unbounded text-3xl font-black text-white leading-none">#{me.spark_number ?? "—"}</div>
                  <OGBadge sparkNumber={me.spark_number} />
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-2xl font-extrabold" style={{ color: auraFor(tartan.token).palette.primary }} data-testid="spreader-rank">#{rank}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{t("your_rank")}</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Top {percentile}% of {fmtNum(total_in_chain)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10 flex-wrap">
              <StreakBadge streak={chain.streak} />
              {recap && recap.invited_this_week > 0 && (
                <span className="text-xs text-emerald-300 font-semibold border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2.5 py-1" data-testid="weekly-recap-chip">
                  +{fmtNum(recap.invited_this_week)} {t("invited_this_week")}
                </span>
              )}
              <Link to={`/p/${shareToken}`} data-testid="my-profile-link" className="ml-auto text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                {t("my_profile")} →
              </Link>
            </div>
          </div>
        )}

        <NotificationsFeed shareToken={shareToken} refreshKey={dc} />

        <div className="mt-5">
          <SharePanel shareToken={shareToken} tartanTitle={tartan?.title} />
        </div>

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
                <button
                  key={m}
                  onClick={() => { setCelebrateMs(m); setMsOpen(true); }}
                  data-testid={`milestone-badge-${m}`}
                  className="text-[10px] font-mono text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5 hover:bg-emerald-500/10"
                >
                  ✓ {fmtNum(m)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Personal ripple */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-unbounded text-lg font-bold text-white">{t("your_chain")}</h2>
            <RipplePoster chain={chain} shareToken={shareToken} />
          </div>
          <PersonalRipple chain={chain} />
        </div>

        {/* Lineage */}
        <div className="mt-5">
          <LineageView chain={chain} />
        </div>

        <div className="mt-6 flex justify-end">
          {tartan && <ReportDialog tartanToken={tartan.token} />}
        </div>
      </main>

      <MilestoneCard
        open={msOpen}
        onOpenChange={setMsOpen}
        milestone={celebrateMs}
        tartanTitle={tartan?.title}
        nickname={me.nickname}
      />
    </>
  );
}
