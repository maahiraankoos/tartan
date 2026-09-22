import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Share2, Download, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/helpers";

function drawCard(canvas, { milestone, tartanTitle, nickname }) {
  const S = 640;
  const ctx = canvas.getContext("2d");
  canvas.width = S;
  canvas.height = S;

  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, "#0E1526");
  bg.addColorStop(0.5, "#070B14");
  bg.addColorStop(1, "#12233b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // glow blobs
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  glow(120, 120, 220, "rgba(0,240,255,0.18)");
  glow(540, 560, 240, "rgba(0,255,102,0.16)");

  ctx.strokeStyle = "rgba(0,240,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, S - 56, S - 56);

  ctx.textAlign = "center";
  ctx.fillStyle = "#00F0FF";
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.fillText("● TARTAN", S / 2, 100);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "600 20px 'Outfit', sans-serif";
  ctx.fillText("MILESTONE REACHED", S / 2, 210);

  ctx.fillStyle = "#F0F6FF";
  ctx.font = "900 150px 'Outfit', sans-serif";
  ctx.shadowColor = "rgba(0,240,255,0.6)";
  ctx.shadowBlur = 30;
  ctx.fillText(fmtNum(milestone), S / 2, 360);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#00FF66";
  ctx.font = "600 24px 'Outfit', sans-serif";
  ctx.fillText("people reached in the chain", S / 2, 410);

  // tartan title (wrap)
  ctx.fillStyle = "#F0F6FF";
  ctx.font = "700 26px 'Outfit', sans-serif";
  const title = (tartanTitle || "").slice(0, 42);
  ctx.fillText(title, S / 2, 500);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`kept moving by ${nickname}`, S / 2, 540);

  ctx.fillStyle = "#64748B";
  ctx.font = "500 16px 'JetBrains Mono', monospace";
  ctx.fillText("keep it moving →", S / 2, 590);
}

export const MilestoneCard = ({ open, onOpenChange, milestone, tartanTitle, nickname }) => {
  const { t } = useApp();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open || !milestone) return;
    const timer = setTimeout(() => {
      if (canvasRef.current) drawCard(canvasRef.current, { milestone, tartanTitle, nickname });
    }, 60);
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 }, colors: ["#00F0FF", "#00FF66", "#FFB800"] });
    return () => clearTimeout(timer);
  }, [open, milestone, tartanTitle, nickname]);

  const download = () => {
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `tartan-${milestone}.png`;
    a.click();
  };

  const share = () => {
    canvasRef.current.toBlob(async (blob) => {
      const file = new File([blob], `tartan-${milestone}.png`, { type: "image/png" });
      const text = `We just reached ${fmtNum(milestone)} people on Tartan — keep it moving!`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: "Tartan" });
        } catch (e) {}
      } else if (navigator.share) {
        try {
          await navigator.share({ text, url: window.location.href });
        } catch (e) {}
      } else {
        download();
      }
    }, "image/png");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-cyan-500/40 sm:max-w-sm" data-testid="milestone-card-modal">
        <div className="flex flex-col items-center gap-4 py-1">
          <div className="flex items-center gap-2 text-amber-300 font-display font-bold">
            <Trophy size={18} /> {t("milestone_reached")}
          </div>
          <canvas
            ref={canvasRef}
            className="w-full max-w-[300px] rounded-2xl border border-cyan-500/30 neon-cyan"
            data-testid="milestone-canvas"
          />
          <div className="flex gap-2 w-full">
            <button
              data-testid="share-milestone-button"
              onClick={share}
              className="flex-1 h-11 rounded-full font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center justify-center gap-2"
            >
              <Share2 size={16} /> {t("share_milestone")}
            </button>
            <button
              data-testid="download-milestone-button"
              onClick={download}
              className="h-11 px-4 rounded-full font-semibold text-cyan-300 border border-cyan-500/40 flex items-center justify-center gap-2 hover:bg-cyan-500/10"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
