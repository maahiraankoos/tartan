import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useApp, saveMembership } from "@/context/AppContext";
import { CITIES } from "@/lib/cities";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const StartTartanDialog = ({ trigger }) => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [city, setCity] = useState("");
  const [nickname, setNickname] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !goal.trim() || !nickname.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/tartans", {
        title: title.trim(),
        goal: goal.trim(),
        city: city || null,
        nickname: nickname.trim(),
      });
      saveMembership(data.tartan.token, data.member.share_token);
      toast.success("Tartan created!");
      setOpen(false);
      navigate(`/me/${data.member.share_token}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create Tartan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            data-testid="start-tartan-button"
            className="flex items-center gap-2 h-11 px-5 rounded-full font-display font-semibold text-cyan-300 border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus size={18} /> {t("start_tartan")}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="glass border-cyan-500/30 sm:max-w-md" data-testid="start-tartan-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white flex items-center gap-2">
            <Sparkles size={20} className="text-emerald-400" /> {t("start_tartan")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-slate-300">{t("title")}</Label>
            <Input
              data-testid="tartan-title-input"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("title_ph")}
              className="bg-slate-900/70 border-slate-700 text-white h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">{t("goal")}</Label>
            <Textarea
              data-testid="tartan-goal-input"
              maxLength={140}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("goal_ph")}
              className="bg-slate-900/70 border-slate-700 text-white resize-none"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">{t("nickname")}</Label>
              <Input
                data-testid="tartan-nickname-input"
                maxLength={18}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("nickname_ph")}
                className="bg-slate-900/70 border-slate-700 text-white h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("city_opt")}</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger data-testid="tartan-city-select" className="bg-slate-900/70 border-slate-700 text-white h-11">
                  <SelectValue placeholder={t("select_city")} />
                </SelectTrigger>
                <SelectContent className="glass border-slate-700 text-white">
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <button
            type="submit"
            data-testid="create-tartan-submit"
            disabled={loading || !title.trim() || !goal.trim() || !nickname.trim()}
            className="w-full h-12 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center justify-center gap-2 hover:shadow-[0_0_28px_rgba(0,255,102,0.5)] transition-shadow disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {loading ? t("creating") : t("create")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
