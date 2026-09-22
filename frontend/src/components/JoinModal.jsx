import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { CITIES } from "@/lib/cities";
import { Avatar } from "@/components/Avatar";

export const JoinModal = ({ open, onOpenChange, onJoin, inviterName, loading }) => {
  const { t } = useApp();
  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [city, setCity] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onJoin({ nickname: nickname.trim(), real_name: realName.trim() || null, city: city || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-cyan-500/30 sm:max-w-md" data-testid="join-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {t("join_cta")}
          </DialogTitle>
        </DialogHeader>

        {inviterName && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-slate-700/60 p-3">
            <Avatar name={inviterName} size={38} ring />
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-cyan-300">{inviterName}</span> {t("invited_by")}
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="nickname" className="text-slate-300">{t("nickname")}</Label>
            <Input
              id="nickname"
              data-testid="nickname-input"
              autoFocus
              maxLength={18}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("nickname_ph")}
              className="bg-slate-900/70 border-slate-700 text-white h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="realname" className="text-slate-400 text-xs">{t("real_name_opt")}</Label>
            <Input
              id="realname"
              data-testid="realname-input"
              maxLength={40}
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              className="bg-slate-900/70 border-slate-700 text-white h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">{t("city_opt")}</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-testid="city-select" className="bg-slate-900/70 border-slate-700 text-white h-11">
                <SelectValue placeholder={t("select_city")} />
              </SelectTrigger>
              <SelectContent className="glass border-slate-700 text-white">
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c} data-testid={`city-option-${c}`}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="submit"
            data-testid="confirm-join-button"
            disabled={loading || !nickname.trim()}
            className="w-full h-12 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center justify-center gap-2 hover:shadow-[0_0_28px_rgba(0,240,255,0.55)] transition-shadow disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            {loading ? t("joining") : t("confirm_join")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
