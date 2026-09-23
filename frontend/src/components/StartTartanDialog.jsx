import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Zap } from "lucide-react";
import { useApp, saveMembership } from "@/context/AppContext";
import { CITIES } from "@/lib/cities";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { ChainSigil } from "@/components/ChainSigil";
import { JoinReveal } from "@/components/JoinReveal";
import { auraFor } from "@/lib/aura";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const StartTartanDialog = ({ trigger, onCreated }) => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [city, setCity] = useState("");
  const [nickname, setNickname] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [teams, setTeams] = useState("");
  const [category, setCategory] = useState("reconnect");
  const [target, setTarget] = useState("");
  const [reveal, setReveal] = useState(null);

  const seed = title.trim() || "your new chain";
  const aura = auraFor(seed);
  const catMeta = CATEGORY_MAP[category];

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !goal.trim() || !nickname.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/tartans", {
        title: title.trim(), goal: goal.trim(), city: city || null, nickname: nickname.trim(),
        goal_target: goalTarget ? parseInt(goalTarget, 10) : null,
        teams: teams ? teams.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6) : null,
        category, target: target.trim() || null,
      });
      saveMembership(data.tartan.token, data.member.share_token);
      setOpen(false);
      if (onCreated) onCreated();
      setReveal({
        sparkNumber: data.member.spark_number || 1,
        chainName: data.tartan.title,
        chainSeed: data.tartan.token,
        city: data.member.city,
        shareToken: data.member.share_token,
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create Tartan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <button
              data-testid="start-tartan-button"
              className="flex items-center gap-2 h-14 px-6 rounded-full font-unbounded font-semibold text-cyan-300 border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 active:scale-[0.97] transition-all"
            >
              <Plus size={18} /> {t("start_tartan")}
            </button>
          )}
        </DialogTrigger>
        <DialogContent className="glass border-cyan-500/30 sm:max-w-md max-h-[88vh] overflow-y-auto" data-testid="start-tartan-modal">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-2xl text-white">{t("start_tartan")}</DialogTitle>
          </DialogHeader>

          {/* live aura + sigil preview */}
          <div
            className="flex items-center gap-4 rounded-2xl p-4 border"
            style={{ borderColor: aura.palette.primary + "40", background: `linear-gradient(135deg, ${aura.palette.primary}12, ${aura.palette.secondary}10)` }}
          >
            <ChainSigil seed={seed} size={72} />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Your chain style</div>
              <div className="font-unbounded font-bold text-white truncate">{title.trim() || "Untitled chain"}</div>
              <div className="text-xs" style={{ color: aura.palette.primary }}>{aura.palette.name}</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">What kind of chain is this?</Label>
              <div className="grid grid-cols-3 gap-1.5" data-testid="category-picker">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`category-option-${c.id}`}
                    onClick={() => setCategory(c.id)}
                    className={`rounded-xl border p-2 text-center transition-all ${category === c.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"}`}
                  >
                    <div className="text-lg leading-none">{c.emoji}</div>
                    <div className={`text-[10px] mt-1 leading-tight ${category === c.id ? "text-cyan-300" : "text-slate-400"}`}>{c.label}</div>
                  </button>
                ))}
              </div>
              {catMeta && <p className="text-[11px] text-slate-500">{catMeta.blurb}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">{t("title")}</Label>
              <Input data-testid="tartan-title-input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title_ph")} className="bg-slate-900/70 border-slate-700 text-white h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">🎯 Who / what is the target? <span className="text-slate-500">(optional)</span></Label>
              <Input data-testid="tartan-target-input" maxLength={120} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={catMeta?.example || "e.g. Class of 2010, Lincoln High"} className="bg-slate-900/70 border-slate-700 text-white h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">{t("goal")}</Label>
              <Textarea data-testid="tartan-goal-input" maxLength={140} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("goal_ph")} className="bg-slate-900/70 border-slate-700 text-white resize-none" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("chain_goal")} <span className="text-slate-500">· {t("goal_people")} (optional)</span></Label>
              <Input data-testid="tartan-goaltarget-input" type="number" min="0" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="e.g. 1000" className="bg-slate-900/70 border-slate-700 text-white h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">⚔️ {t("teams_field")} <span className="text-slate-500">· {t("teams_hint")}</span></Label>
              <Input data-testid="tartan-teams-input" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="Garowe Crew, Bosaso Crew" className="bg-slate-900/70 border-slate-700 text-white h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">{t("nickname")}</Label>
                <Input data-testid="tartan-nickname-input" maxLength={18} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("nickname_ph")} className="bg-slate-900/70 border-slate-700 text-white h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">{t("city_opt")}</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger data-testid="tartan-city-select" className="bg-slate-900/70 border-slate-700 text-white h-11">
                    <SelectValue placeholder={t("select_city")} />
                  </SelectTrigger>
                  <SelectContent className="glass border-slate-700 text-white">
                    {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button
              type="submit"
              data-testid="create-tartan-submit"
              disabled={loading || !title.trim() || !goal.trim() || !nickname.trim()}
              className="w-full h-12 rounded-full font-unbounded font-bold text-slate-950 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${aura.palette.primary}, ${aura.palette.secondary})` }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
              {loading ? t("creating") : "Create chain"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <JoinReveal
        open={!!reveal}
        isInitiator
        {...(reveal || {})}
        onContinue={() => { const st = reveal.shareToken; setReveal(null); navigate(`/me/${st}`); }}
      />
    </>
  );
};
