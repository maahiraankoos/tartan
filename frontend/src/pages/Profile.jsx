import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Users, GitBranch } from "lucide-react";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { ChainSigil } from "@/components/ChainSigil";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { OGBadge, VerifiedBadge } from "@/components/Badges";
import { useApp } from "@/context/AppContext";
import { fmtNum, mediaUrl } from "@/lib/helpers";
import { auraFor } from "@/lib/aura";
import api from "@/lib/api";

export default function Profile() {
  const { shareToken } = useParams();
  const { t } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/profile/${shareToken}`).then(({ data }) => setData(data)).catch(() => setError(true));
  }, [shareToken]);

  if (error) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400">
          <p>Profile not found.</p>
          <Link to="/" className="text-cyan-300 mt-3 inline-block">{t("back_home")}</Link>
        </div>
      </>
    );
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" size={30} /></div>;
  }

  const { member: m, tartan, verified_organizer } = data;
  const aura = auraFor(tartan?.token || shareToken);

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-6 text-center relative overflow-hidden"
          style={{ borderColor: aura.palette.primary + "40", background: `linear-gradient(160deg, ${aura.palette.primary}12, #070B14 55%, ${aura.palette.secondary}12)` }}
          data-testid="profile-card"
        >
          <div className="absolute -right-8 -top-8 opacity-30"><ChainSigil seed={tartan?.token || shareToken} size={140} /></div>
          <div className="relative flex flex-col items-center gap-3">
            <Avatar name={m.nickname} src={mediaUrl(m.avatar_url)} size={76} ring />
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h1 className="font-unbounded font-black text-2xl text-white">{m.nickname}</h1>
                {verified_organizer && m.is_initiator && <VerifiedBadge verified />}
              </div>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <OGBadge sparkNumber={m.spark_number} />
                {m.is_initiator && <span className="text-[10px] uppercase tracking-widest text-amber-300">{t("founder")}</span>}
                <span className="font-mono text-xs text-slate-400">Spark #{m.spark_number ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-6">
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <div className="font-mono text-xl font-bold" style={{ color: aura.palette.primary }}><AnimatedNumber value={m.downstream_count} /></div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("downstream")}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <div className="font-mono text-xl font-bold text-emerald-300"><AnimatedNumber value={m.direct_count} /></div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("direct_joins")}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-slate-800 py-3">
              <div className="font-mono text-xl font-bold text-amber-300">#{m.rank}</div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("your_rank")}</div>
            </div>
          </div>

          {tartan && (
            <Link
              to={`/t/${tartan.token}`}
              data-testid="profile-view-chain"
              className="relative mt-6 w-full h-12 rounded-full font-unbounded font-bold text-slate-950 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: `linear-gradient(90deg, ${aura.palette.primary}, ${aura.palette.secondary})` }}
            >
              <GitBranch size={17} /> {tartan.title}
              <ArrowRight size={16} />
            </Link>
          )}
        </motion.div>
      </main>
    </>
  );
}
