import { describe, it, expect } from "vitest";
import { lanczosScale } from "./lanczos";

// Imagen ALTA (600px) para activar multiples tiles verticales (>256px).
// Canal verde = posicion de fila (0 arriba .. 255 abajo).
function makeImage(w: number, h: number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = (x / (w - 1)) * 255;       // rojo = columna
    rgba[i + 1] = (y / (h - 1)) * 255;   // verde = fila
    rgba[i + 2] = 128;
    rgba[i + 3] = 255;
  }
  return { rgba, width: w, height: h };
}

describe("escalado de imagen alta (bug corte por tiles)", () => {
  it("4x600 -> 8x1200 sin filas negras (no se corta)", () => {
    const src = makeImage(4, 600);
    const res = lanczosScale(src, 2);
    expect(res.width).toBe(8);
    expect(res.height).toBe(1200);
    const xs = 4; // columna central
    let black = 0;
    for (let yy = 0; yy < res.height; yy++) {
      const o = (yy * res.width + xs) * 4;
      if (res.rgba[o + 1] === 0 && res.rgba[o] === 0) black++;
    }
    expect(black).toBe(0);
    // gradiente verde creciente hacia abajo
    const g0 = res.rgba[(0 * res.width + xs) * 4 + 1];
    const gLast = res.rgba[((res.height - 1) * res.width + xs) * 4 + 1];
    expect(gLast).toBeGreaterThan(g0);
  });

  it("tamano de salida correcto para varias escalas", () => {
    for (const sc of [1.5, 2, 3, 4, 8]) {
      const src = makeImage(100, 800);
      const res = lanczosScale(src, sc);
      expect(res.width).toBe(Math.round(100 * sc));
      expect(res.height).toBe(Math.round(800 * sc));
    }
  });
});
