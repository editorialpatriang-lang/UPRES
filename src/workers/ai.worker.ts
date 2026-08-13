/// <reference lib="webworker" />
import { runEsrgan } from "@/lib/esrgan";
import type { RgbaBuffer } from "@/lib/lanczos";

export interface AiRequest {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

self.onmessage = async (e: MessageEvent<AiRequest>) => {
  const { rgba, width, height } = e.data;
  try {
    const result = await runEsrgan(rgba, width, height, (p) => {
      (self as unknown as Worker).postMessage({ type: "progress", value: p });
    });
    (self as unknown as Worker).postMessage({ type: "done", result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export type AiResponse =
  | { type: "progress"; value: number }
  | { type: "done"; result: RgbaBuffer }
  | { type: "error"; message: string };
