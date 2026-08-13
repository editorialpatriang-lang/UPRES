"use client";

import type { RgbaBuffer } from "./lanczos";
import type { OutputFormat } from "@/store/useStudioStore";

/** Carga un File (PNG/JPG/WEBP/BMP) en un buffer RGBA. */
export async function loadImageFile(file: File): Promise<RgbaBuffer & { name: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bitmap, 0, 0);
  const data = g.getImageData(0, 0, width, height);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();
  return { rgba: data.data, width, height, name: file.name };
}

/** Dibuja un buffer RGBA en un canvas 2D. */
function bufToCanvas(buf: RgbaBuffer): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(buf.rgba as Uint8ClampedArray, buf.width, buf.height), 0, 0);
  return canvas;
}

/** Convierte un buffer RGBA a data URL en el formato indicado. */
export function rgbaToDataUrl(
  buf: RgbaBuffer,
  format: OutputFormat = "png",
  quality = 0.92
): string {
  const canvas = bufToCanvas(buf);
  const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
  return canvas.toDataURL(mime, quality);
}

/** Convierte un buffer RGBA a data URL PNG (sin pérdida). Conservado por compatibilidad. */
export function rgbaToPngDataUrl(buf: RgbaBuffer): string {
  return rgbaToDataUrl(buf, "png");
}

/** Descarga un buffer en el formato indicado. */
export function downloadRgba(
  buf: RgbaBuffer,
  filename: string,
  format: OutputFormat = "png",
  quality = 0.92
): void {
  const url = rgbaToDataUrl(buf, format, quality);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
