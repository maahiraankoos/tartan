import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Flag, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { toast } from "sonner";

export const ReportDialog = ({ tartanToken, targetShareToken }) => {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await api.post("/reports", {
        tartan_token: tartanToken,
        target_share_token: targetShareToken || null,
        reason: reason.trim(),
        kind: "report",
      });
      toast.success(t("report_thanks"));
      setOpen(false);
      setReason("");
    } catch (err) {
      toast.error("Could not submit report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        data-testid="report-chain-button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors"
      >
        <Flag size={13} /> {t("report")}
      </button>
      <DialogContent className="glass border-rose-500/30 sm:max-w-sm" data-testid="report-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-white">{t("report_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            data-testid="report-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("report_reason")}
            rows={4}
            maxLength={300}
            className="bg-slate-900/70 border-slate-700 text-white resize-none"
          />
          <button
            type="submit"
            data-testid="submit-report-button"
            disabled={loading || !reason.trim()}
            className="w-full h-11 rounded-full font-semibold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            {t("submit_report")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
