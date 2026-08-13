"use client";

import { create } from "zustand";

export type Mode = "faithful" | "ai";
export type Theme = "dark" | "light";

interface UpresState {
  image: { rgba: Uint8ClampedArray; width: number; height: number; name: string } | null;
  scale: number;
  mode: Mode;
  theme: Theme;
  status: "idle" | "processing" | "done" | "error";
  result: { rgba: Uint8ClampedArray; width: number; height: number } | null;
  error: string | null;
  setImage: (img: UpresState["image"]) => void;
  setScale: (s: number) => void;
  setMode: (m: Mode) => void;
  setTheme: (t: Theme) => void;
  setStatus: (s: UpresState["status"]) => void;
  setResult: (r: UpresState["result"]) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useStudioStore = create<UpresState>((set) => ({
  image: null,
  scale: 2,
  mode: "faithful",
  theme: "light",
  status: "idle",
  result: null,
  error: null,
  setImage: (image) => set({ image, result: null, status: "idle", error: null }),
  setScale: (scale) => set({ scale, result: null }),
  setMode: (mode) => set({ mode, result: null }),
  setTheme: (theme) => set({ theme }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result, status: "done" }),
  setError: (error) => set({ error, status: "error" }),
  reset: () => set({ image: null, result: null, status: "idle", error: null }),
}));
