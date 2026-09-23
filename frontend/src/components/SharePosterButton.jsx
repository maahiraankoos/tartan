import React from "react";
import { Share2, Sparkles } from "lucide-react";
import { shareChain } from "@/lib/helpers";
import { toast } from "sonner";

// Primary one-tap "Share my poster" CTA. The shared link unfurls into the
// live server-rendered poster in every link preview.
export const SharePosterButton = ({ shareToken, reach = 0, tartanTitle, variant = "hero", className = "", label = "Share my poster" }) => {
  const onClick = async () => {
    const res = await shareChain({ token: shareToken, reach, tartanTitle });
    if (res === "copied") toast.success("Link copied — it opens as your poster");
    else if (res === "failed") toast.error("Could not share. Try copying your link.");
  };

  if (variant === "hero") {
    return (
      <button
        data-testid="share-poster-primary"
        onClick={onClick}
        className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-3 text-slate-950 font-unbounded font-bold active:scale-[0.98] transition-transform bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-[length:200%_auto] hover:bg-[position:right_center] ${className}`}
        style={{ transition: "background-position .6s ease, transform .1s ease" }}
      >
        <span className="absolute inset-0 bg-white/25 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/15">
          <Share2 size={22} />
        </span>
        <span className="relative text-left leading-tight">
          <span className="block text-lg">{label}</span>
          <span className="block text-[11px] font-semibold text-slate-950/70 flex items-center gap-1">
            <Sparkles size={11} /> Your link opens as a live poster
          </span>
        </span>
      </button>
    );
  }

  // compact pill
  return (
    <button
      data-testid="share-poster-primary"
      onClick={onClick}
      className={`flex items-center gap-2 h-11 px-5 rounded-full font-display font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-[0.97] transition-transform ${className}`}
    >
      <Share2 size={17} /> {label}
    </button>
  );
};
