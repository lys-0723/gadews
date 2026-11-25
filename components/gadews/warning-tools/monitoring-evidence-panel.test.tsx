import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import type { MonitoringFeed, MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
installDom();
const feeds: MonitoringFeed[] = ["a", "b"].map((id) => ({ id: `synthetic-${id}`, label: `Synthetic ${id}`, siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic unit verification" }));
function snapshot(feed = feeds[0]): MonitoringSnapshot { const observedAt = new Date(Date.now() - 60_000).toISOString(); return { schemaVersion: "1.0", feed, fetchedAt: new Date().toISOString(), observation: { observedAt, ingestedAt: observedAt, reference: `monitoring:${feed.id}:${observedAt}`, metrics: { waterTemperatureC: { value: 28, unit: "°C", state: "usable", issues: [] }, dissolvedOxygenMgL: { value: 0, unit: "mg/L", state: "usable", issues: [] }, ph: { value: null, unit: "pH", state: "missing", issues: ["missing_value"] } } } }; }

test("panel stays idle until explicit load, previews complete DTO and clears on disease change", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel");
  const original = globalThis.fetch; const calls: string[] = []; let selected: MonitoringSnapshot | null = null;
  globalThis.fetch = async (url) => { calls.push(String(url)); return Response.json(String(url).endsWith("/feeds") ? { schemaVersion: "1.0", feeds } : snapshot()); };
  const onSnapshot = (value: MonitoringSnapshot | null) => { selected = value; };
  try {
    const view = render(<MonitoringEvidencePanel disease="wsd" onSnapshot={onSnapshot} />); const user = userEvent.setup();
    assert.equal(calls.length, 0); assert.equal(selected, null);
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" }));
    await user.selectOptions(await screen.findByLabelText("Monitoring feed"), "synthetic-a");
    await waitFor(() => assert.equal((selected as MonitoringSnapshot | null)?.feed.id, "synthetic-a"));
    assert.ok(screen.getByText("0 mg/L")); assert.ok(screen.getByText(/missing_value/)); assert.ok(screen.getByText(/Synthetic unit verification/));
    assert.equal(screen.queryByRole("button", { name: /Apply monitoring/ }), null);
    view.rerender(<MonitoringEvidencePanel disease="tilapia" onSnapshot={onSnapshot} />);
    await waitFor(() => assert.equal(selected, null));
    assert.equal((screen.getByLabelText("Monitoring feed") as HTMLSelectElement).value, "");
    assert.ok(screen.getByText(/Read-only for tilapia/));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("503 and empty catalogs expose safe retry and do not publish an observation", async () => {
  const React = await import("react"); const { render, screen, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel"); const original = globalThis.fetch; let available = false;
  globalThis.fetch = async () => available ? Response.json({ schemaVersion: "1.0", feeds: [] }) : Response.json({ error: "SECRET must not be shown" }, { status: 503 });
  try {
    render(<MonitoringEvidencePanel disease="wsd" onSnapshot={() => {}} />); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" }));
    assert.ok(await screen.findByText(/not configured/)); assert.equal(screen.queryByText(/SECRET/), null);
    available = true; await user.click(screen.getByRole("button", { name: "Retry monitoring" }));
    assert.ok(await screen.findByText(/No published monitoring feeds/));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("late selection or cancelled refresh cannot replace a newer preview", async () => {
  const React = await import("react"); const { render, screen, waitFor, act, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel"); const original = globalThis.fetch;
  let finishA: (value: Response) => void = () => {}; let selected: MonitoringSnapshot | null = null;
  globalThis.fetch = async (url) => String(url).endsWith("/feeds") ? Response.json({ schemaVersion: "1.0", feeds }) : String(url).includes("synthetic-a") ? new Promise<Response>((resolve) => { finishA = resolve; }) : Response.json(snapshot(feeds[1]));
  const onSnapshot = (value: MonitoringSnapshot | null) => { selected = value; };
  try {
    const view = render(<MonitoringEvidencePanel disease="wsd" onSnapshot={onSnapshot} />); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" }));
    await user.selectOptions(await screen.findByLabelText("Monitoring feed"), "synthetic-a");
    await user.selectOptions(screen.getByLabelText("Monitoring feed"), "synthetic-b");
    await waitFor(() => assert.equal((selected as MonitoringSnapshot | null)?.feed.id, "synthetic-b"));
    await act(async () => { finishA(Response.json(snapshot(feeds[0]))); });
    assert.equal((selected as MonitoringSnapshot | null)?.feed.id, "synthetic-b");
    await user.selectOptions(screen.getByLabelText("Monitoring feed"), "synthetic-a");
    assert.equal(selected, null);
    view.rerender(<MonitoringEvidencePanel disease="tilapia" onSnapshot={onSnapshot} />);
    await act(async () => { finishA(Response.json(snapshot(feeds[0]))); });
    assert.equal(selected, null); assert.equal(screen.queryByText("28 °C"), null);
  } finally { globalThis.fetch = original; cleanup(); }
});

test("latest errors retry a new read, distinguish no observation and clear an existing preview before refresh", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel"); const original = globalThis.fetch; let latest = 0;
  const previews: (MonitoringSnapshot | null)[] = [];
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/feeds")) return Response.json({ schemaVersion: "1.0", feeds });
    latest += 1;
    if (latest === 1) return Response.json({ error: "sensitive upstream text" }, { status: 503 });
    if (latest === 2) return Response.json({ ...snapshot(), observation: null });
    if (latest === 4) return Response.json({ ...snapshot(), unexpected: "sensitive invalid DTO" });
    return Response.json(snapshot());
  };
  try {
    render(<MonitoringEvidencePanel disease="wsd" onSnapshot={(value) => previews.push(value)} />); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" })); await user.selectOptions(await screen.findByLabelText("Monitoring feed"), "synthetic-a");
    assert.ok(await screen.findByRole("button", { name: "Retry monitoring" })); assert.equal(screen.queryByText(/sensitive/), null);
    await user.click(screen.getByRole("button", { name: "Retry monitoring" }));
    assert.ok(await screen.findByText("No observation is available for this feed.")); assert.equal(previews.at(-1)?.observation, null);
    await user.click(screen.getByRole("button", { name: "Refresh observation" }));
    assert.ok(await screen.findByText("28 °C"));
    await user.click(screen.getByRole("button", { name: "Refresh observation" }));
    await waitFor(() => assert.ok(screen.getByText(/returned invalid data/)));
    assert.equal(previews.at(-1), null); assert.equal(screen.queryByText("28 °C"), null); assert.equal(screen.queryByText(/sensitive/), null);
  } finally { globalThis.fetch = original; cleanup(); }
});

test("explicit demo start loads its first preview without HTTP while an unstarted source stays idle", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel"); const original = globalThis.fetch; let selected: MonitoringSnapshot | null = null; let reads = 0;
  globalThis.fetch = async () => { throw new Error("Demo must not use HTTP"); };
  const source = { kind: "demo" as const, listFeeds: async () => feeds, readLatest: async (id: string) => { reads += 1; return snapshot(feeds.find((feed) => feed.id === id)); } };
  const onSnapshot = (value: MonitoringSnapshot | null) => { selected = value; };
  try {
    const view = render(<MonitoringEvidencePanel disease="wsd" source={source} startRequest={0} onSnapshot={onSnapshot} />);
    assert.equal(reads, 0); assert.equal(screen.queryByLabelText("Monitoring feed"), null);
    view.rerender(<MonitoringEvidencePanel disease="wsd" source={source} startRequest={1} onSnapshot={onSnapshot} />);
    await waitFor(() => assert.equal((selected as MonitoringSnapshot | null)?.feed.id, "synthetic-a")); assert.equal(reads, 1); assert.ok(screen.getByText("28 °C"));
    assert.equal(screen.getByRole("region", { name: "Monitoring observations" }).getAttribute("data-monitoring-source"), "demo");
  } finally { globalThis.fetch = original; cleanup(); }
});

test("source changes abort catalog and latest requests and discard late responses and retry targets", async () => {
  const React = await import("react"); const { render, screen, waitFor, act, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { MonitoringEvidencePanel } = await import("./monitoring-evidence-panel"); let selected: MonitoringSnapshot | null = null;
  let resolveCatalog: (value: MonitoringFeed[]) => void = () => {}; let resolveRead: (value: MonitoringSnapshot) => void = () => {}; let catalogSignal: AbortSignal | undefined; let readSignal: AbortSignal | undefined;
  const pending = { kind: "published" as const, listFeeds: (signal?: AbortSignal) => { catalogSignal = signal; return new Promise<MonitoringFeed[]>((resolve) => { resolveCatalog = resolve; }); }, readLatest: async () => snapshot() };
  const demo = { kind: "demo" as const, listFeeds: async () => [feeds[1]], readLatest: (_id: string, signal?: AbortSignal) => { readSignal = signal; return new Promise<MonitoringSnapshot>((resolve) => { resolveRead = resolve; }); } };
  const published = { kind: "published" as const, listFeeds: async () => [], readLatest: async () => snapshot() };
  const onSnapshot = (value: MonitoringSnapshot | null) => { selected = value; };
  try {
    const view = render(<MonitoringEvidencePanel disease="wsd" source={pending} onSnapshot={onSnapshot} />); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Load monitoring feeds" }));
    view.rerender(<MonitoringEvidencePanel disease="wsd" source={demo} startRequest={1} onSnapshot={onSnapshot} />); await waitFor(() => assert.ok(readSignal)); assert.equal(catalogSignal?.aborted, true);
    await act(async () => { resolveCatalog(feeds); }); assert.equal((screen.getByLabelText("Monitoring feed") as HTMLSelectElement).options.length, 2);
    view.rerender(<MonitoringEvidencePanel disease="wsd" source={published} startRequest={1} onSnapshot={onSnapshot} />); await waitFor(() => assert.equal(screen.queryByLabelText("Monitoring feed") === null, true)); assert.equal(readSignal?.aborted, true);
    await act(async () => { resolveRead(snapshot(feeds[1])); }); assert.equal(selected, null); assert.equal(screen.queryByText("28 °C"), null); assert.equal(screen.queryByRole("button", { name: "Retry monitoring" }), null);
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" })); assert.ok(await screen.findByText("No published monitoring feeds are available."));
  } finally { cleanup(); }
});
