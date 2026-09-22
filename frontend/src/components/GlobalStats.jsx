import React from "react";
import { Users, GitBranch, MapPin, TrendingUp } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid }) => (
  <div
    data-testid={testid}
    className={`relative overflow-hidden rounded-2xl border p-4 bg-[#0E1526] ${accent}`}
  >
    <Icon size={18} className="opacity-80 mb-2" />
    <div className="font-mono text-2xl sm:text-3xl font-bold tracking-wide">
      <AnimatedNumber value={value} />
    </div>
    <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">{label}</div>
    {sub != null && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

export const GlobalStats = ({ stats }) => {
  const { t } = useApp();
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="global-stats">
      <StatCard
        icon={Users}
        label={t("live_reach")}
        value={stats.verified_members}
        sub={`${stats.total_members} ${t("total_reach").toLowerCase()}`}
        accent="border-cyan-500/30 text-cyan-300 neon-cyan"
        testid="stat-verified-reach"
      />
      <StatCard
        icon={TrendingUp}
        label={t("velocity")}
        value={stats.velocity_1h}
        sub={`${stats.velocity_24h} / 24h`}
        accent="border-emerald-500/30 text-emerald-300"
        testid="stat-velocity"
      />
      <StatCard
        icon={MapPin}
        label={t("active_cities")}
        value={stats.active_cities}
        accent="border-amber-500/30 text-amber-300"
        testid="stat-active-cities"
      />
      <StatCard
        icon={GitBranch}
        label={t("depth")}
        value={stats.max_depth}
        accent="border-fuchsia-500/30 text-fuchsia-300"
        testid="stat-max-depth"
      />
    </div>
  );
};
