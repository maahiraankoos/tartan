import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Flame, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { TrustBadges } from "@/components/TrustBadges";
import { StartTartanDialog } from "@/components/StartTartanDialog";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const TartanCard = ({ tartan, featured }) => {
  const { t } = useApp();
  return (
    <Link
      to={`/t/${tartan.token}`}
      data-testid={`tartan-card-${tartan.token}`}
      className={`group block rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${
        featured
          ? "border-cyan-500/40 bg-gradient-to-br from-[#0E1526] via-[#0B1120] to-[#12233b] neon-cyan"
          : "border-slate-700/60 bg-[#0E1526] hover:border-cyan-500/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {featured && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-400 mb-1.5">
              <Flame size={11} /> {t("featured")}
            </span>
          )}
          <h3 className="font-display font-bold text-lg text-white leading-snug">{tartan.title}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{tartan.goal}</p>
        </div>
        <Avatar name={tartan.initiator_nickname || tartan.title} size={40} ring={featured} />
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 text-sm">
          <Users size={15} className="text-cyan-400" />
          <span className="font-mono font-bold text-cyan-300">{fmtNum(tartan.verified_members)}</span>
          <span className="text-slate-500 text-xs">{t("members")}</span>
          {tartan.city && <span className="text-slate-600 text-xs">· {tartan.city}</span>}
        </div>
        <ArrowRight size={16} className="text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
};

export default function Home() {
  const { t } = useApp();
  const [tartans, setTartans] = useState(null);

  useEffect(() => {
    api.get("/tartans").then(({ data }) => setTartans(data)).catch(() => setTartans([]));
  }, []);

  const featured = tartans?.find((x) => x.featured);
  const rest = tartans?.filter((x) => !x.featured) || [];
  const totalReach = (tartans || []).reduce((a, x) => a + (x.verified_members || 0), 0);

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Hero */}
        <section className="relative rounded-3xl p-6 sm:p-10 mb-8 overflow-hidden border border-cyan-500/30 bg-gradient-to-br from-[#0E1526] via-[#070B14] to-[#12233b]">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 bg-emerald-500/10 mb-5">
              <Sparkles size={12} /> {t("brand_tag")}
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-white">
              Pass it on.{" "}
              <span className="text-cyan-400 text-glow-cyan">Watch it travel.</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg mt-4 leading-relaxed">
              {t("tagline")}
            </p>

            <div className="mt-6 mb-6">
              <TrustBadges />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StartTartanDialog />
              {featured && (
                <Link
                  to={`/t/${featured.token}`}
                  data-testid="hero-explore-featured"
                  className="flex items-center gap-2 h-11 px-5 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:shadow-[0_0_28px_rgba(0,240,255,0.5)] transition-shadow"
                >
                  {t("join_cta")} <ArrowRight size={17} />
                </Link>
              )}
            </div>

            <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
              <span className="font-mono text-2xl font-bold text-white">
                <AnimatedNumber value={totalReach} />
              </span>
              {t("people_reached")}
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </section>

        {/* Featured */}
        {featured && (
          <section className="mb-8">
            <TartanCard tartan={featured} featured />
          </section>
        )}

        {/* All chains */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{t("all_chains")}</h2>
            <StartTartanDialog
              trigger={
                <button
                  data-testid="start-tartan-secondary"
                  className="text-sm text-cyan-300 hover:text-cyan-200 font-semibold"
                >
                  + {t("start_your_own")}
                </button>
              }
            />
          </div>

          {tartans === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl bg-slate-800/40" />
              ))}
            </div>
          ) : rest.length === 0 ? (
            <p className="text-slate-500 text-center py-10">{t("no_chains")}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rest.map((x) => (
                <TartanCard key={x.token} tartan={x} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
