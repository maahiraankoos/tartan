import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Users, TrendingUp, MapPin, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { TrustBadges } from "@/components/TrustBadges";
import { JoinModal } from "@/components/JoinModal";
import { JoinReveal } from "@/components/JoinReveal";
import { ChainSigil } from "@/components/ChainSigil";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useApp, saveMembership, getMembership } from "@/context/AppContext";
import { useTartanStream } from "@/hooks/useTartanStream";
import { mediaUrl } from "@/lib/helpers";
import api from "@/lib/api";
import { toast } from "sonner";

export default function InviteLanding() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const { t } = useApp();
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reveal, setReveal] = useState(null);
  const { stats: liveStats } = useTartanStream(ctx?.tartan?.token);

  useEffect(() => {
    api
      .get(`/share/${shareToken}`)
      .then(({ data }) => {
        setCtx(data);
        const existing = getMembership(data.tartan.token);
        if (existing) navigate(`/me/${existing}`, { replace: true });
      })
      .catch(() => setError(true));
  }, [shareToken, navigate]);

  const doJoin = async (form) => {
    setJoining(true);
    try {
      const { data } = await api.post(`/tartans/${ctx.tartan.token}/join`, {
        ...form,
        parent_share_token: shareToken,
        idempotency_key: crypto.randomUUID(),
      });
      saveMembership(ctx.tartan.token, data.member.share_token);
      setJoinOpen(false);
      setReveal({
        sparkNumber: data.member.spark_number,
        chainName: ctx.tartan.title,
        chainSeed: ctx.tartan.token,
        city: data.member.city,
        shareToken: data.member.share_token,
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not join");
    } finally {
      setJoining(false);
    }
  };

  if (error) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400">
          <p>Invite link not found.</p>
          <Link to="/" className="text-cyan-300 mt-3 inline-block">{t("back_home")}</Link>
        </div>
      </>
    );
  }

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={30} />
      </div>
    );
  }

  const { inviter, tartan, stats } = ctx;
  const s = liveStats || stats;

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-[#0E1526] via-[#070B14] to-[#12233b] p-6 text-center animate-float-up">
          <div className="flex flex-col items-center gap-3">
            <Avatar name={inviter.nickname} src={mediaUrl(inviter.avatar_url)} size={68} ring testid="inviter-avatar" />
            <p className="text-slate-300" data-testid="invite-headline">
              <span className="font-display font-bold text-cyan-300 text-glow-cyan text-lg">{inviter.nickname}</span>
              <br />
              {t("sent_you")}
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-white/5 border border-slate-700/60 p-4 flex items-center gap-3 text-left">
            <div className="shrink-0"><ChainSigil seed={tartan.token} size={54} /></div>
            <div className="min-w-0">
              <h1 className="font-unbounded font-bold text-lg text-white leading-tight">{tartan.title}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{tartan.goal}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <Users size={15} className="mx-auto text-cyan-400 mb-1" />
              <div className="font-mono font-bold text-cyan-300"><AnimatedNumber value={s.verified_members} /></div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("live_reach")}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <TrendingUp size={15} className="mx-auto text-emerald-400 mb-1" />
              <div className="font-mono font-bold text-emerald-300"><AnimatedNumber value={s.velocity_1h} /></div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("velocity")}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <MapPin size={15} className="mx-auto text-amber-400 mb-1" />
              <div className="font-mono font-bold text-amber-300"><AnimatedNumber value={s.active_cities} /></div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("active_cities")}</div>
            </div>
          </div>

          <button
            data-testid="join-chain-cta-button"
            onClick={() => setJoinOpen(true)}
            className="w-full mt-6 h-14 rounded-full font-display font-bold text-lg text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center justify-center gap-2 hover:shadow-[0_0_32px_rgba(0,240,255,0.6)] transition-shadow"
          >
            {t("join_cta")} <ArrowRight size={20} />
          </button>

          <div className="mt-4 flex justify-center">
            <TrustBadges />
          </div>

          <Link
            to={`/t/${tartan.token}`}
            className="inline-block mt-4 text-xs text-slate-500 hover:text-cyan-300"
            data-testid="view-full-chain-link"
          >
            {t("view_chain")} →
          </Link>
        </div>
      </main>

      <JoinModal
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoin={doJoin}
        loading={joining}
        inviterName={inviter.nickname}
        inviterAvatar={mediaUrl(inviter.avatar_url)}
      />

      <JoinReveal
        open={!!reveal}
        {...(reveal || {})}
        onContinue={() => { const st = reveal.shareToken; setReveal(null); navigate(`/me/${st}`); }}
      />
    </>
  );
}
