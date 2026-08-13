"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Download, Loader2, Image as ImageIcon, Sparkles, Scale } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { loadImageFile, downloadRgba, rgbaToPngDataUrl } from "@/lib/image";
import LogoEdipa from "@/components/LogoEdipa";
import type { ScaleRequest, ScaleResponse } from "@/workers/scale.worker";

export default function Home() {
  const { image, scale, mode, status, result, setImage, setScale, setMode, setStatus, setResult, setError } =
    useStudioStore();
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState(0);
  const [origUrl, setOrigUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => {
    workerRef.current = new Worker(new URL("@/workers/scale.worker.ts", import.meta.url));
    workerRef.current.onmessage = (e: MessageEvent<ScaleResponse>) => {
      if (e.data.type === "progress") setProgress(e.data.value);
      else if (e.data.type === "done") {
        setResult(e.data.result);
        setProgress(1);
      }
    };
    return () => workerRef.current?.terminate();
  }, [setResult]);

  useEffect(() => {
    if (image) setOrigUrl(rgbaToPngDataUrl(image));
  }, [image]);

  useEffect(() => {
    if (result) setResultUrl(rgbaToPngDataUrl(result));
  }, [result]);

  const onFile = async (file: File) => {
    setStatus("idle");
    setResult(null);
    try {
      const img = await loadImageFile(file);
      setImage(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la imagen");
    }
  };

  const run = () => {
    if (!image || mode !== "faithful") return;
    setStatus("processing");
    setProgress(0);
    const req: ScaleRequest = {
      rgba: image.rgba,
      width: image.width,
      height: image.height,
      scale,
    };
    workerRef.current?.postMessage(req);
  };

  const outW = image ? Math.round(image.width * scale) : 0;
  const outH = image ? Math.round(image.height * scale) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div className="flex items-center gap-2">
          <LogoEdipa className="h-9 w-auto text-[#322e64] dark:text-white" />
          <div className="leading-tight">
            <h1 className="text-sm font-bold">UPRES</h1>
            <p className="text-[10px] text-[hsl(var(--text-muted))]">Ampliador de resolución EDIPA</p>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-raised))] p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-sm font-medium text-[hsl(var(--accent-fg))]">
          <Upload size={16} /> Cargar imagen
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        <div className="flex items-center gap-2">
          <Scale size={16} className="text-[hsl(var(--text-muted))]" />
          <span className="text-sm">Factor</span>
          <input
            type="range"
            min={1.5}
            max={8}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-40"
          />
          <span className="w-10 font-mono text-sm">{scale}x</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-1">
          <button
            onClick={() => setMode("faithful")}
            className={`rounded px-3 py-1.5 text-sm ${mode === "faithful" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}`}
          >
            Fiel (Lanczos)
          </button>
          <button
            onClick={() => setMode("ai")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${mode === "ai" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}`}
          >
            <Sparkles size={14} /> IA (próximamente)
          </button>
        </div>

        <button
          onClick={run}
          disabled={!image || status === "processing" || mode !== "faithful"}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-fg))] disabled:opacity-40"
        >
          {status === "processing" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          Ampliar
        </button>
      </section>

      {mode === "ai" && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          El modo IA (Real-ESRGAN) aún no está conectado. Cuando esté listo, reconstruye detalle
          (no es fiel al original). Por ahora usa el modo Fiel.
        </p>
      )}

      <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <Preview title="Original" url={origUrl} w={image?.width} h={image?.height} empty={!image} />
        <Preview
          title="Ampliada"
          url={resultUrl}
          w={outW}
          h={outH}
          empty={!result}
          busy={status === "processing"}
          progress={progress}
          onDownload={() => result && downloadRgba(result, `upres-${outW}x${outH}.png`)}
        />
      </section>
    </main>
  );
}

function Preview({
  title,
  url,
  w,
  h,
  empty,
  busy,
  progress,
  onDownload,
}: {
  title: string;
  url: string;
  w?: number;
  h?: number;
  empty: boolean;
  busy?: boolean;
  progress?: number;
  onDownload?: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-raised))] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          {title}
        </span>
        <span className="font-mono text-[10px] text-[hsl(var(--text-muted))]">
          {w && h ? `${w} × ${h}` : ""}
        </span>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--surface))] p-2">
        {empty ? (
          <span className="text-xs text-[hsl(var(--text-muted))]">Sin imagen</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-[60vh] max-w-full object-contain" />
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <Loader2 className="animate-spin text-white" />
            <span className="mt-2 text-xs text-white">{Math.round((progress ?? 0) * 100)}%</span>
          </div>
        )}
      </div>
      {onDownload && !empty && !busy && (
        <button
          onClick={onDownload}
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--border))] py-1.5 text-xs text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-hover))]"
        >
          <Download size={14} /> Descargar PNG
        </button>
      )}
    </div>
  );
}
