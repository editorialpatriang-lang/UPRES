"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Download, Loader2, Image as ImageIcon, Sparkles, Scale, Maximize2 } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { loadImageFile, downloadRgba, rgbaToDataUrl } from "@/lib/image";
import LogoEdipa from "@/components/LogoEdipa";
import CompareSlider from "@/components/CompareSlider";
import type { ScaleRequest, ScaleResponse } from "@/workers/scale.worker";
import type { AiRequest, AiResponse } from "@/workers/ai.worker";

export default function Home() {
  const { image, scale, mode, status, result, error, format, quality, sharpness, compare, setImage, setScale, setMode, setStatus, setResult, setError, setFormat, setQuality, setSharpness, setCompare } =
    useStudioStore();
  const workerRef = useRef<Worker | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState(0);
  const [origUrl, setOrigUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [modelMsg, setModelMsg] = useState("");

  useEffect(() => {
    workerRef.current = new Worker(new URL("@/workers/scale.worker.ts", import.meta.url));
    workerRef.current.onmessage = (e: MessageEvent<ScaleResponse>) => {
      if (e.data.type === "progress") setProgress(e.data.value);
      else if (e.data.type === "done") {
        setResult(e.data.result);
        setProgress(1);
      }
    };
    aiWorkerRef.current = new Worker(new URL("@/workers/ai.worker.ts", import.meta.url));
    aiWorkerRef.current.onmessage = (e: MessageEvent<AiResponse>) => {
      if (e.data.type === "progress") setProgress(e.data.value);
      else if (e.data.type === "done") {
        setResult(e.data.result);
        setProgress(1);
        setModelMsg("");
      } else if (e.data.type === "error") {
        setError(e.data.message);
        setStatus("error");
        setModelMsg("");
      }
    };
    return () => {
      workerRef.current?.terminate();
      aiWorkerRef.current?.terminate();
    };
  }, [setResult]);

  useEffect(() => {
    if (image) setOrigUrl(rgbaToDataUrl(image, "png"));
  }, [image]);

  useEffect(() => {
    if (result) setResultUrl(rgbaToDataUrl(result, "png"));
  }, [result]);

  const handleFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setStatus("idle");
    setResult(null);
    try {
      const img = await loadImageFile(file);
      setImage(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la imagen");
    }
  };

  // Pegar desde el portapapeles
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const run = () => {
    if (!image) return;
    setStatus("processing");
    setProgress(0);
    if (mode === "ai") {
      setModelMsg("Descargando modelo Real-ESRGAN (una sola vez)…");
      const req: AiRequest = { rgba: image.rgba, width: image.width, height: image.height };
      aiWorkerRef.current?.postMessage(req);
    } else {
      const req: ScaleRequest = {
        rgba: image.rgba,
        width: image.width,
        height: image.height,
        scale,
        sharpness,
      };
      workerRef.current?.postMessage(req);
    }
  };

  const outW = image ? Math.round(image.width * (mode === "ai" ? 4 : scale)) : 0;
  const outH = image ? Math.round(image.height * (mode === "ai" ? 4 : scale)) : 0;

  const onDownload = () => {
    if (!result || !image) return;
    const ext = format === "png" ? "png" : format === "webp" ? "webp" : "jpg";
    const base = image.name.replace(/\.[^.]+$/, "");
    const effScale = mode === "ai" ? 4 : scale;
    downloadRgba(result, `${base}-upres-${Math.round(image.width * effScale)}x${Math.round(image.height * effScale)}.${ext}`, format, quality);
  };

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
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-sm font-medium text-[hsl(var(--accent-fg))]`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <Upload size={16} /> Cargar imagen
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

        <div className="flex items-center gap-2">
          <Scale size={16} className="text-[hsl(var(--text-muted))]" />
          <span className="text-sm">Factor</span>
          {mode === "ai" ? (
            <span className="w-10 font-mono text-sm">4x</span>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-1">
          <button
            onClick={() => setMode("faithful")}
            className={`rounded px-3 py-1.5 text-sm ${mode === "faithful" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}}`}
          >
            Fiel (Lanczos)
          </button>
          <button
            onClick={() => setMode("ai")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${mode === "ai" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}}`}
          >
            <Sparkles size={14} /> IA (Real-ESRGAN)
          </button>
        </div>

        <button
          onClick={run}
          disabled={!image || status === "processing"}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-fg))] disabled:opacity-40"
        >
          {status === "processing" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          Ampliar
        </button>
      </section>

      {mode === "ai" && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          El modo IA usa <strong>Real-ESRGAN x4</strong> en tu navegador (descarga el modelo una vez,
          luego funciona sin conexión). Reconstruye detalle, pero no es fiel al original. El factor de
          salida es fijo 4x.
          {modelMsg ? ` ${modelMsg}` : ""}
        </p>
      )}

      {image && (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-raised))] p-4">
          {/* Nitidez (solo fiel) */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Nitidez</span>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={sharpness}
              onChange={(e) => setSharpness(Number(e.target.value))}
              className="w-32"
            />
            <span className="w-10 font-mono text-sm">{sharpness.toFixed(2)}</span>
          </div>

          {/* Formato de salida */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Formato</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "png" | "webp" | "jpeg")}
              className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-sm"
            >
              <option value="png">PNG (sin pérdida)</option>
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>

          {format !== "png" && (
            <div className="flex items-center gap-2">
              <span className="text-sm">Calidad</span>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-32"
              />
              <span className="w-10 font-mono text-sm">{Math.round(quality * 100)}%</span>
            </div>
          )}

          {/* Toggle comparador */}
          <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-1">
            <button
              onClick={() => setCompare("side")}
              className={`rounded px-2 py-1 text-xs ${compare === "side" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}`}
            >
              Lado a lado
            </button>
            <button
              onClick={() => setCompare("slider")}
              className={`rounded px-2 py-1 text-xs ${compare === "slider" ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]" : "text-[hsl(var(--text-muted))]"}`}
            >
              Deslizante
            </button>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{error}</p>}

      {result && (
        <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {compare === "slider" ? (
            <div className="md:col-span-2">
              <CompareSlider beforeUrl={origUrl} afterUrl={resultUrl} />
            </div>
          ) : (
            <>
              <Preview title="Original" url={origUrl} w={image?.width} h={image?.height} empty={!image} />
              <Preview
                title="Ampliada"
                url={resultUrl}
                w={outW}
                h={outH}
                empty={!result}
                busy={status === "processing"}
                progress={progress}
                onDownload={onDownload}
              />
            </>
          )}
          {compare === "slider" && (
            <div className="md:col-span-2 flex justify-center">
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--surface-hover))]"
              >
                <Download size={14} /> Descargar {format.toUpperCase()}
              </button>
            </div>
          )}
        </section>
      )}

      {!result && image && (
        <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <Preview title="Original" url={origUrl} w={image?.width} h={image?.height} empty={!image} />
          <Preview title="Ampliada" url="" w={outW} h={outH} empty busy={status === "processing"} progress={progress} />
        </section>
      )}

      {!image && (
        <section
          className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? "border-[hsl(var(--accent))] bg-[hsl(var(--surface-hover))]" : "border-[hsl(var(--border))]"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <ImageIcon size={32} className="text-[hsl(var(--text-muted))]" />
          <p className="text-sm text-[hsl(var(--text-muted))]">
            Arrastra una imagen aquí, pégala (Ctrl+V) o usa “Cargar imagen”.
          </p>
        </section>
      )}
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
  // Zoom/paneo por rueda y arrastre dentro de la previsualización.
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [url]);

  return (
    <div className="flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-raised))] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[hsl(var(--text-muted))]">
            {w && h ? `${w} × ${h}` : ""}
          </span>
          {!empty && url && (
            <>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="rounded border border-[hsl(var(--border))] px-1.5 text-xs"
                title="Acercar"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                className="rounded border border-[hsl(var(--border))] px-1.5 text-xs"
                title="Alejar"
              >
                −
              </button>
              <button
                onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
                className="rounded border border-[hsl(var(--border))] px-1.5 text-xs"
                title="Ajustar"
              >
                <Maximize2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--surface))] p-2"
        onWheel={(e) => {
          if (!empty && url) {
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            setZoom((z) => Math.max(1, Math.min(4, +(z + delta).toFixed(2))));
          }
        }}
        onPointerDown={(e) => {
          if (zoom > 1) {
            drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onPointerUp={() => { drag.current = null; }}
      >
        {empty ? (
          <span className="text-xs text-[hsl(var(--text-muted))]">{busy ? "Procesando…" : "Sin imagen"}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="max-h-[60vh] max-w-full object-contain"
            style={{ transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`, cursor: zoom > 1 ? "grab" : "default" }}
            draggable={false}
          />
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <Loader2 className="animate-spin text-white" />
            <span className="mt-2 text-xs text-white">{Math.round((progress ?? 0) * 100)}%</span>
          </div>
        )}
      </div>
      {onDownload && !empty && (
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
