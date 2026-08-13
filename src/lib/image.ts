"use client";

import type { RgbaBuffer } from "./lanczos";

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

/** Convierte un buffer RGBA a data URL PNG (sin pérdida). */
export function rgbaToPngDataUrl(buf: RgbaBuffer): string {
  const canvas = document.createElement("canvas");
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(buf.rgba as Uint8ClampedArray, buf.width, buf.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** Descarga un buffer como archivo PNG. */
export function downloadRgba(buf: RgbaBuffer, filename: string): void {
  const url = rgbaToPngDataUrl(buf);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
