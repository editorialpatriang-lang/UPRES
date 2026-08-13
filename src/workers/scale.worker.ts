/// <reference lib="webworker" />
import { lanczosScale, type RgbaBuffer } from "@/lib/lanczos";

export interface ScaleRequest {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  scale: number;
  sharpness?: number;
}

self.onmessage = (e: MessageEvent<ScaleRequest>) => {
  const { rgba, width, height, scale, sharpness } = e.data;
  const result = lanczosScale(
    { rgba, width, height },
    scale,
    (p) => {
      (self as unknown as Worker).postMessage({ type: "progress", value: p });
    },
    sharpness
  );
  (self as unknown as Worker).postMessage({ type: "done", result });
};

export type ScaleResponse =
  | { type: "progress"; value: number }
  | { type: "done"; result: RgbaBuffer };
