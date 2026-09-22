import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users, Flame, Zap } from "lucide-react";
import { Header } from "@/components/Header";
import { TrustBadges } from "@/components/TrustBadges";
import { StartTartanDialog } from "@/components/StartTartanDialog";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { LivingChainCanvas } from "@/components/LivingChainCanvas";
import { ChainSigil } from "@/components/ChainSigil";
import { useApp } from "@/context/AppContext";
import { useTartanStream } from "@/hooks/useTartanStream";
import { auraFor } from "@/lib/aura";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const container = { animate: { transition: { staggerChildren: 0.08 } } };
const item = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const ChainCard = ({ tartan, featured }) => {
  const { t } = useApp();
  const aura = auraFor(tartan.token);
  return (
    <motion.div variants={item}>
      <Link
        to={`/t/${tartan.token}`}
        data-testid={`tartan-card-${tartan.token}`}
        className="group block rounded-2xl border p-5 transition-all hover:-translate-y-1 relative overflow-hidden"
        style={{
          borderColor: aura.palette.primary + "40",
          background: `linear-gradient(140deg, ${aura.palette.primary}0d, #0B101D 55%, ${aura.palette.secondary}0d)`,
        }}
      >
        <div
          className="absolute -right-6 -top-6 opacity-30 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500"
          style={{ transformOrigin: "center" }}
        >
          <ChainSigil seed={tartan.token} size={110} />
        </div>
        <div className="relative">
          {featured && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-400 mb-1.5">
              <Flame size={11} /> {t("featured")}
            </span>
          )}
          <h3 className="font-unbounded font-bold text-lg text-white leading-snug max-w-[80%]">{tartan.title}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2 max-w-[85%]">{tartan.goal}</p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm">
              <Users size={15} style={{ color: aura.palette.primary }} />
              <span className="font-mono font-bold" style={{ color: aura.palette.primary }}>{fmtNum(tartan.verified_members)}</span>
              <span className="text-slate-500 text-xs">{t("members")}</span>
              {tartan.city && <span className="text-slate-600 text-xs">· {tartan.city}</span>}
            </div>
            <ArrowRight size={16} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default function Home() {
  const { t } = useApp();
  const [tartans, setTartans] = useState(null);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    api.get("/tartans").then(({ data }) => setTartans(data)).catch(() => setTartans([]));
  }, []);

  const featured = tartans?.find((x) => x.featured);
  const rest = tartans?.filter((x) => !x.featured) || [];
  const totalReach = (tartans || []).reduce((a, x) => a + (x.verified_members || 0), 0);

  useTartanStream(featured?.token, { onJoin: () => setBurstKey((k) => k + 1) });

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-5 sm:py-8">
        {/* Immersive living hero */}
        <section className="relative rounded-[28px] overflow-hidden border border-cyan-500/25 min-h-[560px] sm:min-h-[520px] flex items-center">
          <LivingChainCanvas burstKey={burstKey} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/40 to-transparent" />

          <motion.div
            variants={container}
            initial="initial"
            animate="animate"
            className="relative z-10 px-6 sm:px-10 py-10 max-w-2xl"
          >
            <motion.div variants={item} className="inline-flex items-center gap-2 text-xs font-mono text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 bg-emerald-500/10 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              LIVE · UPDATING NOW
            </motion.div>

            <motion.h1 variants={item} className="font-unbounded text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] text-white">
              One idea.<br />Passed hand to hand.
              <span className="block mt-2" style={{ color: "#00F0FF", textShadow: "0 0 34px rgba(0,240,255,0.5)" }}>
                See how far it goes.
              </span>
            </motion.h1>

            <motion.p variants={item} className="text-slate-300 text-base sm:text-lg mt-5 leading-relaxed max-w-lg">
              {t("tagline")} Share a link and watch it move from city to city, in real time.
            </motion.p>

            <motion.div variants={item} className="mt-7 flex flex-wrap items-center gap-3">
              {featured && (
                <Link
                  to={`/t/${featured.token}`}
                  data-testid="ignite-spark-hero-cta"
                  className="group relative flex items-center gap-2 h-14 px-7 rounded-full font-unbounded font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-[0.97] transition-transform overflow-hidden"
                >
                  <span className="absolute inset-0 bg-white/30 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Zap size={18} className="relative" /> <span className="relative">{t("join_cta")}</span>
                </Link>
              )}
              <StartTartanDialog />
            </motion.div>

            <motion.div variants={item} className="mt-6">
              <TrustBadges />
            </motion.div>

            <motion.div variants={item} className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="font-mono text-2xl font-extrabold text-white">
                <AnimatedNumber value={totalReach} />
              </span>
              {t("people_reached")} so far
            </motion.div>
          </motion.div>
        </section>

        {/* Featured */}
        {featured && (
          <motion.section variants={container} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-8">
            <ChainCard tartan={featured} featured />
          </motion.section>
        )}

        {/* All chains */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-unbounded text-xl sm:text-2xl font-bold text-white">{t("all_chains")}</h2>
            <StartTartanDialog
              trigger={
                <button data-testid="start-tartan-secondary" className="text-sm text-cyan-300 hover:text-cyan-200 font-semibold">
                  + {t("start_your_own")}
                </button>
              }
            />
          </div>

          {tartans === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl bg-slate-800/40" />)}
            </div>
          ) : rest.length === 0 ? (
            <p className="text-slate-500 text-center py-10">{t("no_chains")}</p>
          ) : (
            <motion.div variants={container} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rest.map((x) => <ChainCard key={x.token} tartan={x} />)}
            </motion.div>
          )}
        </section>
      </main>
    </>
  );
}
