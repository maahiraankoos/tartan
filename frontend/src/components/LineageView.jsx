import React from "react";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { timeAgo, fmtNum } from "@/lib/helpers";
import { ArrowDown, Crown } from "lucide-react";

const NodeCard = ({ member, label, highlight, testid }) => {
  const { t } = useApp();
  return (
    <div
      data-testid={testid}
      className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 border w-full max-w-xs ${
        highlight
          ? "border-cyan-400/70 bg-cyan-500/10 neon-cyan"
          : "border-slate-700/60 bg-[#0E1526]"
      }`}
    >
      <Avatar name={member.nickname} size={44} ring={highlight} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`font-display font-bold truncate ${highlight ? "text-cyan-300 text-glow-cyan" : "text-white"}`}>
            {member.nickname}
          </span>
          {member.is_initiator && <Crown size={13} className="text-amber-400 shrink-0" />}
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>{member.city}</span>
          {member.created_at && <span>· {timeAgo(member.created_at)}</span>}
        </div>
      </div>
      {label && (
        <span className="absolute -top-2 left-4 text-[9px] uppercase tracking-widest bg-[#070B14] px-2 text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
};

const Spine = () => (
  <div className="flex justify-center py-1">
    <ArrowDown size={18} className="text-cyan-400/60" />
  </div>
);

export const LineageView = ({ chain }) => {
  const { t } = useApp();
  if (!chain) return null;
  const { inviter, me, directs } = chain;
  const extra = Math.max(0, (me.direct_count || 0) - (directs?.length || 0));

  return (
    <div
      className="relative py-6 px-4 bg-[#0B101D] rounded-2xl border border-slate-800 flex flex-col items-center"
      data-testid="lineage-view"
    >
      {inviter ? (
        <NodeCard member={inviter} label={`${inviter.nickname} ${t("invited_by")}`} testid="lineage-inviter" />
      ) : (
        <div className="text-xs text-slate-500 italic mb-1">{t("initiator")}</div>
      )}
      {inviter && <Spine />}

      <NodeCard member={me} label={t("you")} highlight testid="lineage-you" />

      <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-4 mb-4">
        <div className="text-center rounded-xl bg-white/5 border border-slate-700/50 py-2">
          <div className="font-mono text-lg font-bold text-cyan-300">{fmtNum(me.direct_count)}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400">{t("direct_joins")}</div>
        </div>
        <div className="text-center rounded-xl bg-white/5 border border-slate-700/50 py-2">
          <div className="font-mono text-lg font-bold text-emerald-300">{fmtNum(me.downstream_count)}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400">{t("downstream")}</div>
        </div>
        <div className="text-center rounded-xl bg-white/5 border border-slate-700/50 py-2">
          <div className="font-mono text-lg font-bold text-amber-300">{me.depth}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400">{t("depth")}</div>
        </div>
      </div>

      {directs && directs.length > 0 && (
        <>
          <Spine />
          <div className="w-full">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 text-center mb-3">
              {t("direct_joins")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {directs.map((d) => (
                <div key={d.share_token} className="flex flex-col items-center gap-1 w-16 animate-float-up" data-testid={`lineage-direct-${d.share_token}`}>
                  <Avatar name={d.nickname} size={38} />
                  <span className="text-[10px] text-slate-300 truncate w-full text-center">{d.nickname}</span>
                  {d.downstream_count > 0 && (
                    <span className="text-[9px] text-emerald-400">+{fmtNum(d.downstream_count)}</span>
                  )}
                </div>
              ))}
              {extra > 0 && (
                <div className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
                  +{fmtNum(extra)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
