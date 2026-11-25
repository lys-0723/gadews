import { z } from "zod";
import { parseQaad, parseWahis, type LoadState, type ParseResult, type PublicSource, type QaadDisplayRecord, type SourceMetadata, type WahisRecord } from "./public-surveillance";

export const SURVEILLANCE_PATHS = { wahis: "/data/woah-wahis-aquatic-disease-reports.geo.json", qaad: "/data/qaad-surveillance-display.json" } as const;
export interface PublicSnapshot<T> {
  state: LoadState;
  records: T[];
  rejectedCount: number;
  metadata?: SourceMetadata;
  error?: string;
}
const metadata = z.object({ source: z.string().min(1), sourceType: z.literal("snapshot"), recordCount: z.number().int().nonnegative(), coverage: z.object({ from: z.string().nullable(), to: z.string().nullable() }), retrievedAt: z.string().nullable(), sourceUrls: z.array(z.string().url()) });
const manifestSchema = z.object({ schemaVersion: z.literal(1), sources: z.object({ wahis: metadata.extend({ path: z.literal(SURVEILLANCE_PATHS.wahis) }), qaad: metadata.extend({ path: z.literal(SURVEILLANCE_PATHS.qaad) }) }) });
type Manifest = z.infer<typeof manifestSchema>;
type Rows = { wahis: WahisRecord; qaad: QaadDisplayRecord };
type Notify = () => void;
export type PublicSurveillanceStore = ReturnType<typeof createPublicSurveillanceStore>;

export function createPublicSurveillanceStore(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let manifestCache: Manifest | undefined;
  let attempt: { controller: AbortController; promise: Promise<Manifest>; refs: number } | undefined;
  async function json(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetcher(path, { signal });
    if (!response.ok) throw new Error("Public snapshot unavailable");
    return response.json();
  }
  function acquireManifest() {
    if (manifestCache) return { promise: Promise.resolve(manifestCache), release: () => {} };
    if (!attempt) {
      const controller = new AbortController();
      const current = { controller, refs: 0, promise: Promise.resolve({} as Manifest) };
      current.promise = json("/data/surveillance-manifest.json", controller.signal).then((input) => {
        const value = manifestSchema.parse(input);
        if (attempt === current && !controller.signal.aborted) manifestCache = value;
        return value;
      }).finally(() => { if (attempt === current) attempt = undefined; });
      attempt = current;
    }
    const current = attempt; current.refs++;
    let released = false;
    return { promise: current.promise, release: () => {
      if (released) return; released = true;
      if (--current.refs === 0 && attempt === current) { attempt = undefined; current.controller.abort(); }
    } };
  }
  function resource<T>(source: PublicSource, parse: (value: unknown) => ParseResult<T>) {
    const idle: PublicSnapshot<T> = { state: "idle", records: [], rejectedCount: 0 };
    let snapshot = idle;
    let generation = 0;
    let controller: AbortController | undefined;
    let releaseManifest: (() => void) | undefined;
    const listeners = new Set<Notify>();
    const publish = (next: PublicSnapshot<T>) => { snapshot = next; listeners.forEach((notify) => notify()); };
    function start() {
      const token = ++generation; const request = new AbortController(); controller = request;
      const acquired = acquireManifest(); releaseManifest = acquired.release;
      publish({ state: "loading", records: [], rejectedCount: 0 });
      Promise.all([json(SURVEILLANCE_PATHS[source], request.signal), acquired.promise]).then(([input, manifest]) => {
        if (token !== generation || request.signal.aborted) return;
        const parsed = parse(input);
        publish({ state: parsed.records.length ? "success" : "empty", ...parsed, metadata: manifest.sources[source] });
      }).catch(() => {
        if (token !== generation || request.signal.aborted) return;
        // A metadata failure must also stop a payload that is still downloading.
        request.abort();
        publish({ state: "error", records: [], rejectedCount: 0, error: `${source === "wahis" ? "WOAH WAHIS" : "NACA QAAD"} snapshot unavailable. Retry to load again.` });
      }).finally(() => {
        acquired.release();
        if (token === generation) { controller = undefined; releaseManifest = undefined; }
      });
    }
    return {
      getSnapshot: () => snapshot,
      getServerSnapshot: () => idle,
      subscribe: (notify: Notify) => {
        listeners.add(notify);
        if (snapshot.state === "idle") start();
        return () => {
          listeners.delete(notify);
          queueMicrotask(() => {
            if (listeners.size || !controller) return;
            generation++; controller.abort(); controller = undefined; releaseManifest?.(); releaseManifest = undefined;
            snapshot = idle;
          });
        };
      },
      retry: () => { if (listeners.size && snapshot.state === "error") start(); },
    };
  }
  const resources = { wahis: resource("wahis", parseWahis), qaad: resource("qaad", parseQaad) };
  return {
    subscribe: (source: PublicSource, notify: Notify) => resources[source].subscribe(notify),
    getSnapshot: <S extends PublicSource>(source: S) => resources[source].getSnapshot() as PublicSnapshot<Rows[S]>,
    getServerSnapshot: <S extends PublicSource>(source: S) => resources[source].getServerSnapshot() as PublicSnapshot<Rows[S]>,
    retry: (source: PublicSource) => resources[source].retry(),
  };
}
export const publicSurveillanceStore = createPublicSurveillanceStore();
