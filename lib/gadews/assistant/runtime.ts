import { isIP } from "node:net";
import type { AssistantErrorCode } from "./types";

export class AiRuntimeError extends Error {
  constructor(public code: AssistantErrorCode) { super(code); }
}
export function hasSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin || rawOrigin.length > 512) return false;
  try {
    const destination = new URL(request.url);
    if (!["http:", "https:"].includes(destination.protocol) || destination.username || destination.password) return false;
    const authority = request.headers.get("host") ?? destination.host;
    if (authority.length > 259 || !/^(?:[a-z0-9.-]+|\[[a-f0-9:.]+\])(?::[0-9]{1,5})?$/i.test(authority)) return false;
    const target = new URL(destination.protocol + "//" + authority), origin = new URL(rawOrigin);
    return ["http:", "https:"].includes(origin.protocol) && rawOrigin === origin.origin && origin.origin === target.origin;
  } catch { return false; }
}
export async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const abort = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", abort, { once: true });
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    if (request.signal.aborted) throw new AiRuntimeError("cancelled");
    while (true) {
      const { done, value } = await reader.read();
      if (request.signal.aborted) throw new AiRuntimeError("cancelled");
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel().catch(() => {}); throw new AiRuntimeError("body_too_large"); }
      chunks.push(value);
    }
    const joined = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
  } finally { request.signal.removeEventListener("abort", abort); reader.releaseLock(); }
}
export interface ModelBudget { acquire(request: Request, env: Record<string, string | undefined>): () => void; }
export function createModelBudget(now = Date.now): ModelBudget {
  const rates = new Map<string, { since: number; count: number }>(); let active = 0;
  return { acquire(request, env) {
    const time = now();
    for (const [key, rate] of rates) if (time - rate.since >= 60000) rates.delete(key);
    const forwarded = env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() : undefined;
    const key = forwarded && isIP(forwarded) ? forwarded : "unidentified", rate = rates.get(key);
    if ((rate && rate.count >= 8) || (!rate && rates.size >= 1000)) throw new AiRuntimeError("rate_limited");
    if (rate) rate.count++; else rates.set(key, { since: time, count: 1 });
    if (active >= 2) throw new AiRuntimeError("busy");
    active++; let released = false;
    return () => { if (!released) { released = true; active--; } };
  } };
}
/** One production-process budget is explicitly supplied to both route factories. */
const processRuntime = globalThis as typeof globalThis & { __gadewsModelBudget?: ModelBudget };
export const sharedModelBudget = processRuntime.__gadewsModelBudget ??= createModelBudget();
export async function runModelCall<T>(request: Request, budget: ModelBudget, env: Record<string, string | undefined>, timeoutMs: number, generate: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (request.signal.aborted) throw new AiRuntimeError("cancelled");
  const release = budget.acquire(request, env), controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  let interrupted!: () => void;
  const cancellation = new Promise<never>((_resolve, reject) => { interrupted = () => reject(new AiRuntimeError(timedOut ? "timeout" : "cancelled")); controller.signal.addEventListener("abort", interrupted, { once: true }); });
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  if (request.signal.aborted) controller.abort();
  try {
    const value = await Promise.race([Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new AiRuntimeError(timedOut ? "timeout" : "cancelled");
      return generate(controller.signal);
    }), cancellation]);
    if (controller.signal.aborted) throw new AiRuntimeError(timedOut ? "timeout" : "cancelled");
    return value;
  } finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", interrupted); release();
  }
}
