import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, Zap, LayoutDashboard, Shield, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { LANG_NAMES } from "@/i18n";

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (user === null) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/login" data-testid="header-login-link" className="text-xs font-semibold text-slate-200 hover:text-cyan-300 px-2 py-1.5">Sign in</Link>
        <Link to="/register" data-testid="header-register-link" className="text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full px-3.5 py-1.5 active:scale-95 transition-transform">Get started</Link>
      </div>
    );
  }

  const initial = (user.org_name || user.name || user.email || "?").charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button data-testid="header-account-button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-slate-700 pl-1 pr-2 py-1 hover:border-cyan-400 transition-colors">
        <span className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center">{initial}</span>
        <ChevronDown size={13} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-700 bg-[#0E1526] shadow-xl overflow-hidden z-50" data-testid="header-account-menu">
          <div className="px-4 py-3 border-b border-slate-700/60">
            <div className="text-sm font-semibold text-white truncate">{user.org_name || user.name || "Account"}</div>
            <div className="text-xs text-slate-400 truncate">{user.email}</div>
          </div>
          <Link to="/studio" data-testid="menu-studio-link" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/60">
            <LayoutDashboard size={15} className="text-cyan-400" /> Creator studio
          </Link>
          {user.role === "admin" && (
            <Link to="/admin" data-testid="menu-admin-link" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/60">
              <Shield size={15} className="text-amber-400" /> Admin
            </Link>
          )}
          <button data-testid="menu-logout-button" onClick={async () => { setOpen(false); await logout(); nav("/"); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/60 border-t border-slate-700/60">
            <LogOut size={15} className="text-rose-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

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
            <div className="font-display font-extrabold text-lg tracking-tight text-white">Tartan</div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80">{t("brand_tag")}</div>
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
          <AccountMenu />
        </div>
      </div>
    </header>
  );
};
