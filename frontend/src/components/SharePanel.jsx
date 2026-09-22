import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MessageCircle, Smartphone, Share2, Copy, QrCode, Check, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export const SharePanel = ({ shareToken, tartanTitle }) => {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const url = `${window.location.origin}/j/${shareToken}`;
  const msg = `${tartanTitle ? tartanTitle + " — " : ""}Join the chain and keep it moving: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 1600);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Tartan", text: msg, url });
      } catch (e) {}
    } else {
      copy();
    }
  };

  const downloadQr = () => {
    const svg = document.getElementById("tartan-qr-svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tartan-qr.svg";
    a.click();
  };

  const btn = "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-semibold text-white transition-transform active:scale-95";

  return (
    <div className="p-5 rounded-2xl border border-slate-700/60 bg-[#0E1526] space-y-4" data-testid="share-panel">
      <div>
        <p className="text-xs uppercase tracking-widest text-cyan-400/80 mb-2">{t("your_link")}</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            data-testid="share-link-input"
            value={url}
            className="flex-1 min-w-0 bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 font-mono truncate"
          />
          <button
            data-testid="copy-link-button"
            onClick={copy}
            className="shrink-0 h-11 w-11 flex items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 transition-colors"
            title={t("copy_link")}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <a
          data-testid="whatsapp-share-button"
          href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} bg-emerald-600 hover:bg-emerald-500`}
        >
          <MessageCircle size={20} />
          {t("share_whatsapp")}
        </a>
        <a
          data-testid="sms-share-button"
          href={`sms:?&body=${encodeURIComponent(msg)}`}
          className={`${btn} bg-blue-600 hover:bg-blue-500`}
        >
          <Smartphone size={20} />
          {t("share_sms")}
        </a>
        <button
          data-testid="native-share-button"
          onClick={nativeShare}
          className={`${btn} bg-cyan-600 hover:bg-cyan-500`}
        >
          <Share2 size={20} />
          {t("share_native")}
        </button>
        <button
          data-testid="qr-code-modal-trigger"
          onClick={() => setQrOpen(true)}
          className={`${btn} bg-slate-700 hover:bg-slate-600`}
        >
          <QrCode size={20} />
          {t("show_qr")}
        </button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="glass border-cyan-500/30 sm:max-w-xs" data-testid="qr-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-white text-center">{t("qr_code")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="bg-white p-4 rounded-2xl neon-cyan">
              <QRCodeSVG
                id="tartan-qr-svg"
                value={url}
                size={200}
                fgColor="#070B14"
                bgColor="#ffffff"
                level="M"
              />
            </div>
            <button
              data-testid="download-qr-button"
              onClick={downloadQr}
              className="flex items-center gap-2 text-sm text-cyan-300 border border-cyan-500/40 rounded-full px-4 py-2 hover:bg-cyan-500/10"
            >
              <Download size={15} /> SVG
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
