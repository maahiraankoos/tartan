import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, Star, EyeOff, Eye, Users, Flag, LayoutGrid, Search, Receipt, Check, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { CATEGORY_MAP } from "@/lib/categories";
import { useAuth } from "@/context/AuthContext";
import { fmtNum } from "@/lib/helpers";
import api from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "Orders", icon: Receipt },
  { id: "chains", label: "Chains", icon: Star },
  { id: "users", label: "Users", icon: Users },
  { id: "reports", label: "Reports", icon: Flag },
];

const StatCard = ({ label, value, accent }) => (
  <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-4">
    <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
    <div className="font-unbounded text-3xl font-black mt-1" style={{ color: accent || "#fff" }}>{typeof value === "number" ? fmtNum(value) : value}</div>
  </div>
);

export default function Admin() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [chains, setChains] = useState(null);
  const [users, setUsers] = useState(null);
  const [reports, setReports] = useState(null);
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (user === false) nav("/login", { state: { from: "/admin" } });
  }, [user, nav]);

  const loadOverview = useCallback(() => {
    api.get("/admin/overview").then(({ data }) => setOverview(data)).catch(() => {});
  }, []);
  const loadChains = useCallback(() => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (q.trim()) p.set("q", q.trim());
    api.get(`/admin/tartans?${p.toString()}`).then(({ data }) => setChains(data)).catch(() => setChains([]));
  }, [filter, q]);

  useEffect(() => { if (user?.role === "admin") loadOverview(); }, [user, loadOverview]);
  useEffect(() => { if (user?.role === "admin" && tab === "chains") loadChains(); }, [user, tab, loadChains]);
  useEffect(() => { if (user?.role === "admin" && tab === "users" && !users) api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => setUsers([])); }, [user, tab, users]);
  useEffect(() => { if (user?.role === "admin" && tab === "reports" && !reports) api.get("/admin/reports").then(({ data }) => setReports(data)).catch(() => setReports([])); }, [user, tab, reports]);

  const loadOrders = useCallback(() => {
    api.get("/admin/orders").then(({ data }) => setOrders(data)).catch(() => setOrders([]));
  }, []);
  useEffect(() => { if (user?.role === "admin" && tab === "orders") loadOrders(); }, [user, tab, loadOrders]);

  const activateOrder = async (id) => {
    try { await api.post(`/admin/orders/${id}/activate`); toast.success("Order activated — chain is now featured"); loadOrders(); loadOverview(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Action failed"); }
  };
  const rejectOrder = async (id) => {
    try { await api.post(`/admin/orders/${id}/reject`); toast.success("Order rejected"); loadOrders(); loadOverview(); }
    catch (e) { toast.error("Action failed"); }
  };

  const toggleFeature = async (tt) => {
    try {
      await api.post(`/admin/tartans/${tt.token}/feature`, { value: !tt.featured });
      toast.success(!tt.featured ? "Chain featured" : "Feature removed");
      loadChains(); loadOverview();
    } catch (e) { toast.error("Action failed"); }
  };
  const toggleHide = async (tt) => {
    try {
      await api.post(`/admin/tartans/${tt.token}/hide`, { value: !tt.hidden });
      toast.success(!tt.hidden ? "Chain hidden" : "Chain restored");
      loadChains(); loadOverview();
    } catch (e) { toast.error("Action failed"); }
  };

  if (user === null || user === false) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" size={30} /></div>;
  }
  if (user.role !== "admin") {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400">
          <Shield size={30} className="mx-auto mb-3 text-slate-600" />
          <p>This area is for platform admins only.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield size={22} className="text-cyan-400" />
          <h1 className="font-unbounded text-3xl font-black text-white">Admin</h1>
          <span className="text-[10px] uppercase tracking-widest text-cyan-400/80 border border-cyan-500/30 rounded-full px-2 py-0.5 ml-1">Platform</span>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tb) => (
            <button key={tb.id} data-testid={`admin-tab-${tb.id}`} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-2 whitespace-nowrap transition-colors ${tab === tb.id ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40" : "text-slate-400 border border-slate-700 hover:border-slate-500"}`}>
              <tb.icon size={14} /> {tb.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          overview ? (
            <div data-testid="admin-overview">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Revenue" value={`$${overview.revenue || 0}`} accent="#34D399" />
                <StatCard label="Pending orders" value={overview.pending_orders || 0} accent="#FBBF24" />
                <StatCard label="Chains" value={overview.tartans} accent="#00F0FF" />
                <StatCard label="People reached" value={overview.members} accent="#34D399" />
                <StatCard label="Accounts" value={overview.users} />
                <StatCard label="Companies" value={overview.companies} accent="#A78BFA" />
                <StatCard label="Featured" value={overview.featured} accent="#FBBF24" />
                <StatCard label="Reports" value={overview.reports} accent="#F87171" />
              </div>
              <div className="mt-6 rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5">
                <div className="text-sm font-semibold text-white mb-3">Chains by category</div>
                <div className="space-y-2">
                  {overview.by_category.map((c, i) => {
                    const meta = CATEGORY_MAP[c.category];
                    const max = Math.max(...overview.by_category.map((x) => x.count), 1);
                    return (
                      <div key={`${c.category}-${i}`} className="flex items-center gap-3">
                        <div className="w-40 text-sm text-slate-300 truncate">{meta ? `${meta.emoji} ${meta.label}` : c.category}</div>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(c.count / max) * 100}%` }} />
                        </div>
                        <div className="w-10 text-right font-mono text-sm text-slate-400">{c.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : <Loader2 className="animate-spin text-cyan-400 mx-auto mt-10" size={26} />
        )}

        {tab === "orders" && (
          orders === null ? <Loader2 className="animate-spin text-cyan-400 mx-auto mt-10" size={26} /> : orders.length === 0 ? (
            <p className="text-slate-500 text-center py-10" data-testid="admin-orders-empty">No featured orders yet.</p>
          ) : (
            <div className="space-y-2" data-testid="admin-orders">
              {orders.map((o) => {
                const badge = {
                  pending: "text-amber-300 border-amber-500/40",
                  active: "text-emerald-300 border-emerald-500/40",
                  expired: "text-slate-400 border-slate-600",
                  rejected: "text-rose-300 border-rose-500/40",
                }[o.status] || "text-slate-400 border-slate-600";
                return (
                  <div key={o.id} data-testid={`admin-order-${o.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-[#0E1526] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{o.tartan_title || o.tartan_token}</span>
                        <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 border ${badge}`}>{o.status}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {o.days}-day plan · <span className="text-amber-300 font-mono">${o.amount}</span> · {o.owner_name || "—"}
                        {o.expires_at ? ` · expires ${new Date(o.expires_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    {o.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button data-testid={`admin-order-activate-${o.id}`} onClick={() => activateOrder(o.id)}
                          className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25">
                          <Check size={12} /> Mark paid & activate
                        </button>
                        <button data-testid={`admin-order-reject-${o.id}`} onClick={() => rejectOrder(o.id)}
                          className="flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 text-rose-300 border border-rose-500/40 hover:bg-rose-500/10">
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "chains" && (
          <div data-testid="admin-chains">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {["all", "requests", "featured", "hidden"].map((f) => (
                <button key={f} data-testid={`admin-filter-${f}`} onClick={() => setFilter(f)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 capitalize transition-colors ${filter === f ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40" : "text-slate-400 border border-slate-700"}`}>
                  {f === "requests" ? "Feature requests" : f}
                </button>
              ))}
              <div className="relative ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input data-testid="admin-chain-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="bg-slate-900/70 border-slate-700 text-white h-9 pl-8 w-52" />
              </div>
            </div>

            {chains === null ? <Loader2 className="animate-spin text-cyan-400 mx-auto mt-10" size={26} /> : chains.length === 0 ? (
              <p className="text-slate-500 text-center py-10">No chains match.</p>
            ) : (
              <div className="space-y-2">
                {chains.map((tt) => {
                  const cat = CATEGORY_MAP[tt.category];
                  return (
                    <div key={tt.token} data-testid={`admin-chain-${tt.token}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-[#0E1526] p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{tt.title}</span>
                          {tt.featured && <Star size={13} className="text-amber-400 shrink-0" />}
                          {tt.hidden && <EyeOff size={13} className="text-rose-400 shrink-0" />}
                          {tt.feature_requested && !tt.featured && <span className="text-[10px] text-amber-300 border border-amber-500/40 rounded-full px-1.5 shrink-0">requested</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {cat ? `${cat.emoji} ${cat.label}` : "—"} · {fmtNum(tt.verified_members)} reached
                          {tt.owner_name ? ` · ${tt.owner_name}` : " · anonymous"}
                        </div>
                      </div>
                      <button data-testid={`admin-feature-${tt.token}`} onClick={() => toggleFeature(tt)}
                        className={`flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 ${tt.featured ? "bg-amber-500/15 text-amber-300 border border-amber-500/40" : "text-slate-300 border border-slate-600 hover:border-amber-400"}`}>
                        <Star size={12} /> {tt.featured ? "Featured" : "Feature"}
                      </button>
                      <button data-testid={`admin-hide-${tt.token}`} onClick={() => toggleHide(tt)}
                        className={`flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 ${tt.hidden ? "bg-rose-500/15 text-rose-300 border border-rose-500/40" : "text-slate-300 border border-slate-600 hover:border-rose-400"}`}>
                        {tt.hidden ? <><Eye size={12} /> Restore</> : <><EyeOff size={12} /> Hide</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          users === null ? <Loader2 className="animate-spin text-cyan-400 mx-auto mt-10" size={26} /> : (
            <div className="space-y-2" data-testid="admin-users">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-[#0E1526] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{u.org_name || u.name || u.email}</div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 border ${u.role === "admin" ? "text-cyan-300 border-cyan-500/40" : u.role === "company" ? "text-violet-300 border-violet-500/40" : "text-emerald-300 border-emerald-500/40"}`}>{u.role}</span>
                  <span className="text-xs text-slate-400 font-mono w-16 text-right">{u.tartans} chains</span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "reports" && (
          reports === null ? <Loader2 className="animate-spin text-cyan-400 mx-auto mt-10" size={26} /> : reports.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No reports.</p>
          ) : (
            <div className="space-y-2" data-testid="admin-reports">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-700/60 bg-[#0E1526] p-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 border ${r.kind === "block" ? "text-rose-300 border-rose-500/40" : "text-amber-300 border-amber-500/40"}`}>{r.kind}</span>
                    <span className="text-xs text-slate-500 font-mono">{r.tartan_token}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1.5">{r.reason || "—"}</p>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </>
  );
}
