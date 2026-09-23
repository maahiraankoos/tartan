import React from "react";
import { Crown, BadgeCheck, Flame } from "lucide-react";
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
