import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
const dom = installDom();
Object.assign(globalThis, { NodeFilter: dom.window.NodeFilter, HTMLInputElement: dom.window.HTMLInputElement, DocumentFragment: dom.window.DocumentFragment, MutationObserver: dom.window.MutationObserver, CustomEvent: dom.window.CustomEvent, Event: dom.window.Event });
import type { LifeSceneOptions } from "./life-particle-scene";
let intersect: IntersectionObserverCallback;
let mediaChange: () => void;
let reduced = false;
let disconnected = 0;
function environment(width = 1440) {
  reduced = false; disconnected = 0;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.body.dataset.gadewsAssistantOpen = "false";
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ get matches() { return reduced; }, addEventListener(_name: string, cb: () => void) { mediaChange = cb; }, removeEventListener() {} }) });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class { constructor(cb: IntersectionObserverCallback) { intersect = cb; } observe() {} disconnect() { disconnected++; } } });
}
async function setup(loader: unknown) {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider");
  const { LifeParticles } = await import("./life-particles");
  return render(<LocaleProvider initialLocale="zh-CN"><LifeParticles sceneLoader={loader as never} /></LocaleProvider>);
}
function controller() {
  const active: boolean[] = [];
  let disposed = 0;
  return { active, get disposed() { return disposed; }, api: {
    setActive(value: boolean) { active.push(value); }, dispose() { disposed++; },
  } };
}
async function visibility(value: boolean) { const { act } = await import("@testing-library/react"); await act(async () => intersect([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver)); }

test("life scene stays lazy; first visible mount starts tilapia and releases resources on unmount", async () => {
  environment(); const { cleanup, waitFor } = await import("@testing-library/react"); const c = controller(); const calls: Array<{count: number; initialStage: number}> = [];
  try { const view = await setup(async (_canvas: HTMLCanvasElement, options: {count: number; initialStage: number}) => { calls.push(options); return c.api; }); assert.equal(calls.length, 0); assert.ok(document.querySelector('img[src$="tilapia-static.svg"]')); await visibility(true); await waitFor(() => assert.equal(calls.length, 1)); assert.equal(calls[0].count, 39000); assert.equal(calls[0].initialStage, 0); await waitFor(() => assert.equal(c.active.at(-1), true)); view.unmount(); assert.equal(c.disposed, 1); assert.ok(disconnected > 0); } finally { cleanup(); }
});

test("reduced motion keeps a credited static form without controls or GPU work", async () => {
  environment(); reduced = true;
  const { cleanup, screen } = await import("@testing-library/react");
  let loaded = 0;
  try {
    await setup(async () => { loaded++; return controller().api; });
    await visibility(true);
    assert.equal(screen.queryByRole("button"), null);
    assert.ok(screen.getByRole("link", { name: "CC BY 4.0" }));
    assert.ok(document.querySelector('img[src$="tilapia-static.svg"]'));
    assert.equal(loaded, 0);
  } finally { cleanup(); }
});

test("offscreen, background and initial mobile assistant coverage stop motion and resume without recreating scene", async () => {
  environment(390); document.body.dataset.gadewsAssistantOpen = "true"; const { cleanup, act, waitFor } = await import("@testing-library/react"); const c = controller(); let loads = 0;
  try { await setup(async () => { loads++; return c.api; }); await visibility(true); await waitFor(() => assert.equal(loads, 1)); assert.equal(c.active.at(-1), false); await act(async () => window.dispatchEvent(new CustomEvent("gadews:assistant-visibility", { detail: { open: false } }))); assert.equal(c.active.at(-1), true); await visibility(false); assert.equal(c.active.at(-1), false); await visibility(true); Object.defineProperty(document, "hidden", { configurable: true, value: true }); await act(async () => document.dispatchEvent(new Event("visibilitychange"))); assert.equal(c.active.at(-1), false); Object.defineProperty(document, "hidden", { configurable: true, value: false }); await act(async () => document.dispatchEvent(new Event("visibilitychange"))); assert.equal(c.active.at(-1), true); assert.equal(loads, 1); } finally { cleanup(); }
});

test("late scene disposal and renderer failure preserve a credited fallback", async () => {
  environment();
  const { cleanup, waitFor, screen } = await import("@testing-library/react");
  const c = controller(); let resolve!: (value: typeof c.api) => void;
  try {
    const view = await setup(() => new Promise(done => { resolve = done; }));
    await visibility(true); view.unmount(); resolve(c.api);
    await waitFor(() => assert.equal(c.disposed, 1));
    await setup(async () => { throw new Error("No WebGL"); }); await visibility(true);
    await screen.findByText(/静态轮廓/);
    assert.ok(screen.getByRole("link", {name: "CC BY 4.0"}));
  } finally { cleanup(); }
});

test("automatic stage changes update the caption and reduced motion retains the last form", async () => {
  environment();
  const { cleanup, waitFor, screen, act } = await import("@testing-library/react");
  const c = controller(); let options!: LifeSceneOptions;
  try {
    await setup(async (_canvas: HTMLCanvasElement, o: LifeSceneOptions) => { options = o; return c.api; });
    await visibility(true); await waitFor(() => assert.ok(c.active.includes(true)));
    await act(async () => options.onStage(1));
    assert.ok(screen.getByRole("heading", {name: "凡纳滨对虾（幼虾）"}));
    assert.equal(screen.queryByRole("button"), null);
    reduced = true; await act(async () => mediaChange());
    assert.equal(c.disposed, 1); assert.ok(document.querySelector('img[src$="shrimp-static.svg"]'));
  } finally { cleanup(); }
});

test("resource reader rejects an oversized streamed response and aborts underlying read", async () => {
  const { readBoundedLifeResource } = await import("./life-particle-resources"); let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(8)); c.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  await assert.rejects(() => readBoundedLifeResource("/local", 10, new AbortController().signal, async () => new Response(stream)), /large/); assert.equal(cancelled, true);
});

test("restoring motion and switching particle budgets use a fresh canvas after GPU disposal", async () => {
  environment(390);
  const { act, cleanup, waitFor } = await import("@testing-library/react");
  const canvases: HTMLCanvasElement[] = [];
  const instances: ReturnType<typeof controller>[] = [];
  try {
    await setup(async (canvas: HTMLCanvasElement) => {
      const c = controller();
      assert.ok(!canvases.includes(canvas), "a disposed WebGL context must not be reused");
      canvases.push(canvas);
      instances.push(c);
      return c.api;
    });
    await visibility(true);
    await waitFor(() => assert.equal(canvases.length, 1));
    reduced = true;
    await act(async () => mediaChange());
    assert.equal(instances[0].disposed, 1);
    reduced = false;
    await act(async () => mediaChange());
    await waitFor(() => assert.equal(canvases.length, 2));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    await act(async () => window.dispatchEvent(new Event("resize")));
    await waitFor(() => assert.equal(canvases.length, 3));
    assert.equal(instances[1].disposed, 1);
    assert.equal(document.querySelector(".life-motion-area canvas"), canvases[2]);
    assert.equal(document.querySelector(".life-particles")?.getAttribute("data-life-renderer"), "ready");
  } finally { cleanup(); }
});
