import React, { useState, useEffect } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { enablePush, pushSupported, pushPermission } from "@/lib/push";
import { toast } from "sonner";

export const PushButton = ({ shareToken }) => {
  const { t } = useApp();
  const [state, setState] = useState("prompt");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) { setState("unsupported"); return; }
    setState(pushPermission() === "granted" ? "granted" : pushPermission() === "denied" ? "denied" : "prompt");
  }, []);

  if (state === "unsupported") return null;

  const enable = async () => {
    setBusy(true);
    try {
      await enablePush(shareToken);
      setState("granted");
      toast.success(t("alerts_on"));
    } catch (e) {
      if (e.message === "denied") { setState("denied"); toast.error(t("alerts_blocked")); }
      else toast.error("Could not enable alerts");
    } finally {
      setBusy(false);
    }
  };

  if (state === "granted") {
    return (
      <span data-testid="push-enabled" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
        <BellRing size={14} /> {t("alerts_on")}
      </span>
    );
  }

  return (
    <button
      data-testid="enable-push-button"
      onClick={enable}
      disabled={busy || state === "denied"}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/40 rounded-full px-3 py-1.5 hover:bg-cyan-500/10 active:scale-95 transition-all disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
      {state === "denied" ? t("alerts_blocked") : t("enable_alerts")}
    </button>
  );
};
