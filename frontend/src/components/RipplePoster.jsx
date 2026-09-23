import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Share2, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { auraFor, polyPoints } from "@/lib/aura";
import { fmtNum } from "@/lib/helpers";
import { toast } from "sonner";

export const RipplePoster = ({ chain, shareToken }) => {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState("post");
  const qrRef = useRef(null);

  const me = chain?.me || {};
  const tartan = chain?.tartan || {};
  const directs = (chain?.directs || []).slice(0, 12);
  const aura = auraFor(tartan.token || shareToken || "tartan");
  const url = `${window.location.origin}/j/${shareToken}`;
  const initial = (n) => (n || "?").trim().charAt(0).toUpperCase();

  const generate = async () => {
    setBusy(true);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (e) {}
    const W = 1080, H = format === "story" ? 1920 : 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const { primary, secondary } = aura.palette;

    // background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0B1120");
    bg.addColorStop(0.55, "#05070F");
    bg.addColorStop(1, "#0A0E1A");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = (x, y, r, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    glow(200, 260, 420, primary + "22");
    glow(900, 1050, 460, secondary + "1f");

    // border
    ctx.strokeStyle = primary + "55";
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // header
    ctx.textAlign = "left";
    ctx.fillStyle = primary;
    ctx.font = "800 30px 'JetBrains Mono', monospace";
    ctx.fillText("● TARTAN", 80, 120);
    ctx.textAlign = "right";
    ctx.fillStyle = "#94A3B8";
    ctx.font = "600 26px 'JetBrains Mono', monospace";
    ctx.fillText(t("my_ripple").toUpperCase(), W - 80, 120);

    // name + spark
    ctx.textAlign = "left";
    ctx.fillStyle = "#F0F6FF";
    ctx.font = "800 72px 'Unbounded', sans-serif";
    ctx.fillText((me.nickname || "You").slice(0, 14), 80, 210);
    ctx.fillStyle = secondary;
    ctx.font = "700 30px 'JetBrains Mono', monospace";
    const rankTxt = chain?.rank ? `SPARK #${me.spark_number ?? "—"}  ·  RANK #${chain.rank} (TOP ${chain.percentile}%)` : `SPARK #${me.spark_number ?? "—"}`;
    ctx.fillText(rankTxt, 82, 255);

    // ripple
    const cx = W / 2, cy = format === "story" ? 900 : 720, R = 250;
    const layout = directs.map((d, i) => {
      const a = (i / Math.max(1, directs.length)) * Math.PI * 2 - Math.PI / 2;
      return { d, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
    });

    // aura rings
    [R * 0.55, R * 0.85, R * 1.12].forEach((r) => {
      ctx.strokeStyle = primary + "22";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    });

    // connectors + stars
    layout.forEach(({ x, y, a, d }) => {
      const mx = (cx + x) / 2 + (cy - y) * 0.18;
      const my = (cy + y) / 2 + (x - cx) * 0.18;
      const g = ctx.createLinearGradient(cx, cy, x, y);
      g.addColorStop(0, primary); g.addColorStop(1, secondary);
      ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my, x, y); ctx.stroke();
      ctx.globalAlpha = 1;
      const stars = Math.min(7, d.downstream_count || 0);
      for (let s = 0; s < stars; s++) {
        const sa = a + (Math.random() - 0.5) * 1.0;
        const sr = 44 + Math.random() * 42;
        ctx.fillStyle = secondary;
        ctx.beginPath(); ctx.arc(x + Math.cos(sa) * sr, y + Math.sin(sa) * sr, 3, 0, Math.PI * 2); ctx.fill();
      }
    });

    // tier-1 nodes
    layout.forEach(({ x, y, d }) => {
      ctx.fillStyle = secondary + "2e";
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#F0F6FF";
      ctx.font = "700 24px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(initial(d.nickname), x, y + 8);
    });

    // center YOU
    glow(cx, cy, 120, primary + "55");
    ctx.fillStyle = primary + "26";
    ctx.strokeStyle = primary;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = primary;
    ctx.font = "800 30px 'Unbounded', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(initial(me.nickname), cx, cy + 4);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "600 14px 'JetBrains Mono', monospace";
    ctx.fillText("YOU", cx, cy + 26);

    // stats row
    const statY = H - 300;
    const stats = [
      { label: t("direct_joins"), val: fmtNum(me.direct_count || 0) },
      { label: t("downstream"), val: fmtNum(me.downstream_count || 0) },
    ];
    stats.forEach((s, i) => {
      const bx = i === 0 ? W / 2 - 240 : W / 2 + 40;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, bx, statY, 200, 96, 16); ctx.fill(); ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = primary;
      ctx.font = "800 44px 'JetBrains Mono', monospace";
      ctx.fillText(s.val, bx + 100, statY + 50);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 15px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(s.label, bx + 100, statY + 78);
    });

    // footer: chain title + QR
    ctx.textAlign = "left";
    ctx.fillStyle = "#F0F6FF";
    ctx.font = "700 30px 'Outfit', sans-serif";
    wrapText(ctx, tartan.title || "Tartan chain", 80, H - 150, 600, 36);
    ctx.fillStyle = secondary;
    ctx.font = "600 20px 'JetBrains Mono', monospace";
    ctx.fillText(t("keep_moving"), 80, H - 100);

    // QR (draw white plate + qr canvas)
    const qrCanvas = qrRef.current?.querySelector("canvas");
    if (qrCanvas) {
      const qx = W - 80 - 180, qy = H - 220;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qx - 14, qy - 14, 208, 208, 16); ctx.fill();
      ctx.drawImage(qrCanvas, qx, qy, 180, 180);
    }

    setPreview(canvas.toDataURL("image/png"));
    setBusy(false);
  };

  const openPoster = () => {
    setOpen(true);
    setPreview(null);
    setTimeout(generate, 120);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = preview;
    a.download = `tartan-${me.nickname || "chain"}.png`;
    a.click();
  };

  const share = async () => {
    try {
      const blob = await (await fetch(preview)).blob();
      const file = new File([blob], "tartan-chain.png", { type: "image/png" });
      const text = `My Tartan chain has reached ${fmtNum(me.downstream_count || 0)} people. Join me: ${url}`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "Tartan" });
      } else if (navigator.share) {
        await navigator.share({ text, url });
      } else {
        download();
      }
    } catch (e) { download(); }
  };

  useEffect(() => {
    if (open) {
      setPreview(null);
      const id = setTimeout(generate, 60);
      return () => clearTimeout(id);
    }
  }, [format]);

  return (
    <>
      <button
        data-testid="export-poster-button"
        onClick={openPoster}
        className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/40 rounded-full px-3 py-1.5 hover:bg-cyan-500/10 active:scale-[0.97] transition-all"
      >
        <ImageIcon size={13} /> {t("export_poster")}
      </button>

      {/* hidden QR source */}
      <div ref={qrRef} className="hidden">
        <QRCodeCanvas value={url} size={180} fgColor="#05070F" bgColor="#ffffff" level="M" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass border-cyan-500/40 sm:max-w-sm" data-testid="ripple-poster-modal">
          <DialogTitle className="sr-only">Share poster</DialogTitle>
          <DialogDescription className="sr-only">A shareable image of your chain with a QR code to join.</DialogDescription>
          <div className="flex flex-col items-center gap-4 py-1">
            <div className="flex gap-1 p-1 rounded-full bg-slate-800/60 border border-slate-700" data-testid="poster-format-toggle">
              {["post", "story"].map((f) => (
                <button
                  key={f}
                  data-testid={`poster-format-${f}`}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${format === f ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}
                >
                  {f === "post" ? t("format_post") + " 4:5" : t("format_story") + " 9:16"}
                </button>
              ))}
            </div>
            {preview ? (
              <img src={preview} alt="Your chain poster" className={`w-full rounded-2xl border border-cyan-500/30 neon-cyan ${format === "story" ? "max-w-[240px]" : "max-w-[320px]"}`} data-testid="poster-image" />
            ) : (
              <div className="w-full max-w-[320px] aspect-[4/5] rounded-2xl border border-slate-700 flex items-center justify-center">
                <Loader2 className="animate-spin text-cyan-400" size={26} />
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button
                data-testid="poster-share-button"
                onClick={share}
                disabled={!preview || busy}
                className="flex-1 h-11 rounded-full font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 size={16} /> {t("share_native")}
              </button>
              <button
                data-testid="poster-download-button"
                onClick={download}
                disabled={!preview || busy}
                className="h-11 px-4 rounded-full font-semibold text-cyan-300 border border-cyan-500/40 flex items-center justify-center gap-2 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "", yy = y;
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, yy);
      line = w + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
