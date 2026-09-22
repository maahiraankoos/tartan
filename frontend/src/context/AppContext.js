import React, { createContext, useContext, useState, useCallback } from "react";
import { translate } from "@/i18n";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("tartan_lang") || "EN");

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "EN" ? "SO" : "EN";
      localStorage.setItem("tartan_lang", next);
      return next;
    });
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);

  return (
    <AppContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// persist / read "my membership" per tartan
export function saveMembership(tartanToken, shareToken) {
  try {
    const map = JSON.parse(localStorage.getItem("tartan_memberships") || "{}");
    map[tartanToken] = shareToken;
    localStorage.setItem("tartan_memberships", JSON.stringify(map));
  } catch (e) {}
}

export function getMembership(tartanToken) {
  try {
    const map = JSON.parse(localStorage.getItem("tartan_memberships") || "{}");
    return map[tartanToken] || null;
  } catch (e) {
    return null;
  }
}
