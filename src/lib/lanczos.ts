/**
 * Motor A — Remuestreo Lanczos-3 fiel.
 *
 * Sube la resolución interpolando con la ventana sinc de Lanczos (a=3),
 * en ESPACIO LINEAL (sRGB -> lineal) para no oscurecer los bordes como
 * hace el bicúbico en gamma. No inventa detalle: es fidelidad pura.
 *
 * Función pura (sin DOM) para poder correr en worker y en Node (tests).
 */

export interface RgbaBuffer {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

const A = 3; // orden de Lanczos

/** Kernel de Lanczos normalizado en x (con recorte a [-A, A]). */
function lanczos(x: number): number {
  if (x === 0) return 1;
  if (x <= -A || x >= A) return 0;
  const px = Math.PI * x;
  return (A * Math.sin(px) * Math.sin(px / A)) / (px * px);
}

/** sRGB (0..255) -> lineal (0..1). */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** lineal (0..1) -> sRGB (0..255). */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/**
 * Escala un buffer RGBA con Lanczos-3 en espacio lineal.
 * @param src buffer origen
 * @param scale factor (>1 para ampliar)
 * @param onProgress callback 0..1 (por tile)
 * @param sharpness refuerzo del kernel (1 = neutro, >1 aumenta el contraste de borde).
 *        No inventa detalle: solo modula la forma del kernel Lanczos.
 */
export function lanczosScale(
  src: RgbaBuffer,
  scale: number,
  onProgress?: (p: number) => void,
  sharpness = 1
): RgbaBuffer {
  const { rgba, width: w, height: h } = src;
  const ow = Math.max(1, Math.round(w * scale));
  const oh = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(ow * oh * 4);

  // Cache de pesos por columna/fila de salida para no recalcular.
  const wX = precomputeWeights(w, ow, scale, sharpness);
  const wY = precomputeWeights(h, oh, scale, sharpness);

  // Buffer de lineales por tile vertical para limitar memoria.
  const tileH = 256;
  for (let ty = 0; ty < oh; ty += tileH) {
    const tyEnd = Math.min(ty + tileH, oh);
    // 1) muestreo horizontal: src lineal -> tmp lineal.
    //    El buffer tmp abarca el RANGO DE FILAS DE ENTRADA que este tile de salida
    //    necesita (no el rango de salida), para que el paso vertical las encuentre.
    //    Si se indexara por fila de salida (ty..tyEnd), en imagenes altas (>256px)
    //    las filas de entrada fuera de ese rango se descartarian y la imagen
    //    quedaria CORTADA (negra) en la parte baja.
    const inStart = Math.max(0, Math.floor(ty / scale) - A);
    const inEnd = Math.min(h, Math.ceil(tyEnd / scale) + A);
    const inH = inEnd - inStart;
    const tmp = new Float32Array(ow * inH * 4);
    // 1) MUESTREO HORIZONTAL: para cada fila de entrada `sy` se produce la fila
    //    de salida completa (ow columnas) solo a partir de los pixeles de ESA fila.
    //    El bucle interno itera SOLO en X (columnas de entrada).
    for (let sy = inStart; sy < inEnd; sy++) {
      const rowLocal = sy - inStart;
      for (let xx = 0; xx < ow; xx++) {
        const sx = wX.map[xx];
        let r = 0, g = 0, b = 0, a = 0, aw = 0;
        for (let k = 0; k < wX.span; k++) {
          const sxi = sx.start + k;
          if (sxi < 0 || sxi >= w) continue;
          const wgt = wX.weights[xx][k];
          const si = (sy * w + sxi) * 4;
          const awgt = wgt * (rgba[si + 3] / 255);
          r += srgbToLinear(rgba[si]) * awgt;
          g += srgbToLinear(rgba[si + 1]) * awgt;
          b += srgbToLinear(rgba[si + 2]) * awgt;
          a += rgba[si + 3] * wgt;
          aw += awgt;
        }
        const o = (rowLocal * ow + xx) * 4;
        tmp[o] = aw > 0 ? r / aw : 0;
        tmp[o + 1] = aw > 0 ? g / aw : 0;
        tmp[o + 2] = aw > 0 ? b / aw : 0;
        tmp[o + 3] = a; // alfa en gamma (no se linealiza)
      }
    }
    // 2) muestreo vertical: tmp lineal -> out lineal
    for (let xx = 0; xx < ow; xx++) {
      for (let yy = ty; yy < tyEnd; yy++) {
        const sy = wY.map[yy];
        let r = 0, g = 0, b = 0, a = 0, aw = 0;
        for (let k = 0; k < wY.span; k++) {
          const syi = sy.start + k;
          const localRow = syi - inStart; // tmp indexado por fila de entrada
          if (localRow < 0 || localRow >= inH) continue;
          const wgt = wY.weights[yy][k];
          const si = (localRow * ow + xx) * 4;
          const awgt = wgt * (tmp[si + 3] / 255);
          r += tmp[si] * awgt;
          g += tmp[si + 1] * awgt;
          b += tmp[si + 2] * awgt;
          a += tmp[si + 3] * wgt;
          aw += awgt;
        }
        const o = (yy * ow + xx) * 4;
        out[o] = linearToSrgb(aw > 0 ? r / aw : 0);
        out[o + 1] = linearToSrgb(aw > 0 ? g / aw : 0);
        out[o + 2] = linearToSrgb(aw > 0 ? b / aw : 0);
        out[o + 3] = Math.max(0, Math.min(255, Math.round(a)));
      }
    }
    onProgress?.(tyEnd / oh);
  }

  return { rgba: out, width: ow, height: oh };
}

interface WeightMap {
  map: { start: number }[];
  weights: number[][];
  span: number;
}

/** Precomputa, para cada pixel de salida, los `span` pixeles de entrada y sus pesos.
 *  @param sharpness refuerzo del kernel (1 neutro). >1 reduce el ancho efectivo del
 *         kernel (más nitidez/contraste de borde); <1 lo ensancha (más suave). */
function precomputeWeights(srcLen: number, outLen: number, scale: number, sharpness = 1): WeightMap {
  const span = 2 * A;
  const map = new Array(outLen);
  const weights = new Array(outLen);
  const ratio = srcLen / outLen; // paso en coords de entrada por pixel de salida
  for (let oi = 0; oi < outLen; oi++) {
    const center = (oi + 0.5) * ratio - 0.5; // centro en coords de entrada
    const start = Math.round(center - A + 0.5) - 1;
    const w: number[] = [];
    let sum = 0;
    for (let k = 0; k < span; k++) {
      const si = start + k;
      const dist = si + 0.5 - (oi + 0.5) * ratio;
      // sharpness escala la distancia evaluada en el kernel (efecto de nitidez).
      const wk = lanczos(dist / sharpness);
      w.push(wk);
      sum += wk;
    }
    // normaliza (evita sesgo de brillo en bordes)
    if (sum !== 0) for (let k = 0; k < span; k++) w[k] /= sum;
    map[oi] = { start };
    weights[oi] = w;
  }
  return { map, weights, span };
}
