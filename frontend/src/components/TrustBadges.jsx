import React from "react";
import { Timer, UserX, MailX } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const TrustBadges = () => {
  const { t } = useApp();
  const items = [
    { icon: Timer, label: t("trust_speed") },
    { icon: UserX, label: t("trust_noacct") },
    { icon: MailX, label: t("trust_noemail") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="trust-badges">
      {items.map(({ icon: Icon, label }, i) => (
        <span
          key={i}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-white/5 border border-slate-700/60 rounded-full px-3 py-1.5"
        >
          <Icon size={13} className="text-cyan-400" />
          {label}
        </span>
      ))}
    </div>
  );
};
