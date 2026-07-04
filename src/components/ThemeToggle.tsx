"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getStoredTheme, resolveDark, storeTheme, type ThemePreference } from "@/lib/theme";

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme();
    setPreference(stored);
    applyTheme(stored);
  }, []);

  const toggle = () => {
    const currentlyDark = resolveDark(preference);
    const next: ThemePreference = currentlyDark ? "light" : "dark";
    setPreference(next);
    storeTheme(next);
    applyTheme(next);
  };

  if (!mounted) return <div className="w-9 h-9" />;

  const isDark = resolveDark(preference);

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Prepnúť na svetlú tému" : "Prepnúť na tmavú tému"}
      title={preference === "system" ? "Téma podľa zariadenia" : undefined}
      className="w-9 h-9 rounded-xl flex items-center justify-center border border-brand-border text-brand-muted hover:border-brand-orange hover:text-brand-orange transition-all duration-200"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
