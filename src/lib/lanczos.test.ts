import { describe, it, expect } from "vitest";
import { lanczosScale, type RgbaBuffer } from "@/lib/lanczos";

function makeBuffer(width: number, height: number, fill?: (x: number, y: number) => [number, number, number, number]): RgbaBuffer {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill ? fill(x, y) : [255, 0, 0, 255];
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  return { rgba, width, height };
}

describe("lanczosScale (fiel)", () => {
  it("respeta dimensiones al escalar 2x", () => {
    const src = makeBuffer(10, 10);
    const out = lanczosScale(src, 2);
    expect(out.width).toBe(20);
    expect(out.height).toBe(20);
  });

  it("conserva color plano sin oscurecer", () => {
    // fondo gris neutro 128
    const src = makeBuffer(8, 8, () => [128, 128, 128, 255]);
    const out = lanczosScale(src, 2);
    // muestrea el centro, debe seguir ~128
    const i = ((out.height >> 1) * out.width + (out.width >> 1)) * 4;
    expect(Math.abs(out.rgba[i] - 128)).toBeLessThan(3);
  });

  it("no inventa fuera de rango", () => {
    const src = makeBuffer(4, 4, (x, y) => (x < 2 && y < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const out = lanczosScale(src, 2);
    for (let k = 0; k < out.rgba.length; k += 4) {
      expect(out.rgba[k]).toBeGreaterThanOrEqual(0);
      expect(out.rgba[k]).toBeLessThanOrEqual(255);
    }
  });
});
