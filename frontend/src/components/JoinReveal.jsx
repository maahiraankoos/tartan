import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { MessageCircle, Copy, ArrowRight, Zap, Check } from "lucide-react";
import { ChainSigil } from "@/components/ChainSigil";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { auraFor } from "@/lib/aura";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export const JoinReveal = ({ open, sparkNumber, chainName, chainSeed, city, shareToken, isInitiator, onContinue }) => {
  const { t } = useApp();
  const [stage, setStage] = useState(0);
  const [copied, setCopied] = useState(false);
  const aura = auraFor(chainSeed);
  const url = `${window.location.origin}/j/${shareToken}`;
  const msg = `${chainName ? chainName + " — " : ""}Join the chain and keep it moving: ${url}`;

  useEffect(() => {
    if (!open) { setStage(0); return; }
    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1300),
      setTimeout(() => {
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 }, colors: [aura.palette.primary, aura.palette.secondary, "#FFB800"] });
        if (navigator.vibrate) navigator.vibrate([12, 40, 18]);
      }, 1350),
      setTimeout(() => setStage(3), 2100),
      setTimeout(() => setStage(4), 2900),
    ];
    if (navigator.vibrate) navigator.vibrate(30);
    return () => timers.forEach(clearTimeout);
  }, [open]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch (e) {}
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-5 overflow-hidden bg-[#05070F]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="join-reveal"
        >
          {/* radial glow layer (opaque base above prevents page bleed-through) */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 38%, rgba(0,240,255,0.14), transparent 62%)" }} />
          {/* shockwave */}
          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full border-2 animate-shockwave" style={{ borderColor: aura.palette.primary }} />

          <div className="relative w-full max-w-sm text-center">
            {/* Spark number */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: stage >= 1 ? 1 : 0 }} className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400 mb-3">
              {isInitiator ? "You started the chain" : "You joined the chain"}
            </motion.p>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={stage >= 1 ? { scale: 1, opacity: 1 } : {}}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="font-unbounded font-black leading-none"
              style={{ color: aura.palette.primary, textShadow: `0 0 30px ${aura.palette.primary}88` }}
            >
              <span className="text-2xl align-top mr-1">⚡</span>
              <span className="text-6xl sm:text-7xl">
                #{stage >= 1 ? <AnimatedNumber value={sparkNumber || 1} format={false} /> : 0}
              </span>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: stage >= 1 ? 1 : 0 }} className="text-slate-300 mt-2">
              in <span className="font-semibold text-white">{chainName}</span>
            </motion.p>

            {/* Sigil */}
            <motion.div
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={stage >= 2 ? { scale: 1, rotate: 0, opacity: 1 } : {}}
              transition={{ type: "spring", stiffness: 140, damping: 14 }}
              className="flex justify-center my-6"
            >
              <ChainSigil seed={chainSeed} size={128} />
            </motion.div>

            {/* City activation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 border text-sm font-semibold ${city && city !== "Remote" ? "" : "hidden"}`}
              style={{ borderColor: aura.palette.secondary + "66", color: aura.palette.secondary, background: aura.palette.secondary + "14" }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full animate-radar" style={{ background: aura.palette.secondary }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: aura.palette.secondary }} />
              </span>
              NODE ACTIVATED · {city || "Remote"}
            </motion.div>

            {/* Share launchpad */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={stage >= 4 ? { opacity: 1, y: 0 } : {}}
              className="mt-8 space-y-3"
            >
              <p className="text-xs text-slate-400">{isInitiator ? "Now share it. Send the first invite." : "Now share your link so the chain keeps growing."}</p>
              <a
                data-testid="reveal-whatsapp-button"
                href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full h-13 py-3.5 rounded-full font-display font-bold text-slate-950 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                style={{ background: `linear-gradient(90deg, ${aura.palette.primary}, ${aura.palette.secondary})` }}
              >
                <MessageCircle size={18} /> Share to WhatsApp
              </a>
              <div className="flex gap-2">
                <button
                  data-testid="reveal-copy-button"
                  onClick={copy}
                  className="flex-1 h-12 rounded-full font-semibold text-cyan-300 border border-cyan-500/40 flex items-center justify-center gap-2 hover:bg-cyan-500/10 active:scale-[0.97] transition-all"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} {t("copy_link")}
                </button>
                <button
                  data-testid="reveal-continue-button"
                  onClick={onContinue}
                  className="flex-1 h-12 rounded-full font-semibold text-slate-300 border border-slate-700 flex items-center justify-center gap-2 hover:border-slate-500 active:scale-[0.97] transition-all"
                >
                  My branch <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
