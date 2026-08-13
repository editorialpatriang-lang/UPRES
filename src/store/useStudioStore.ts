"use client";

import { create } from "zustand";

export type Mode = "faithful" | "ai";
export type Theme = "dark" | "light";
export type OutputFormat = "png" | "webp" | "jpeg";
export type CompareMode = "side" | "slider";

interface UpresState {
  image: { rgba: Uint8ClampedArray; width: number; height: number; name: string } | null;
  scale: number;
  mode: Mode;
  theme: Theme;
  status: "idle" | "processing" | "done" | "error";
  result: { rgba: Uint8ClampedArray; width: number; height: number } | null;
  error: string | null;
  /** Formato de archivo de salida al descargar. */
  format: OutputFormat;
  /** Calidad 0..1 (solo webp/jpeg). */
  quality: number;
  /** Nitidez del Lanczos (1 = neutro, >1 refuerza el kernel). */
  sharpness: number;
  /** Modo de comparación de previsualización. */
  compare: CompareMode;
  setImage: (img: UpresState["image"]) => void;
  setScale: (s: number) => void;
  setMode: (m: Mode) => void;
  setTheme: (t: Theme) => void;
  setStatus: (s: UpresState["status"]) => void;
  setResult: (r: UpresState["result"]) => void;
  setError: (e: string | null) => void;
  setFormat: (f: OutputFormat) => void;
  setQuality: (q: number) => void;
  setSharpness: (s: number) => void;
  setCompare: (c: CompareMode) => void;
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
  format: "png",
  quality: 0.92,
  sharpness: 1,
  compare: "side",
  setImage: (image) => set({ image, result: null, status: "idle", error: null }),
  setScale: (scale) => set({ scale, result: null }),
  setMode: (mode) => set({ mode, result: null }),
  setTheme: (theme) => set({ theme }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result, status: "done" }),
  setError: (error) => set({ error, status: "error" }),
  setFormat: (format) => set({ format }),
  setQuality: (quality) => set({ quality }),
  setSharpness: (sharpness) => set({ sharpness, result: null }),
  setCompare: (compare) => set({ compare }),
  reset: () => set({ image: null, result: null, status: "idle", error: null }),
}));
