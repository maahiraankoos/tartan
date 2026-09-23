import React from "react";
import { Crown, BadgeCheck, Flame, Award } from "lucide-react";
import { useApp } from "@/context/AppContext";

// "OG" founder badge for early sparks (spark_number <= 100)
export const OGBadge = ({ sparkNumber, className = "" }) => {
  if (!sparkNumber || sparkNumber > 100) return null;
  return (
    <span
      data-testid="og-badge"
      className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 border border-amber-400/50 bg-amber-400/10 rounded-full px-1.5 py-0.5 ${className}`}
      title={`Founding spark #${sparkNumber}`}
    >
      <Crown size={9} /> OG
    </span>
  );
};

// Verified organizer checkmark
export const VerifiedBadge = ({ verified, className = "" }) => {
  const { t } = useApp();
  if (!verified) return null;
  return (
    <span
      data-testid="verified-org-badge"
      className={`inline-flex items-center gap-1 text-cyan-300 ${className}`}
      title={t("verified_org")}
    >
      <BadgeCheck size={15} className="fill-cyan-400/20" />
    </span>
  );
};

// Streak flame
export const StreakBadge = ({ streak, className = "" }) => {
  const { t } = useApp();
  if (!streak || streak < 1) return null;
  return (
    <span
      data-testid="streak-badge"
      className={`inline-flex items-center gap-1 text-xs font-bold text-orange-300 border border-orange-400/40 bg-orange-400/10 rounded-full px-2.5 py-1 ${className}`}
    >
      <Flame size={13} className="fill-orange-400/40" /> {streak} {t("day_streak")}
    </span>
  );
};

const REWARD_STYLE = {
  1: { color: "#7DF9FF", label: "Starter" },
  2: { color: "#00FF66", label: "Connector" },
  3: { color: "#FFB800", label: "Igniter" },
};

export const RewardBadge = ({ reward, className = "" }) => {
  if (!reward || !reward.tier) return null;
  const s = REWARD_STYLE[reward.tier];
  return (
    <span
      data-testid="reward-badge"
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${className}`}
      style={{ color: s.color, border: `1px solid ${s.color}66`, background: `${s.color}14` }}
      title={`${s.label} — invite reward`}
    >
      <Award size={10} /> {s.label}
    </span>
  );
};

export const RewardStrip = ({ directCount = 0 }) => {
  const { t } = useApp();
  const tiers = [
    { n: 10, ...REWARD_STYLE[1] },
    { n: 50, ...REWARD_STYLE[2] },
    { n: 100, ...REWARD_STYLE[3] },
  ];
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5" data-testid="reward-strip">
      <h3 className="flex items-center gap-2 font-unbounded font-bold text-white mb-4">
        <Award size={17} className="text-amber-400" /> {t("rewards")}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((tier) => {
          const unlocked = directCount >= tier.n;
          return (
            <div
              key={tier.n}
              data-testid={`reward-tier-${tier.n}`}
              className={`rounded-xl border p-3 text-center transition-all ${unlocked ? "" : "opacity-40 grayscale"}`}
              style={{ borderColor: tier.color + (unlocked ? "66" : "33"), background: unlocked ? tier.color + "12" : "transparent" }}
            >
              <Award size={22} className="mx-auto mb-1" style={{ color: tier.color }} />
              <div className="text-xs font-bold" style={{ color: unlocked ? tier.color : "#94A3B8" }}>{tier.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {unlocked ? t("reward_unlocked") : `${tier.n} ${t("reward_locked")}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
