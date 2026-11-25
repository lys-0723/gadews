import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { createPublicSurveillanceStore } from "@/lib/gadews/public-surveillance-loader";

installDom();
const event = { event_id: "real-1", country: "China", disease_id: "WSD", disease_name: "White spot", latitude: 0, longitude: 0 };
const manifest = { schemaVersion: 1, sources: {
  wahis: { source: "WOAH WAHIS", sourceType: "snapshot", path: "/data/woah-wahis-aquatic-disease-reports.geo.json", recordCount: 1, coverage: { from: "2025", to: "2025" }, retrievedAt: null, sourceUrls: [] },
  qaad: { source: "NACA QAAD", sourceType: "snapshot", path: "/data/qaad-surveillance-display.json", recordCount: 0, coverage: { from: null, to: null }, retrievedAt: null, sourceUrls: [] },
} };

test("real StrictMode hook starts only when enabled and shares state across consumers", async () => {
  const React = await import("react");
  const { renderHook, waitFor, cleanup } = await import("@testing-library/react");
  const { usePublicSurveillance, PublicSurveillanceContext } = await import("./use-public-surveillance");
  const calls: string[] = [];
  const store = createPublicSurveillanceStore(async (url) => { calls.push(String(url)); return Response.json(String(url).includes("manifest") ? manifest : [event]); });
  const wrapper = ({ children }: { children: React.ReactNode }) => <React.StrictMode><PublicSurveillanceContext.Provider value={store}>{children}</PublicSurveillanceContext.Provider></React.StrictMode>;
  try {
    const hook = renderHook(({ enabled }) => usePublicSurveillance("wahis", enabled), { initialProps: { enabled: false }, wrapper });
    assert.equal(hook.result.current.state, "idle"); assert.equal(calls.length, 0);
    hook.rerender({ enabled: true });
    const other = renderHook(() => usePublicSurveillance("wahis", true), { wrapper });
    await waitFor(() => assert.equal(hook.result.current.state, "success"));
    assert.equal(other.result.current.records[0].event_id, "real-1");
    assert.equal(calls.filter((url) => url.includes("woah")).length, 1);
    hook.rerender({ enabled: false });
    assert.equal(hook.result.current.state, "idle"); assert.equal(hook.result.current.records.length, 0);
    assert.equal(other.result.current.state, "success");
  } finally { cleanup(); }
});

test("unmounting the last loading hook aborts and releases its subscription", async () => {
  const React = await import("react");
  const { renderHook, cleanup } = await import("@testing-library/react");
  const { usePublicSurveillance, PublicSurveillanceContext } = await import("./use-public-surveillance");
  let signal: AbortSignal | undefined;
  let finish: ((value: Response) => void) | undefined;
  const store = createPublicSurveillanceStore(async (url, options) => {
    if (String(url).includes("manifest")) return Response.json(manifest);
    signal = options?.signal as AbortSignal;
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => <PublicSurveillanceContext.Provider value={store}>{children}</PublicSurveillanceContext.Provider>;
  try {
    const hook = renderHook(() => usePublicSurveillance("wahis", true), { wrapper });
    assert.equal(hook.result.current.state, "loading");
    hook.unmount(); await new Promise<void>((r) => setImmediate(r));
    assert.equal(signal?.aborted, true);
    finish?.(Response.json([event])); await new Promise<void>((r) => setImmediate(r));
    assert.equal(store.getSnapshot("wahis").state, "idle");
  } finally { cleanup(); }
});

test("server rendering uses stable idle state without fetching", async () => {
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { usePublicSurveillance, PublicSurveillanceContext } = await import("./use-public-surveillance");
  let calls = 0;
  const store = createPublicSurveillanceStore(async () => { calls++; return Response.json([]); });
  function View() { return <output>{usePublicSurveillance("wahis", true).state}</output>; }
  assert.equal(renderToString(<PublicSurveillanceContext.Provider value={store}><View /></PublicSurveillanceContext.Provider>), "<output>idle</output>");
  assert.equal(calls, 0);
});
