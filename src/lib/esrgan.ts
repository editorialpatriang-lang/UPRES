import * as ort from "onnxruntime-web";

/**
 * Motor B — Super-resolución Real-ESRGAN x4 (en navegador, wasm).
 *
 * El modelo exportado (imgdesignart/realesrgan-x4-onnx) tiene entrada FIJA de
 * 64x64 y produce 256x256 (x4). Para imágenes arbitrarias procesamos en TILES de
 * 64x64 con solapamiento (overlap) para que las costuras no se noten, y ensamblamos
 * las salidas de 256x256 en el buffer final.
 *
 * El modelo espera input en rango [0,1] (RGB normalizado) y entrega [0,1].
 */

const TILE = 64; // entrada del modelo
const OVERLAP = 16; // solapamiento para evitar seams
const MODEL_URL =
  "https://huggingface.co/imgdesignart/realesrgan-x4-onnx/resolve/main/onnx/model.onnx";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/** Carga (una vez) la sesión de ONNX. `onModelProgress` reporta 0..1 de descarga. */
export async function getSession(
  onModelProgress?: (p: number) => void
): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;
  // Configura los wasm. Por defecto usa el CDN de onnxruntime-web (no infla el
  // bundle). Si ya estaba configurado (ej. test local), se respeta.
  if (!ort.env.wasm.wasmPaths) {
    ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
  }
  sessionPromise = (async () => {
    const buf = await downloadWithProgress(MODEL_URL, onModelProgress);
    return await ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
  })();
  return sessionPromise;
}

async function downloadWithProgress(
  url: string,
  onProgress?: (p: number) => void
): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudo descargar el modelo (${resp.status})`);
  const total = Number(resp.headers.get("content-length") ?? 0);
  if (!resp.body || !total) return await resp.arrayBuffer();
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received / total);
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out.buffer;
}

interface Tile {
  sx: number;
  sy: number;
  inX: number;
  inY: number;
  w: number;
  h: number;
}

/** Calcula los tiles de entrada (con overlap) que cubren la imagen. */
function computeTiles(w: number, h: number): Tile[] {
  const tiles: Tile[] = [];
  for (let sy = 0; sy < h; sy += TILE - OVERLAP) {
    for (let sx = 0; sx < w; sx += TILE - OVERLAP) {
      const ww = Math.min(TILE, w - sx);
      const hh = Math.min(TILE, h - sy);
      tiles.push({ sx, sy, inX: sx, inY: sy, w: ww, h: hh });
    }
  }
  return tiles;
}

/** Extrae un tile 64x64 (con padding de borde si hace falta) en tensor NCHW [0,1]. */
function tileToTensor(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  t: Tile
): ort.Tensor {
  const data = new Float32Array(1 * 3 * TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      // fuera del borde real => replicamos el ultimo pixel (edge padding)
      const srcX = Math.min(w - 1, t.sx + x);
      const srcY = Math.min(h - 1, t.sy + y);
      const si = (srcY * w + srcX) * 4;
      const di = y * TILE + x;
      data[di] = rgba[si] / 255;
      data[1 * TILE * TILE + di] = rgba[si + 1] / 255;
      data[2 * TILE * TILE + di] = rgba[si + 2] / 255;
    }
  }
  return new ort.Tensor("float32", data, [1, 3, TILE, TILE]);
}

/** Ejecuta Real-ESRGAN sobre un buffer RGBA y devuelve la imagen x4.
 *  @param session sesión ONNX ya creada (opcional; si no se pasa, se crea una). */
export async function runEsrgan(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  onProgress?: (p: number) => void,
  session?: ort.InferenceSession
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const sess = session ?? (await getSession((p) => onProgress?.(p * 0.4))); // 40% descarga
  const ow = w * 4;
  const oh = h * 4;
  const out = new Uint8ClampedArray(ow * oh * 4);
  const tiles = computeTiles(w, h);
  const stepBase = session ? 0 : 0.4; // los tiles van del 40% al 100% solo si creamos sesion

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const tensor = tileToTensor(rgba, w, h, t);
    const res = await sess.run({ [sess.inputNames[0]]: tensor });
    const outData = res[sess.outputNames[0]].data as Float32Array;
    // outData es [1,3,256,256]; pegamos en out con offset segun tile (x4).
    const outX = t.sx * 4;
    const outY = t.sy * 4;
    for (let y = 0; y < TILE * 4; y++) {
      for (let x = 0; x < TILE * 4; x++) {
        const dx = outX + x;
        const dy = outY + y;
        if (dx >= ow || dy >= oh) continue;
        const oi = (dy * ow + dx) * 4;
        const di = y * (TILE * 4) + x;
        out[oi] = clamp255(outData[di] * 255);
        out[oi + 1] = clamp255(outData[1 * TILE * 4 * TILE * 4 + di] * 255);
        out[oi + 2] = clamp255(outData[2 * TILE * 4 * TILE * 4 + di] * 255);
        out[oi + 3] = 255;
      }
    }
    onProgress?.(stepBase + ((i + 1) / tiles.length) * (1 - stepBase));
  }

  return { rgba: out, width: ow, height: oh };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
