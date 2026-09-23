import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import { ChainSigil } from "@/components/ChainSigil";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useApp } from "@/context/AppContext";

export const MilestoneTakeover = ({ data, seed, onClose }) => {
  const { t } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setOpen(true);
    const fire = () => confetti({ particleCount: 180, spread: 110, origin: { y: 0.4 }, colors: ["#00F0FF", "#00FF66", "#FFB800"] });
    fire();
    setTimeout(fire, 400);
    if (navigator.vibrate) navigator.vibrate([15, 50, 25]);
    const timer = setTimeout(() => { setOpen(false); onClose && onClose(); }, 6000);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center px-6 bg-[#05070F]/95 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="milestone-takeover"
          onClick={() => { setOpen(false); onClose && onClose(); }}
        >
          <button className="absolute top-5 right-5 text-slate-400 hover:text-white" data-testid="takeover-close"><X size={22} /></button>
          <div className="text-center">
            <motion.div initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 12 }} className="flex justify-center mb-6">
              <ChainSigil seed={seed} size={120} />
            </motion.div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">{t("chain_hit")}</p>
            <div className="font-unbounded font-black text-7xl sm:text-8xl text-white my-2" style={{ textShadow: "0 0 40px rgba(0,240,255,0.5)" }}>
              <AnimatedNumber value={data.value} format={false} />
            </div>
            <p className="text-slate-300 text-lg">{t("people_reached")}</p>
            <p className="text-slate-500 mt-4 text-sm">{data.title}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
