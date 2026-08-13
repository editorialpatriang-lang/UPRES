import { describe, it, expect } from "vitest";
import { lanczosScale } from "./lanczos";

function makeImage(w: number, h: number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = (x / (w - 1)) * 255;
    rgba[i + 1] = (y / (h - 1)) * 255;
    rgba[i + 2] = 128;
    rgba[i + 3] = 255;
  }
  return { rgba, width: w, height: h };
}

describe("parametro sharpness (Lanczos)", () => {
  it("sharpness=1 produce salida valida y tamano correcto", () => {
    const src = makeImage(40, 40);
    const res = lanczosScale(src, 2, undefined, 1);
    expect(res.width).toBe(80);
    expect(res.height).toBe(80);
    expect(res.rgba.length).toBe(80 * 80 * 4);
  });

  it("sharpness > 1 y < 1 producen resultados distintos (modula el kernel)", () => {
    const src = makeImage(40, 40);
    const soft = lanczosScale(src, 2, undefined, 0.7);
    const sharp = lanczosScale(src, 2, undefined, 1.6);
    let diff = 0;
    for (let i = 0; i < soft.rgba.length; i++) diff += Math.abs(soft.rgba[i] - sharp.rgba[i]);
    expect(diff).toBeGreaterThan(0);
  });

  it("sharpness extremo sigue sin romperse (sin NaN)", () => {
    const src = makeImage(20, 600); // imagen alta: ejercita tiles
    const res = lanczosScale(src, 2, undefined, 1.8);
    expect(res.height).toBe(1200);
    let nan = 0;
    for (let i = 0; i < res.rgba.length; i++) if (Number.isNaN(res.rgba[i])) nan++;
    expect(nan).toBe(0);
  });
});
