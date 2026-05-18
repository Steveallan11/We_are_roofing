"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("war_theme") as Theme | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggle: () => {
        const next = theme === "dark" ? "light" : "dark";
        setThemeState(next);
        localStorage.setItem("war_theme", next);
        document.documentElement.setAttribute("data-theme", next);
      },
      setTheme: (next: Theme) => {
        setThemeState(next);
        localStorage.setItem("war_theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
