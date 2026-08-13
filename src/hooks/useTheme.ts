"use client";

import { useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";

const KEY = "upres-theme";

export function useTheme(): void {
  const theme = useStudioStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* sin persistencia */
    }
  }, [theme]);

  useEffect(() => {
    let initial: "dark" | "light" = "light";
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark") initial = stored;
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) initial = "dark";
    } catch {
      /* ok */
    }
    if (initial !== "light") useStudioStore.getState().setTheme(initial);
  }, []);
}
