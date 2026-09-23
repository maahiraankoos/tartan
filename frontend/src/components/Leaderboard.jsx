import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { OGBadge } from "@/components/Badges";
import { useApp, getMembership } from "@/context/AppContext";
import { fmtNum, mediaUrl } from "@/lib/helpers";
import api from "@/lib/api";

const medal = ["text-amber-300", "text-slate-300", "text-orange-400"];

export const Leaderboard = ({ token, refreshKey = 0 }) => {
  const { t } = useApp();
  const [rows, setRows] = useState(null);
  const myShare = getMembership(token);

  useEffect(() => {
    api.get(`/tartans/${token}/leaderboard`).then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, [token, refreshKey]);

  if (!rows) return null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5" data-testid="leaderboard">
      <h3 className="flex items-center gap-2 font-unbounded font-bold text-white mb-4">
        <Trophy size={17} className="text-amber-400" /> {t("top_sparks")}
      </h3>
      <div className="space-y-1.5">
        {rows.map((m) => {
          const mine = myShare && m.share_token === myShare;
          return (
            <div
              key={m.share_token}
              data-testid={`leaderboard-row-${m.rank}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${mine ? "bg-cyan-500/10 border border-cyan-500/40" : "hover:bg-white/5"}`}
            >
              <span className={`font-mono font-bold w-6 text-center ${m.rank <= 3 ? medal[m.rank - 1] : "text-slate-500"}`}>
                {m.rank}
              </span>
              <Avatar name={m.nickname} src={mediaUrl(m.avatar_url)} size={34} ring={mine} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold truncate ${mine ? "text-cyan-300" : "text-white"}`}>{m.nickname}</span>
                  <OGBadge sparkNumber={m.spark_number} />
                  {mine && <span className="text-[9px] uppercase text-cyan-400">{t("you")}</span>}
                </div>
                <div className="text-[11px] text-slate-500">{m.city}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-300">{fmtNum(m.downstream_count)}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{t("downstream")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
