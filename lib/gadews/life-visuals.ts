export type LifeStage = 0 | 1 | 2 | 3;
export const LIFE_STAGES = ["tilapia", "shrimp", "cell", "pathogen"] as const;

export interface PhotoPointPack {
  pointsPerAnimal: number;
  tilapia: Float32Array;
  shrimp: Float32Array;
}

export interface LifePhotoSource {
  id: "tilapia" | "shrimp";
  nameZh: string;
  nameEn: string;
  scientificName: string;
  photo: string;
  originalPhoto: string;
  fallback: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  credit: string;
  cropNote?: string;
}
export interface LifeManifest {
  version: 1;
  pointFile: "photo-points.bin";
  sources: [LifePhotoSource, LifePhotoSource];
}

export function parseLifeManifest(value: unknown): LifeManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid life source manifest");
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || input.pointFile !== "photo-points.bin" || !Array.isArray(input.sources) || input.sources.length !== 2) throw new Error("Invalid life source layout");
  const sources = input.sources.map((item: unknown, i: number) => {
    if (!item || typeof item !== "object") throw new Error("Invalid photo source");
    const source = item as Record<string, unknown>;
    const id = i === 0 ? "tilapia" : "shrimp";
    if (source.id !== id || source.photo !== id + "-reference.jpg" || source.originalPhoto !== id + "-original.jpg" || source.fallback !== id + "-static.svg") throw new Error("Invalid local photo path");
    for (const key of ["nameZh", "nameEn", "scientificName", "sourceUrl", "license", "licenseUrl", "credit"]) if (typeof source[key] !== "string" || !source[key]) throw new Error("Missing photo provenance");
    for (const key of ["sourceUrl", "licenseUrl"]) if (new URL(source[key] as string).protocol !== "https:") throw new Error("Unsafe photo link");
    return source as unknown as LifePhotoSource;
  });
  return { version: 1, pointFile: "photo-points.bin", sources: sources as [LifePhotoSource, LifePhotoSource] };
}

export function decodePhotoPointPack(buffer: ArrayBuffer): PhotoPointPack {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 16 || bytes[0] !== 71 || bytes[1] !== 76 || bytes[2] !== 70 || bytes[3] !== 49) throw new Error("Invalid life point signature");
  const view = new DataView(buffer);
  const count = view.getUint32(8, true);
  if (view.getUint16(4, true) !== 1 || view.getUint16(6, true) !== 8 || view.getUint32(12, true) !== 2 || count < 1 || count > 50000 || buffer.byteLength !== 16 + count * 16) throw new Error("Invalid life point layout");
  function readAnimal(offset: number) {
    const result = new Float32Array(count * 5);
    for (let i = 0; i < count; i++) {
      const at = offset + i * 8;
      const x = view.getInt16(at, true) / 8192;
      const y = view.getInt16(at + 2, true) / 8192;
      const z = view.getInt16(at + 4, true) / 32767;
      const edge = view.getUint8(at + 7);
      if (Math.abs(x) > 2.05 || Math.abs(y) > 3 || Math.abs(z) > 0.11 || (edge !== 0 && edge !== 255)) throw new Error("Invalid life point coordinates");
      result.set([x, y, z, view.getUint8(at + 6) / 255, edge === 255 ? 1 : 0], i * 5);
    }
    return result;
  }
  return { pointsPerAnimal: count, tilapia: readAnimal(16), shrimp: readAnimal(16 + count * 8) };
}

export function sampleAnimalPoints(source: Float32Array, count: number): Float32Array {
  if (!source.length || source.length % 5 || !Number.isInteger(count) || count < 1 || count > 100000) throw new Error("Invalid life sampling request");
  const total = source.length / 5;
  const result = new Float32Array(count * 5);
  for (let i = 0; i < count; i++) result.set(source.subarray(Math.floor(i * total / count) * 5, Math.floor(i * total / count) * 5 + 5), i * 5);
  return result;
}

export function nextLifeStage(stage: number): LifeStage {
  if (!Number.isInteger(stage) || stage < 0 || stage > 3) throw new Error("Invalid life stage");
  return ((stage + 1) % 4) as LifeStage;
}

export function lifePointCount(width: number, reduced: boolean): number {
  return reduced ? 0 : width < 600 ? 10500 : 39000;
}

export function lifeMotionAllowed(state: { reduced: boolean; visible: boolean; hidden: boolean; assistantOpen: boolean; mobile: boolean }): boolean {
  return !state.reduced && state.visible && !state.hidden && !(state.mobile && state.assistantOpen);
}

export function createLifeFrameLoop(
  scheduler: { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void },
  draw: (time: number) => void,
) {
  let active = false;
  let pending: number | null = null;
  let disposed = false;
  let drawing = false;
  function request() {
    if (disposed || drawing || pending !== null) return;
    pending = scheduler.request((time) => {
      pending = null;
      if (disposed) return;
      drawing = true;
      try { draw(time); } finally { drawing = false; }
      if (active) request();
    });
  }
  return {
    setActive(next: boolean) {
      if (disposed) return;
      active = next;
      if (active) request();
      else if (pending !== null) { scheduler.cancel(pending); pending = null; }
    },
    redraw: request,
    dispose() { disposed = true; active = false; if (pending !== null) scheduler.cancel(pending); pending = null; },
  };
}
