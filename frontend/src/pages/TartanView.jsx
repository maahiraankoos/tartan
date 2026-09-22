import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Users, Crown, GitBranch } from "lucide-react";
import { Header } from "@/components/Header";
import { GlobalStats } from "@/components/GlobalStats";
import { ChainMap } from "@/components/ChainMap";
import { JoinModal } from "@/components/JoinModal";
import { ReportDialog } from "@/components/ReportDialog";
import { Avatar } from "@/components/Avatar";
import { useApp, saveMembership, getMembership } from "@/context/AppContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function TartanView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useApp();
  const [payload, setPayload] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const myShare = getMembership(token);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tartans/${token}`);
      setPayload(data);
    } catch (e) {
      toast.error("Tartan not found");
    }
  }, [token]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  const doJoin = async (form) => {
    setJoining(true);
    try {
      const { data } = await api.post(`/tartans/${token}/join`, {
        ...form,
        parent_share_token: null,
        idempotency_key: crypto.randomUUID(),
      });
      saveMembership(token, data.member.share_token);
      toast.success("You're in the chain!");
      navigate(`/me/${data.member.share_token}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not join");
    } finally {
      setJoining(false);
    }
  };

  const tartan = payload?.tartan;

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 mb-4" data-testid="back-home-link">
          <ArrowLeft size={15} /> {t("back_home")}
        </Link>

        {tartan && (
          <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-[#0E1526] to-[#12233b] p-6 mb-6">
            <div className="flex items-start gap-4">
              <Avatar name={tartan.initiator_nickname || tartan.title} size={56} ring />
              <div className="min-w-0 flex-1">
                {tartan.featured && (
                  <span className="text-[10px] uppercase tracking-widest text-amber-400">{t("featured")}</span>
                )}
                <h1 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight">{tartan.title}</h1>
                <p className="text-slate-300 mt-1.5">{tartan.goal}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Crown size={12} className="text-amber-400" /> {tartan.initiator_nickname}</span>
                  {tartan.city && <span>· {tartan.city}</span>}
                  <span className="flex items-center gap-1"><Users size={12} className="text-cyan-400" /> {tartan.verified_members} {t("verified")}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              {myShare ? (
                <Link
                  to={`/me/${myShare}`}
                  data-testid="view-my-branch-button"
                  className="flex items-center gap-2 h-12 px-6 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:shadow-[0_0_28px_rgba(0,255,102,0.5)] transition-shadow"
                >
                  <GitBranch size={18} /> {t("view_my_branch")}
                </Link>
              ) : (
                <button
                  data-testid="join-chain-cta-button"
                  onClick={() => setJoinOpen(true)}
                  className="flex items-center gap-2 h-12 px-6 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:shadow-[0_0_28px_rgba(0,240,255,0.55)] transition-shadow"
                >
                  {t("join_cta")}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <GlobalStats stats={payload?.stats} />
          </div>
          <div className="lg:col-span-8">
            <ChainMap token={token} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <ReportDialog tartanToken={token} />
        </div>
      </main>

      <JoinModal open={joinOpen} onOpenChange={setJoinOpen} onJoin={doJoin} loading={joining} />
    </>
  );
}
