import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { createPublicSurveillanceStore } from "@/lib/gadews/public-surveillance-loader";

installDom();
const event = { event_id: "actual", country: "Bangladesh", disease_id: "WSD", disease_name: "White spot disease", event_start_date: "2025-12-31", latitude: 0, longitude: 0 };
const qaad = [{ summary_id: "q", country_or_territory: "China", disease_id: "WSD", disease_name: "White spot", latitude: 0, longitude: 0 }];
const meta = (source: string, path: string) => ({ source, sourceType: "snapshot", path, recordCount: 1, coverage: { from: "2005-01-01", to: "2025-12-31" }, retrievedAt: "2026-05-18", sourceUrls: [] });
const manifest = { schemaVersion: 1, sources: { wahis: meta("WOAH WAHIS", "/data/woah-wahis-aquatic-disease-reports.geo.json"), qaad: { ...meta("NACA QAAD", "/data/qaad-surveillance-display.json"), retrievedAt: null } } };

test("event panel shows loading then actual snapshot rows, date order and source diagnostics", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance");
  const { RecentSnapshotEvents } = await import("./recent-snapshot-events");
  let resolve: ((response: Response) => void) | undefined;
  const store = createPublicSurveillanceStore(async (url) => String(url).includes("manifest") ? Response.json(manifest) : String(url).includes("qaad") ? Response.json(qaad) : new Promise<Response>((done) => { resolve = done; }));
  try {
    render(<PublicSurveillanceContext.Provider value={store}><RecentSnapshotEvents /></PublicSurveillanceContext.Provider>);
    assert.ok(screen.getByText(/Loading WOAH WAHIS/i));
    resolve?.(Response.json([{ ...event, event_id: "missing-date", country: "China", event_start_date: "invalid" }, event, {}]));
    await waitFor(() => assert.ok(screen.getByText("Bangladesh")));
    assert.equal(document.querySelectorAll("[data-public-event]").length, 2);
    assert.equal(document.querySelector("[data-public-event]")?.getAttribute("data-public-event"), "actual");
    assert.ok(screen.getByText("Date unavailable")); assert.ok(screen.getByText(/1 invalid record/));
    assert.equal(screen.getAllByText(/2005-01-01.*2025-12-31/).length, 2);
    assert.equal(screen.queryByText("Thailand"), null);
  } finally { cleanup(); }
});

test("event panel shows genuine empty state without examples", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance"); const { RecentSnapshotEvents } = await import("./recent-snapshot-events");
  const store = createPublicSurveillanceStore(async (url) => Response.json(String(url).includes("manifest") ? manifest : String(url).includes("qaad") ? qaad : []));
  try {
    render(<PublicSurveillanceContext.Provider value={store}><RecentSnapshotEvents /></PublicSurveillanceContext.Provider>);
    await waitFor(() => assert.ok(screen.getByText(/No reports in this snapshot/)));
    assert.equal(document.querySelectorAll("[data-public-event]").length, 0);
  } finally { cleanup(); }
});

test("failed event panel retries the real service and renders recovered records", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance"); const { RecentSnapshotEvents } = await import("./recent-snapshot-events");
  let calls = 0;
  const store = createPublicSurveillanceStore(async (url) => String(url).includes("manifest") ? Response.json(manifest) : String(url).includes("qaad") ? Response.json(qaad) : ++calls === 1 ? new Response("failure", { status: 500 }) : Response.json([event]));
  try {
    render(<PublicSurveillanceContext.Provider value={store}><RecentSnapshotEvents /></PublicSurveillanceContext.Provider>);
    await waitFor(() => assert.ok(screen.getByRole("button", { name: "Retry WOAH WAHIS" })));
    assert.equal(document.querySelectorAll("[data-public-event]").length, 0);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry WOAH WAHIS" }));
    await waitFor(() => assert.ok(screen.getByText("Bangladesh"))); assert.equal(calls, 2);
  } finally { cleanup(); }
});

test("recent snapshot preserves actual records while interface language changes", async () => {
  const React = await import("react"); const { render, screen, waitFor, fireEvent, cleanup } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance"); const { RecentSnapshotEvents } = await import("./recent-snapshot-events");
  const { LocaleProvider, useLocale } = await import("@/components/gadews/locale-provider");
  let calls = 0;
  const store = createPublicSurveillanceStore(async url => String(url).includes("manifest") ? Response.json(manifest) : String(url).includes("qaad") ? Response.json(qaad) : (calls++, Response.json([{ ...event, dashboard_url: "https://wahis.woah.org/#/in-event/actual/dashboard" }])));
  function Panel() { const { setLocale } = useLocale(); return <><button onClick={() => setLocale("en")}>English</button><RecentSnapshotEvents /></>; }
  try {
    render(<PublicSurveillanceContext.Provider value={store}><LocaleProvider initialLocale="zh-CN"><Panel /></LocaleProvider></PublicSurveillanceContext.Provider>);
    await waitFor(() => assert.ok(screen.getByText("Bangladesh")));
    assert.ok(screen.getByText("事件开始日期"));
    fireEvent.click(screen.getByText("English"));
    assert.ok(screen.getByText("Event start date"));
    assert.ok(screen.getByRole("link", { name: /View official report/ }).getAttribute("href")?.includes("actual"));
    assert.equal(calls, 1);
    assert.equal(document.querySelector("[data-public-event]")?.getAttribute("data-public-event"), "actual");
  } finally { cleanup(); }
});
