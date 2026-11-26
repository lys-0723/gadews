import assert from "node:assert/strict";
import test from "node:test";
import { createPublicSurveillanceStore } from "./public-surveillance-loader";

const event = { event_id: "x", country: "China", disease_id: "WSD", disease_name: "White spot", event_start_date: "2025-01-01", latitude: 0, longitude: 0 };
const row = { summary_id: "x", country_or_territory: "China", disease_id: "WSD", disease_name: "White spot", status_summary: "no_information", latitude: 0, longitude: 0 };
const metadata = (source: string, path: string) => ({ source, sourceType: "snapshot", path, recordCount: 1, coverage: { from: "2025", to: "2025" }, retrievedAt: null, sourceUrls: [] });
const manifest = { schemaVersion: 1, sources: { wahis: metadata("WOAH WAHIS", "/data/woah-wahis-aquatic-disease-reports.geo.json"), qaad: metadata("NACA QAAD", "/data/qaad-surveillance-display.json") } };
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise<void>((r) => setImmediate(r)); };
function fixture(fail = false) {
  const calls: string[] = [];
  const store = createPublicSurveillanceStore(async (input) => {
    const path = String(input); calls.push(path);
    if (fail && !path.includes("manifest")) return new Response("unavailable", { status: 503 });
    return Response.json(path.includes("manifest") ? manifest : path.includes("woah") ? [event] : [row]);
  });
  return { calls, store };
}

test("unused store is idle and concurrent consumers share payload and manifest", async () => {
  const { store, calls } = fixture();
  assert.equal(store.getSnapshot("wahis").state, "idle"); assert.equal(calls.length, 0);
  const a = store.subscribe("wahis", () => {}); const b = store.subscribe("wahis", () => {}); const c = store.subscribe("qaad", () => {});
  await flush();
  assert.equal(store.getSnapshot("wahis").state, "success");
  assert.equal(store.getSnapshot("qaad").records[0].status_summary, "no_information");
  assert.equal(calls.filter((p) => p.includes("manifest")).length, 1);
  assert.equal(calls.length, 3);
  a(); b(); c(); await flush();
  const again = store.subscribe("wahis", () => {}); await flush(); assert.equal(calls.length, 3); again();
});

test("errors stay errors until manual retry, then success reuses verified manifest", async () => {
  let fail = true; let payloadCalls = 0;
  const store = createPublicSurveillanceStore(async (url) => {
    if (String(url).includes("manifest")) return Response.json(manifest);
    payloadCalls++; return fail ? new Response("private response", { status: 500 }) : Response.json([event]);
  });
  const off = store.subscribe("wahis", () => {}); await flush();
  assert.equal(store.getSnapshot("wahis").state, "error"); assert.equal(payloadCalls, 1);
  assert.ok(!store.getSnapshot("wahis").error?.includes("private"));
  const another = store.subscribe("wahis", () => {}); await flush(); assert.equal(payloadCalls, 1);
  fail = false; store.retry("wahis"); await flush();
  assert.equal(store.getSnapshot("wahis").state, "success"); assert.equal(payloadCalls, 2); off(); another();
});

test("empty input and invalid payload/metadata have distinct states", async () => {
  for (const [payload, expected] of [[[], "empty"], [null, "error"], [[{}], "error"]] as const) {
    const store = createPublicSurveillanceStore(async (url) => Response.json(String(url).includes("manifest") ? manifest : payload));
    const off = store.subscribe("wahis", () => {}); await flush(); assert.equal(store.getSnapshot("wahis").state, expected); off();
  }
  const store = createPublicSurveillanceStore(async (url) => Response.json(String(url).includes("manifest") ? { schemaVersion: 1, sources: { wahis: { ...manifest.sources.wahis, path: "https://external.invalid" } } } : [event]));
  const off = store.subscribe("wahis", () => {}); await flush(); assert.equal(store.getSnapshot("wahis").state, "error"); off();
});

test("one consumer leaving keeps request alive; last release aborts and late results cannot replace retry", async () => {
  const pending: Array<{ resolve: (r: Response) => void; signal: AbortSignal }> = [];
  const store = createPublicSurveillanceStore(async (url, options) => {
    if (String(url).includes("manifest")) return Response.json(manifest);
    return new Promise<Response>((resolve) => pending.push({ resolve, signal: options?.signal as AbortSignal }));
  });
  const a = store.subscribe("wahis", () => {}); const b = store.subscribe("wahis", () => {}); await flush();
  a(); await flush(); assert.equal(pending[0].signal.aborted, false);
  b(); await flush(); assert.equal(pending[0].signal.aborted, true); assert.equal(store.getSnapshot("wahis").state, "idle");
  const c = store.subscribe("wahis", () => {}); await flush();
  pending[1].resolve(Response.json([{ ...event, event_id: "new" }])); await flush();
  pending[0].resolve(Response.json([{ ...event, event_id: "old" }])); await flush();
  assert.equal(store.getSnapshot("wahis").records[0].event_id, "new"); c();
});

test("StrictMode-like immediate resubscribe does not duplicate requests", async () => {
  const { store, calls } = fixture();
  const off = store.subscribe("wahis", () => {}); off();
  const again = store.subscribe("wahis", () => {}); await flush();
  assert.equal(calls.filter((p) => p.includes("woah")).length, 1); again();
});

test("invalid JSON and failed manifest can recover after explicit retry", async () => {
  for (const failure of ["json", "manifest"]) {
    let bad = true;
    const store = createPublicSurveillanceStore(async (url) => {
      if (String(url).includes("manifest")) return bad && failure === "manifest" ? new Response("failure", { status: 503 }) : Response.json(manifest);
      return bad && failure === "json" ? new Response("{") : Response.json([event]);
    });
    const off = store.subscribe("wahis", () => {}); await flush();
    assert.equal(store.getSnapshot("wahis").state, "error");
    bad = false; store.retry("wahis"); await flush();
    assert.equal(store.getSnapshot("wahis").state, "success"); off();
  }
});

test("metadata failure aborts a still-pending payload instead of leaking its request", async () => {
  let signal: AbortSignal | undefined;
  const store = createPublicSurveillanceStore(async (url, options) => {
    if (String(url).includes("manifest")) return new Response("failure", { status: 503 });
    signal = options?.signal as AbortSignal;
    return new Promise<Response>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true }));
  });
  const off = store.subscribe("wahis", () => {}); await flush();
  assert.equal(store.getSnapshot("wahis").state, "error");
  assert.equal(signal?.aborted, true); off();
});
