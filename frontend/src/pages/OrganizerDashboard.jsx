import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Loader2, ArrowLeft, Users, TrendingUp, GitBranch, MapPin, Crown } from "lucide-react";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";

const Panel = ({ title, children, testid }) => (
  <div data-testid={testid} className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5">
    <h3 className="font-display font-semibold text-white mb-4">{title}</h3>
    {children}
  </div>
);

export default function OrganizerDashboard() {
  const { shareToken } = useParams();
  const { t } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // resolve tartan token from the member chain first
        const { data: chain } = await api.get(`/members/${shareToken}/chain`);
        const token = chain?.tartan?.token;
        const { data: an } = await api.get(`/tartans/${token}/analytics`, { params: { owner: shareToken } });
        if (alive) setData(an);
      } catch (e) {
        if (alive) setError(e?.response?.status === 403 ? "forbidden" : "error");
      }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [shareToken]);

  if (error) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400">
          <p>{error === "forbidden" ? t("not_authorized") : "Something went wrong."}</p>
          <Link to="/" className="text-cyan-300 mt-3 inline-block">{t("back_home")}</Link>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={30} />
      </div>
    );
  }

  const { tartan, stats, timeline, depth_distribution, geography, top_branches } = data;
  const maxGeo = Math.max(1, ...geography.map((g) => g.count));

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link to={`/me/${shareToken}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 mb-4" data-testid="dashboard-back-link">
          <ArrowLeft size={15} /> {t("back_home")}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Crown size={22} className="text-amber-400" />
          <div>
            <h1 className="font-display text-2xl font-black text-white">{t("organizer_dashboard")}</h1>
            <p className="text-sm text-slate-400">{tartan.title}</p>
          </div>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: t("live_reach"), val: stats.verified_members, sub: `${stats.total_members} total`, c: "text-cyan-300 border-cyan-500/30" },
            { icon: TrendingUp, label: t("momentum"), val: stats.velocity_1h, sub: `${stats.velocity_24h}/24h`, c: "text-emerald-300 border-emerald-500/30" },
            { icon: MapPin, label: t("active_cities"), val: stats.active_cities, sub: null, c: "text-amber-300 border-amber-500/30" },
            { icon: GitBranch, label: t("depth"), val: stats.max_depth, sub: null, c: "text-fuchsia-300 border-fuchsia-500/30" },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border p-4 bg-[#0E1526] ${s.c}`} data-testid={`analytics-stat-${i}`}>
              <s.icon size={18} className="opacity-80 mb-2" />
              <div className="font-mono text-2xl font-bold"><AnimatedNumber value={s.val} /></div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">{s.label}</div>
              {s.sub && <div className="text-[11px] text-slate-500">{s.sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title={t("reach_over_time")} testid="chart-reach">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#00F0FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0E1526", border: "1px solid #1E2D4A", borderRadius: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="cumulative" name={t("cumulative_reach")} stroke="#00F0FF" strokeWidth={2} fill="url(#reachFill)" isAnimationActive={false} dot={{ r: 3, fill: "#00F0FF" }} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title={t("depth_dist")} testid="chart-depth">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={depth_distribution} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                <XAxis dataKey="depth" tick={{ fill: "#64748B", fontSize: 10 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 10 }} />
                <Tooltip cursor={{ fill: "rgba(0,255,102,0.08)" }} contentStyle={{ background: "#0E1526", border: "1px solid #1E2D4A", borderRadius: 12, color: "#fff" }} />
                <Bar dataKey="count" name="members" fill="#00FF66" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title={t("geo_spread")} testid="geo-spread">
            <div className="space-y-2.5">
              {geography.map((g) => (
                <div key={g.city} className="flex items-center gap-3" data-testid={`geo-row-${g.city}`}>
                  <span className="w-24 text-sm text-slate-300 truncate">{g.city}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(g.count / maxGeo) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-sm text-cyan-300">{fmtNum(g.count)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t("top_branches")} testid="top-branches">
            <div className="space-y-2">
              {top_branches.length === 0 && <p className="text-sm text-slate-500">—</p>}
              {top_branches.map((b, i) => (
                <div key={b.share_token} className="flex items-center gap-3 rounded-xl bg-white/5 border border-slate-700/50 p-2.5" data-testid={`branch-row-${i}`}>
                  <span className="font-mono text-xs text-slate-500 w-4">{i + 1}</span>
                  <Avatar name={b.nickname} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{b.nickname}</div>
                    <div className="text-[11px] text-slate-400">{b.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-emerald-300">{fmtNum(b.downstream_count)}</div>
                    <div className="text-[10px] text-slate-500">{t("downstream")}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </main>
    </>
  );
}
