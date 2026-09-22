import React from "react";
import { Link } from "react-router-dom";
import { Globe, Zap } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { LANG_NAMES } from "@/i18n";

export const Header = () => {
  const { lang, toggleLang, t } = useApp();
  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" data-testid="brand-home-link" className="flex items-center gap-2 group">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-cyan-400 animate-ping-slow" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400 neon-cyan" />
          </span>
          <div className="leading-none">
            <div className="font-display font-extrabold text-lg tracking-tight text-white">
              Tartan
            </div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80">
              {t("brand_tag")}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-1 bg-emerald-500/10">
            <Zap size={12} className="fill-emerald-400" />
            {t("live")}
          </span>
          <button
            data-testid="language-toggle-button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 border border-slate-700 rounded-full px-3 py-1.5 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
            title={LANG_NAMES[lang === "EN" ? "SO" : "EN"]}
          >
            <Globe size={13} />
            {lang}
          </button>
        </div>
      </div>
    </header>
  );
};
