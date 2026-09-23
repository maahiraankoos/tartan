import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Swords, Crown } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";

const COLORS = ["#00F0FF", "#00FF66", "#FFB800", "#FF2A55", "#A855F7", "#7DF9FF"];

export const CityRace = ({ token, refreshKey = 0 }) => {
  const { t } = useApp();
  const [nodes, setNodes] = useState(null);

  useEffect(() => {
    api.get(`/tartans/${token}/map`).then(({ data }) => setNodes(data.nodes || [])).catch(() => setNodes([]));
  }, [token, refreshKey]);

  if (!nodes) return null;
  const top = [...nodes].sort((a, b) => b.count - a.count).slice(0, 6);
  const max = Math.max(1, ...top.map((n) => n.count));

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5" data-testid="city-race">
      <h3 className="flex items-center gap-2 font-unbounded font-bold text-white mb-4">
        <MapPin size={17} className="text-emerald-400" /> {t("city_race")}
      </h3>
      <div className="space-y-3">
        {top.map((n, i) => (
          <div key={n.city} className="flex items-center gap-3" data-testid={`city-race-${n.city}`}>
            <span className="w-24 text-sm text-slate-300 truncate">{n.city}</span>
            <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[i % COLORS.length]}99)` }}
                initial={{ width: 0 }}
                animate={{ width: `${(n.count / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.06 }}
              />
            </div>
            <span className="w-10 text-right font-mono text-sm font-bold" style={{ color: COLORS[i % COLORS.length] }}>
              {fmtNum(n.count)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamBattle = ({ token, teams, refreshKey = 0 }) => {
  const { t } = useApp();
  const [board, setBoard] = useState(null);

  useEffect(() => {
    if (!teams || teams.length === 0) return;
    api.get(`/tartans/${token}/teams`).then(({ data }) => setBoard(data.scoreboard || [])).catch(() => setBoard([]));
  }, [token, teams, refreshKey]);

  if (!teams || teams.length === 0 || !board) return null;
  const max = Math.max(1, ...board.map((b) => b.reach + b.members));

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-[#0E1526] p-5" data-testid="team-battle">
      <h3 className="flex items-center gap-2 font-unbounded font-bold text-white mb-4">
        <Swords size={17} className="text-fuchsia-400" /> {t("team_battle")}
      </h3>
      <div className="space-y-3">
        {board.map((b, i) => (
          <div key={b.team} data-testid={`team-row-${i}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                {i === 0 && <Crown size={13} className="text-amber-400" />}{b.team}
              </span>
              <span className="font-mono text-sm font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                {fmtNum(b.reach + b.members)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[i % COLORS.length]}99)` }}
                initial={{ width: 0 }}
                animate={{ width: `${((b.reach + b.members) / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.06 }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{fmtNum(b.members)} members · {fmtNum(b.reach)} reach</div>
          </div>
        ))}
        {board.length === 0 && <p className="text-sm text-slate-500">No members have picked a team yet.</p>}
      </div>
    </div>
  );
};

export const GoalMeter = ({ target, current }) => {
  const { t } = useApp();
  if (!target || target <= 0) return null;
  const pct = Math.min(100, Math.round((current / target) * 100));
  const left = Math.max(0, target - current);
  const done = left === 0;
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="goal-meter">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-amber-200">{t("chain_goal")}</span>
        <span className="font-mono text-sm text-amber-300">{fmtNum(current)} / {fmtNum(target)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <p className="text-xs text-amber-200/80 mt-2">
        {done ? t("goal_reached") : `${fmtNum(left)} ${t("to_goal")}`}
      </p>
    </div>
  );
};
