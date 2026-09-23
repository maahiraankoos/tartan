import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, Camera, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { CITIES } from "@/lib/cities";
import { Avatar } from "@/components/Avatar";
import api from "@/lib/api";
import { toast } from "sonner";

export const JoinModal = ({ open, onOpenChange, onJoin, inviterName, inviterAvatar, loading, teams = [] }) => {
  const { t } = useApp();
  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [city, setCity] = useState("");
  const [team, setTeam] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFileId, setAvatarFileId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/avatars", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAvatarFileId(data.avatar_file_id);
    } catch (err) {
      toast.error("Could not upload photo");
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const clearAvatar = () => {
    setAvatarPreview(null);
    setAvatarFileId(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onJoin({
      nickname: nickname.trim(),
      real_name: realName.trim() || null,
      city: city || null,
      team: team || null,
      avatar_file_id: avatarFileId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-cyan-500/30 sm:max-w-md" data-testid="join-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">{t("join_cta")}</DialogTitle>
        </DialogHeader>

        {inviterName && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-slate-700/60 p-3">
            <Avatar name={inviterName} src={inviterAvatar} size={38} ring />
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-cyan-300">{inviterName}</span> {t("invited_by")}
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 pt-1">
          {/* avatar picker */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              data-testid="avatar-upload-trigger"
              className="relative shrink-0"
            >
              <Avatar name={nickname || "?"} src={avatarPreview} size={56} ring />
              <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-cyan-500 flex items-center justify-center border-2 border-[#0E1526]">
                {uploading ? <Loader2 size={12} className="animate-spin text-slate-950" /> : <Camera size={12} className="text-slate-950" />}
              </span>
            </button>
            <div className="text-xs text-slate-400">
              <div className="font-semibold text-slate-300">{avatarPreview ? t("change_photo") : t("add_photo")}</div>
              <div>{t("photo_optional")}</div>
            </div>
            {avatarPreview && (
              <button type="button" onClick={clearAvatar} data-testid="avatar-clear-button" className="ml-auto text-slate-500 hover:text-rose-400">
                <X size={16} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" data-testid="avatar-file-input" />
          </div>

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

          {teams && teams.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-fuchsia-300 text-xs flex items-center gap-1">⚔️ {t("pick_team")}</Label>
              <div className="flex flex-wrap gap-2" data-testid="team-picker">
                {teams.map((tm) => (
                  <button
                    type="button"
                    key={tm}
                    data-testid={`team-choice-${tm}`}
                    onClick={() => setTeam(team === tm ? "" : tm)}
                    className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all ${team === tm ? "bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200" : "border-slate-700 text-slate-300 hover:border-fuchsia-500/50"}`}
                  >
                    {tm}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            data-testid="confirm-join-button"
            disabled={loading || uploading || !nickname.trim()}
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
