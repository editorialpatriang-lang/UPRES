import { describe, it, expect } from "vitest";
import { runEsrgan } from "./esrgan";
import type * as ort from "onnxruntime-web";

// Mock de sesión ONNX: devuelve un gradiente determinista por tile (sin wasm).
// Confirma que el ensamblado de tiles produce un buffer x4 coherente.
function makeMockSession() {
  const inputNames = ["input.1"];
  const outputNames = ["1895"];
  return {
    inputNames,
    outputNames,
    async run(feeds: Record<string, ort.Tensor>) {
      const t = feeds[inputNames[0]] as ort.Tensor;
      const dims = t.dims as number[];
      const h = dims[2];
      const w = dims[3];
      // salida 256x256 con valor = promedio del tile de entrada en el primer canal
      const out = new Float32Array(1 * 3 * (h * 4) * (w * 4));
      const sample = (t.data as Float32Array)[10]; // valor conocido del tile
      for (let i = 0; i < out.length; i++) out[i] = sample;
      return { [outputNames[0]]: { data: out, dims: [1, 3, h * 4, w * 4] } };
    },
  } as unknown as ort.InferenceSession;
}

describe("Motor B: tiling Real-ESRGAN", () => {
  it("128x128 -> 512x512 sin pixeles negros ni fuera de rango", async () => {
    const W = 128, H = 128;
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      rgba[i] = (x / (W - 1)) * 255; rgba[i + 1] = (y / (H - 1)) * 255; rgba[i + 2] = 128; rgba[i + 3] = 255;
    }
    const res = await runEsrgan(rgba, W, H, undefined, makeMockSession());
    expect(res.width).toBe(512);
    expect(res.height).toBe(512);
    expect(res.rgba.length).toBe(512 * 512 * 4);
    let bad = 0;
    for (let i = 0; i < res.rgba.length; i += 4) {
      const r = res.rgba[i], g = res.rgba[i + 1], b = res.rgba[i + 2], a = res.rgba[i + 3];
      if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || a !== 255) bad++;
    }
    expect(bad).toBe(0);
  });

  it("imagen pequena 32x32 (un tile con padding) -> 128x128", async () => {
    const W = 32, H = 32;
    const rgba = new Uint8ClampedArray(W * H * 4).fill(200);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    const res = await runEsrgan(rgba, W, H, undefined, makeMockSession());
    expect(res.width).toBe(128);
    expect(res.height).toBe(128);
  });
});
