import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { createPublicSurveillanceStore } from "@/lib/gadews/public-surveillance-loader";

const dom = installDom();
Object.assign(globalThis, { NodeFilter: dom.window.NodeFilter, HTMLInputElement: dom.window.HTMLInputElement, DocumentFragment: dom.window.DocumentFragment, MutationObserver: dom.window.MutationObserver, CustomEvent: dom.window.CustomEvent, Event: dom.window.Event });
const event = { event_id: "a", country: "China", disease_id: "WSD", disease_name: "White spot disease", latitude: 35, longitude: 104, event_start_date: "2025-02-01", last_report_url: "https://wahis.woah.org/#/event/a" };
const rows = [event, { ...event, event_id: "b", disease_id: "AHPND", disease_name: "AHPND" }, { ...event, event_id: "missing", country: "No coordinate country", latitude: null, longitude: null, event_start_date: null }];
const source = { source: "WOAH WAHIS", sourceType: "snapshot", path: "/data/woah-wahis-aquatic-disease-reports.geo.json", recordCount: 3, coverage: { from: "2005-01-01", to: "2025-12-31" }, retrievedAt: "2026-05-18", sourceUrls: [] };
const manifest = { schemaVersion: 1, sources: { wahis: source, qaad: { ...source, source: "NACA QAAD", path: "/data/qaad-surveillance-display.json" } } };

async function setup(fetcher: typeof fetch) {
  const React = await import("react"); const { render } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance");
  const { ReportGlobe } = await import("./report-globe");
  const store = createPublicSurveillanceStore(fetcher);
  render(<PublicSurveillanceContext.Provider value={store}><ReportGlobe /></PublicSurveillanceContext.Provider>);
}

test("loading, renderer fallback and complete grouped / missing coordinate reports remain accessible", async () => {
  const { screen, waitFor, fireEvent, cleanup, within } = await import("@testing-library/react");
  let resolve: ((response: Response) => void) | undefined;
  try {
    await setup(async url => String(url).includes("manifest") ? Response.json(manifest) : new Promise<Response>(done => { resolve = done; }));
    assert.ok(screen.getByText(/Loading WOAH WAHIS/));
    resolve?.(Response.json(rows));
    await waitFor(() => assert.ok(screen.getByText(/3 reports/)));
    assert.ok(screen.getByText(/3D view unavailable/));
    fireEvent.click(screen.getByRole("button", { name: /Browse all reports/ }));
    await waitFor(() => assert.ok(screen.getByRole("dialog")));
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 3);
    fireEvent.click(screen.getByRole("button", { name: /missing/ }));
    assert.ok(screen.getByText("Coordinates unavailable"));
    assert.equal(screen.getAllByText("Date unavailable").length, 2);
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Disease filter"), { target: { value: "AHPND" } });
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 1);
    assert.ok(screen.getByRole("link", { name: /Official report/ }).getAttribute("href")?.startsWith("https://wahis.woah.org/"));
  } finally { cleanup(); }
});

test("empty data is separate from render failure and contains no substitute points", async () => {
  const { screen, waitFor, cleanup } = await import("@testing-library/react");
  try {
    await setup(async url => Response.json(String(url).includes("manifest") ? manifest : []));
    await waitFor(() => assert.ok(screen.getByText(/No reports in this snapshot/)));
    assert.equal(screen.queryByText(/3D view unavailable/), null);
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 0);
  } finally { cleanup(); }
});

test("request error retries actual source without reloading on filtering", async () => {
  const { screen, waitFor, fireEvent, cleanup } = await import("@testing-library/react");
  let requests = 0;
  try {
    await setup(async url => String(url).includes("manifest") ? Response.json(manifest) : ++requests === 1 ? new Response("fail", { status: 500 }) : Response.json(rows));
    await waitFor(() => assert.ok(screen.getByRole("button", { name: "Retry WOAH WAHIS" })));
    fireEvent.click(screen.getByRole("button", { name: "Retry WOAH WAHIS" }));
    await waitFor(() => assert.ok(screen.getByText(/3 reports/)));
    fireEvent.click(screen.getByRole("button", { name: /Browse all reports/ }));
    fireEvent.change(screen.getByLabelText("Disease filter"), { target: { value: "WSD" } });
    assert.equal(requests, 2);
    assert.ok(screen.getByText(/2 reports/));
  } finally { cleanup(); }
});

test("complete current snapshot is browsable and Escape restores the trigger", async () => {
  const { screen, waitFor, fireEvent, cleanup } = await import("@testing-library/react");
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(readFileSync("public/data/woah-wahis-aquatic-disease-reports.geo.json", "utf8"));
  try {
    await setup(async url => Response.json(String(url).includes("manifest") ? manifest : raw));
    await waitFor(() => assert.ok(screen.getByText(/371 reports/)));
    const trigger = screen.getByRole("button", { name: /Browse all reports/ }); trigger.focus(); fireEvent.click(trigger);
    await waitFor(() => assert.ok(screen.getByRole("dialog")));
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 371);
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
    await waitFor(() => assert.equal(document.activeElement, trigger));
  } finally { cleanup(); }
});

test("switching dialog language preserves the selected report and disease filter", async () => {
  const React = await import("react"); const { render, screen, fireEvent, waitFor, cleanup, within } = await import("@testing-library/react");
  const { LocaleProvider } = await import("@/components/gadews/locale-provider");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance");
  const { ReportGlobe } = await import("./report-globe");
  const store = createPublicSurveillanceStore(async url => Response.json(String(url).includes("manifest") ? manifest : rows));
  try {
    render(<LocaleProvider initialLocale="zh-CN"><PublicSurveillanceContext.Provider value={store}><ReportGlobe /></PublicSurveillanceContext.Provider></LocaleProvider>);
    await waitFor(() => assert.ok(screen.getByText(/3 份报告/)));
    fireEvent.click(screen.getByRole("button", { name: /查看全部报告/ }));
    fireEvent.change(screen.getByLabelText("病种筛选"), { target: { value: "WSD" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /missing/ }));
    fireEvent.change(within(dialog).getByLabelText("Chinese / English"), { target: { value: "en" } });
    assert.ok(within(dialog).getByText("Coordinates unavailable"));
    assert.equal((within(dialog).getByLabelText("Disease filter") as HTMLSelectElement).value, "WSD");
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 2);
    assert.equal(document.querySelector('[data-globe-report="missing"]')?.getAttribute("aria-pressed"), "true");
  } finally { cleanup(); }
});

test("reduced motion preferences remain observable without rotation controls", async () => {
  const { screen, waitFor, cleanup, act } = await import("@testing-library/react");
  const original = window.matchMedia;
  let listener: (() => void) | undefined; let matches = true;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ get matches() { return matches; }, addEventListener: (_type: string, callback: () => void) => { listener = callback; }, removeEventListener: () => { listener = undefined; } }) });
  try {
    await setup(async url => Response.json(String(url).includes("manifest") ? manifest : rows));
    await waitFor(() => assert.equal(document.querySelector(".report-globe")?.getAttribute("data-motion"), "reduced"));
    assert.equal(screen.queryByRole("button", { name: "Reduced motion enabled" }), null);
    await act(async () => { matches = false; listener?.(); });
    assert.equal(document.querySelector(".report-globe")?.getAttribute("data-motion"), "auto");
    await act(async () => { matches = true; listener?.(); });
    assert.equal(document.querySelector(".report-globe")?.getAttribute("data-motion"), "reduced");
  } finally { cleanup(); Object.defineProperty(window, "matchMedia", { configurable: true, value: original }); }
});

test("report access can sit outside the sphere with no overlaid rotation card", async () => {
  const React = await import("react"); const { render, screen, waitFor, fireEvent, cleanup } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance"); const { ReportGlobe } = await import("./report-globe");
  const target = document.createElement("div"); document.body.append(target);
  const store = createPublicSurveillanceStore(async url => Response.json(String(url).includes("manifest") ? manifest : rows));
  try {
    render(<PublicSurveillanceContext.Provider value={store}><ReportGlobe accessTarget={target} /></PublicSurveillanceContext.Provider>);
    await waitFor(() => assert.ok(screen.getByText(/3 reports/)));
    const browse = screen.getByRole("button", { name: /Browse all reports/ });
    assert.ok(target.contains(browse));
    assert.equal(document.querySelector(".report-globe-tools"), null);
    assert.equal(screen.queryByRole("button", { name: /Pause rotation|Resume rotation|Zoom in globe|Zoom out globe|Reset view/ }), null);
    fireEvent.click(browse); assert.ok(screen.getByRole("dialog"));
    assert.equal(document.querySelectorAll("[data-globe-report]").length, 3);
  } finally { cleanup(); target.remove(); }
});
